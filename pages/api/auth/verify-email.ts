import type { NextApiRequest, NextApiResponse } from "next";
import { timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { isValidEmail, normalizeEmail } from "@/lib/normalizeEmail";

const MAX_ATTEMPTS_PER_CODE = 5;
const ATTEMPTS_PER_IP_PER_HOUR = 30;

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { email: rawEmail, code } = req.body;
    if (!isValidEmail(rawEmail) || typeof code !== "string") {
      return res.status(400).json({ message: "Invalid code. Try again." });
    }

    const email = normalizeEmail(rawEmail);

    // Two-layer durable rate limit so per-lambda counters can't be bypassed
    // by traffic spreading across many warm instances:
    //   - per-email: caps total attempts against a single account.
    //   - per-IP:    caps how fast a single attacker can spray across emails.
    const ip = getClientIp(req);
    const [emailLimit, ipLimit] = await Promise.all([
      checkRateLimit({
        key: `verify-email-${email}`,
        limit: MAX_ATTEMPTS_PER_CODE * 2,
        windowMs: 10 * 60 * 1000,
      }),
      checkRateLimit({
        key: `verify-ip-${ip}`,
        limit: ATTEMPTS_PER_IP_PER_HOUR,
        windowMs: 60 * 60 * 1000,
      }),
    ]);
    if (!emailLimit.success || !ipLimit.success) {
      return res.status(429).json({ message: "Too many attempts. Please wait and try again." });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        emailVerified: true,
        verificationCode: true,
        verificationCodeExpiry: true,
        verificationAttempts: true,
      },
    });

    // Indistinguishable response shape for unknown email AND already-verified
    // accounts — both used to leak signal to enumeration. We respond with the
    // generic invalid-code error in those cases. (This is safe because a
    // legitimate already-verified user would never be on this screen.)
    if (!user || user.emailVerified) {
      return res.status(400).json({ message: "Invalid code. Try again." });
    }

    if (!user.verificationCode || !user.verificationCodeExpiry) {
      return res.status(400).json({ message: "Invalid code. Try again." });
    }

    if (user.verificationCodeExpiry < new Date()) {
      return res
        .status(400)
        .json({ message: "Code expired. Request a new one.", expired: true });
    }

    // Per-code attempt counter — when this exceeds MAX_ATTEMPTS_PER_CODE we
    // burn the code so the attacker can't keep spraying against the same
    // 6-digit value. The user has to call /resend-code to mint a new one.
    if (user.verificationAttempts >= MAX_ATTEMPTS_PER_CODE) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          verificationCode: null,
          verificationCodeExpiry: null,
          verificationAttempts: 0,
        },
      });
      return res
        .status(400)
        .json({ message: "Too many attempts. Request a new code.", expired: true });
    }

    if (!safeCompare(user.verificationCode, code)) {
      await prisma.user.update({
        where: { id: user.id },
        data: { verificationAttempts: { increment: 1 } },
      });
      return res.status(400).json({ message: "Invalid code. Try again." });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationCode: null,
        verificationCodeExpiry: null,
        verificationCodeSentAt: null,
        verificationAttempts: 0,
      },
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Verify email error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
