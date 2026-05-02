import type { NextApiRequest, NextApiResponse } from "next";
import { hash } from "bcryptjs";
import prisma from "@/lib/prisma";
import { generatePublicId } from "@/lib/publicId";
import { generateVerificationCode, sendVerificationCode } from "@/lib/email";
import { CURRENT_LEGAL_VERSION, createLegalAcceptanceMetadata } from "@/lib/legal";
import { authLimiter, getClientIp } from "@/lib/rate-limit";
import { isValidEmail, normalizeEmail } from "@/lib/normalizeEmail";
import { assertString } from "@/lib/validate";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { success } = authLimiter.check(5, `signup-${getClientIp(req)}`);
  if (!success) {
    return res.status(429).json({ message: "Too many requests. Please try again later." });
  }

  try {
    const { name: rawName, email: rawEmail, password, role, locale, legalVersion } = req.body;

    if (!rawName || !rawEmail || !password || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    let name: string;
    try {
      name = assertString(rawName, "name", { max: 100 });
    } catch {
      return res.status(400).json({ message: "Name must be 1-100 characters" });
    }

    if (!isValidEmail(rawEmail)) {
      return res.status(400).json({ message: "Invalid email format" });
    }
    const email = normalizeEmail(rawEmail);

    if (typeof password !== "string" || password.length < 8 || password.length > 200) {
      return res.status(400).json({ message: "Password must be 8-200 characters" });
    }

    if (!["BORROWER", "BROKER"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (legalVersion !== CURRENT_LEGAL_VERSION) {
      return res.status(400).json({
        message: "Please accept the latest Terms of Service and Privacy Policy",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res
        .status(409)
        .json({ message: "An account with this email already exists" });
    }

    const passwordHash = await hash(password, 12);
    const publicId = await generatePublicId();

    const verificationCode = generateVerificationCode();
    const verificationCodeExpiry = new Date(Date.now() + 10 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        publicId,
        emailVerified: false,
        verificationCode,
        verificationCodeExpiry,
        verificationCodeSentAt: new Date(),
        verificationAttempts: 0,
        preferences: createLegalAcceptanceMetadata(),
      },
      select: {
        id: true,
        publicId: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    // Send verification email
    let emailSent = true;
    try {
      await sendVerificationCode(email, verificationCode, locale || "ko");
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      emailSent = false;
    }

    // Note: If role is BROKER, the broker profile will be created during onboarding

    return res.status(201).json({ user, requiresVerification: true, emailSent });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
