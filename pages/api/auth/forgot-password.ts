import type { NextApiRequest, NextApiResponse } from "next";
import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Always return success to prevent email enumeration
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const resetToken = randomBytes(32).toString("hex");
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.user.update({
        where: { email },
        data: { resetToken, resetTokenExpiry },
      });

      const resetUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/reset-password?token=${resetToken}`;

      try {
        await sendPasswordResetEmail(email, resetUrl, "ko");
      } catch (emailError) {
        console.error("Failed to send password reset email:", emailError);
      }
    }

    return res.status(200).json({
      message: "If an account with that email exists, a reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
