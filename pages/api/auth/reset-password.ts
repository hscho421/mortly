import type { NextApiRequest, NextApiResponse } from "next";
import { hash } from "bcryptjs";
import { createHash } from "crypto";
import prisma from "@/lib/prisma";
import { authLimiter, getClientIp } from "@/lib/rate-limit";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { success } = authLimiter.check(5, `reset-${getClientIp(req)}`);
  if (!success) {
    return res.status(429).json({ message: "Too many requests. Please try again later." });
  }

  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: "Token and password are required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const hashedToken = createHash("sha256").update(token).digest("hex");
    const user = await prisma.user.findUnique({
      where: { resetToken: hashedToken },
    });

    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    const passwordHash = await hash(password, 12);

    // Bump tokenVersion as part of the same write so all existing JWTs for
    // this user are invalidated atomically with the password change. Without
    // this, a leaked JWT survives the reset and the legitimate user's "I
    // changed my password" did nothing to evict the attacker's session.
    //
    // emailVerified is set to true intentionally — receiving the reset link
    // proves inbox ownership equivalent to verifying.
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
        emailVerified: true,
        tokenVersion: { increment: 1 },
      },
    });

    return res.status(200).json({ message: "Password has been reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
