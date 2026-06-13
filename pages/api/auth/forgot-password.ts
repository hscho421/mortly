import type { NextApiRequest, NextApiResponse } from "next";
import { randomBytes, createHash, randomInt } from "crypto";
import prisma from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { isValidEmail, normalizeEmail } from "@/lib/normalizeEmail";

/**
 * Constant-ish target latency in ms. Both branches (user-exists / does-not)
 * sleep until at least this elapsed time before responding so timing alone
 * cannot enumerate registered emails. Real send work is fire-and-forget.
 */
const TARGET_RESPONSE_MS = 350;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const start = Date.now();

  const { success } = await checkRateLimit({
    key: `forgot-${getClientIp(req)}`,
    limit: 3,
    windowMs: 60_000,
  });
  if (!success) {
    return res.status(429).json({ message: "Too many requests. Please try again later." });
  }

  try {
    const { email: rawEmail, locale: rawLocale } = req.body;
    // The requester's UI language is the best signal we have for email
    // language — user.preferences.locale is never written by any flow, so
    // reading it alone meant every web user got a Korean reset email.
    const locale = rawLocale === "en" ? "en" : "ko";
    if (!isValidEmail(rawEmail)) {
      // Even malformed input gets the constant-time treatment to deny
      // attackers a "non-string vs string-but-no-account" oracle.
      await padToTarget(start);
      return res.status(200).json({
        message: "If an account with that email exists, a reset link has been sent.",
      });
    }
    const email = normalizeEmail(rawEmail);

    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      // Per-account cooldown: don't issue a fresh reset token (or email) more
      // than once per 60s for the same account, even across IPs. Blunts
      // reset-email bombing / reset-link churn aimed at a specific victim.
      // Done silently (no distinct response) so it isn't an enumeration oracle.
      const lastSent = user.resetTokenExpiry
        ? user.resetTokenExpiry.getTime() - 60 * 60 * 1000
        : 0;
      const withinCooldown = Date.now() - lastSent < 60_000;

      if (!withinCooldown) {
        const rawToken = randomBytes(32).toString("hex");
        const hashedToken = createHash("sha256").update(rawToken).digest("hex");
        const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

        await prisma.user.update({
          where: { email },
          data: { resetToken: hashedToken, resetTokenExpiry },
        });

        // Locale-prefix the link so the reset page renders in the same
        // language as the email (ko is the unprefixed default locale).
        const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const resetUrl = `${base}${locale === "en" ? "/en" : ""}/reset-password?token=${rawToken}`;

        // Fire-and-forget — never await the SMTP round-trip on the response
        // path. Both code paths (user / no-user) finish in roughly the same
        // wall time, removing the timing oracle.
        sendPasswordResetEmail(email, resetUrl, locale).catch((err) =>
          console.error("Failed to send password reset email:", err),
        );
      }
    }

    await padToTarget(start);
    return res.status(200).json({
      message: "If an account with that email exists, a reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    await padToTarget(start);
    return res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * Pad the response wall time to `TARGET_RESPONSE_MS` (+ small jitter) so the
 * existing-vs-non-existing-account branches are observationally identical.
 */
async function padToTarget(start: number): Promise<void> {
  const elapsed = Date.now() - start;
  // Jitter prevents a "fingerprint of the constant" but keeps the shape flat.
  const jitter = randomInt(0, 50);
  const remaining = Math.max(0, TARGET_RESPONSE_MS - elapsed) + jitter;
  if (remaining > 0) {
    await new Promise<void>((r) => setTimeout(r, remaining));
  }
}
