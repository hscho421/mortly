import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { targetType, targetId, reason } = req.body;

    if (!targetType || !targetId || !reason) {
      return res
        .status(400)
        .json({ error: "targetType, targetId, and reason are required" });
    }

    const allowedTypes = ["BROKER", "REQUEST", "CONVERSATION"];
    if (!allowedTypes.includes(targetType)) {
      return res.status(400).json({ error: "Invalid targetType" });
    }

    // Prevent duplicate reports from the same user for the same target
    const existing = await prisma.report.findFirst({
      where: {
        reporterId: session.user.id,
        targetType,
        targetId,
      },
    });

    if (existing) {
      return res.status(409).json({ error: "duplicate" });
    }

    const report = await prisma.report.create({
      data: {
        reporterId: session.user.id,
        targetType,
        targetId,
        reason,
      },
    });

    return res.status(201).json(report);
  } catch (error) {
    console.error("Error in /api/reports:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
