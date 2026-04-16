import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { hash } from "bcryptjs";
import prisma from "@/lib/prisma";
import { generatePublicId } from "@/lib/publicId";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }

  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const passwordHash = await hash(password, 12);
    const publicId = await generatePublicId();

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "ADMIN",
        publicId,
        emailVerified: true,
      },
      select: {
        id: true,
        publicId: true,
        name: true,
        email: true,
        role: true,
      },
    });

    await prisma.adminAction.create({
      data: {
        adminId: session.user.id,
        action: "CREATE_ADMIN",
        targetType: "USER",
        targetId: user.publicId,
        details: JSON.stringify({ email: user.email, name: user.name }),
      },
    });

    return res.status(201).json(user);
  } catch (error) {
    console.error("Error creating admin:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
