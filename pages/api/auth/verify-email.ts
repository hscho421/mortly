import type { NextApiRequest, NextApiResponse } from "next";
import { timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { verifyCodeLimiter } from "@/lib/rate-limit";

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
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ message: "Email and code are required" });
    }

    const { success } = verifyCodeLimiter.check(5, `verify-${email}`);
    if (!success) {
      return res.status(429).json({ message: "Too many attempts. Please wait and try again." });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        emailVerified: true,
        verificationCode: true,
        verificationCodeExpiry: true,
      },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid code. Try again." });
    }

    if (user.emailVerified) {
      return res.status(200).json({ success: true });
    }

    if (!user.verificationCode || !user.verificationCodeExpiry) {
      return res.status(400).json({ message: "Invalid code. Try again." });
    }

    if (user.verificationCodeExpiry < new Date()) {
      return res
        .status(400)
        .json({ message: "Code expired. Request a new one.", expired: true });
    }

    if (!safeCompare(user.verificationCode, code)) {
      return res.status(400).json({ message: "Invalid code. Try again." });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationCode: null,
        verificationCodeExpiry: null,
        verificationCodeSentAt: null,
      },
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Verify email error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
