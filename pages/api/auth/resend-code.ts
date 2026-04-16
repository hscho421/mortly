import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import {
  generateVerificationCode,
  sendVerificationCode,
} from "@/lib/email";
import { authLimiter, getClientIp } from "@/lib/rate-limit";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { success } = authLimiter.check(3, `resend-${getClientIp(req)}`);
  if (!success) {
    return res.status(429).json({ message: "Too many requests. Please try again later." });
  }

  try {
    const { email, locale } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Always return 200 for email enumeration protection
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        emailVerified: true,
        verificationCodeSentAt: true,
      },
    });

    if (!user || user.emailVerified) {
      return res.status(200).json({ success: true });
    }

    // Rate limit: 60 seconds between sends
    if (user.verificationCodeSentAt) {
      const elapsed = Date.now() - user.verificationCodeSentAt.getTime();
      const remaining = Math.ceil((60000 - elapsed) / 1000);
      if (remaining > 0) {
        return res
          .status(429)
          .json({ message: "Too many requests", retryAfter: remaining });
      }
    }

    const code = generateVerificationCode();
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationCode: code,
        verificationCodeExpiry: expiry,
        verificationCodeSentAt: new Date(),
      },
    });

    try {
      await sendVerificationCode(email, code, locale || "ko");
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      return res.status(502).json({ message: "Failed to send verification email. Please try again." });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Resend code error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
