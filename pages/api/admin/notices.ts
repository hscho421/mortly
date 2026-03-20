import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }

  if (req.method === "GET") {
    try {
      const notices = await prisma.adminNotice.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        include: {
          admin: { select: { id: true, name: true, email: true } },
          user: { select: { id: true, publicId: true, name: true, email: true } },
        },
      });
      return res.status(200).json(notices);
    } catch (error) {
      console.error("Error fetching notices:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  if (req.method === "POST") {
    try {
      const { userId, subject, body } = req.body;

      if (!userId || !subject || !body) {
        return res.status(400).json({ error: "userId, subject, and body are required" });
      }

      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      const notice = await prisma.adminNotice.create({
        data: {
          adminId: session.user.id,
          userId,
          subject,
          body,
        },
        include: {
          admin: { select: { id: true, name: true, email: true } },
          user: { select: { id: true, publicId: true, name: true, email: true } },
        },
      });

      await prisma.adminAction.create({
        data: {
          adminId: session.user.id,
          action: "SEND_NOTICE",
          targetType: "USER",
          targetId: userId,
          details: JSON.stringify({ subject }),
        },
      });

      return res.status(201).json(notice);
    } catch (error) {
      console.error("Error creating notice:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
