import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";

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

    if (user.verificationCode !== code) {
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
