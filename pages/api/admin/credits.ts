import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }

  try {
    if (req.method === "POST") {
      const { brokerId, amount, reason } = req.body;

      if (!brokerId || typeof brokerId !== "string") {
        return res.status(400).json({ error: "brokerId is required" });
      }

      if (typeof amount !== "number" || amount === 0) {
        return res.status(400).json({ error: "amount must be a non-zero number" });
      }

      const broker = await prisma.broker.findUnique({
        where: { id: brokerId },
        include: { user: { select: { publicId: true, name: true, email: true } } },
      });

      if (!broker) {
        return res.status(404).json({ error: "Broker not found" });
      }

      const newCredits = broker.responseCredits + amount;
      if (newCredits < 0) {
        return res.status(400).json({
          error: `Cannot remove ${Math.abs(amount)} credits. Broker only has ${broker.responseCredits}.`,
        });
      }

      const [updated] = await prisma.$transaction([
        prisma.broker.update({
          where: { id: brokerId },
          data: { responseCredits: newCredits },
          select: {
            id: true,
            responseCredits: true,
            user: { select: { name: true, email: true } },
          },
        }),
        prisma.adminAction.create({
          data: {
            adminId: session.user.id,
            action: "CREDIT_ADJUST",
            targetType: "BROKER",
            targetId: broker.user.publicId,
            details: JSON.stringify({
              amount,
              previousBalance: broker.responseCredits,
              newBalance: newCredits,
            }),
            reason: reason || null,
          },
        }),
      ]);

      return res.status(200).json(updated);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error in /api/admin/credits:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
