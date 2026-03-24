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

  const { id } = req.query;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Invalid broker ID" });
  }

  try {
    if (req.method === "GET") {
      // Support lookup by user publicId (9-digit) or broker internal id
      const isPublicId = /^\d{9}$/.test(id);
      const brokerInclude = {
          user: {
            select: { id: true, publicId: true, name: true, email: true, status: true, createdAt: true },
          },
          introductions: {
            include: {
              request: {
                select: { id: true, province: true, city: true, status: true, mortgageCategory: true, productTypes: true },
              },
            },
            orderBy: { createdAt: "desc" as const },
            take: 20,
          },
          conversations: {
            include: {
              borrower: { select: { id: true, name: true, email: true } },
              request: { select: { id: true, province: true, mortgageCategory: true, productTypes: true } },
              _count: { select: { messages: true } },
            },
            orderBy: { updatedAt: "desc" as const },
            take: 20,
          },
          subscription: true,
          _count: {
            select: { introductions: true, conversations: true },
          },
      };

      const broker = isPublicId
        ? await prisma.broker.findFirst({
            where: { user: { publicId: id } },
            include: brokerInclude,
          })
        : await prisma.broker.findUnique({
            where: { id },
            include: brokerInclude,
          });

      if (!broker) {
        return res.status(404).json({ error: "Broker not found" });
      }

      return res.status(200).json(broker);
    }

    if (req.method === "PUT") {
      const { verificationStatus } = req.body;

      if (!verificationStatus) {
        return res.status(400).json({ error: "verificationStatus is required" });
      }

      const broker = await prisma.broker.findUnique({
        where: { id },
        include: { user: { select: { publicId: true } } },
      });

      if (!broker) {
        return res.status(404).json({ error: "Broker not found" });
      }

      const actionMap: Record<string, string> = {
        VERIFIED: "VERIFY_BROKER",
        REJECTED: "REJECT_BROKER",
        PENDING: "RESET_BROKER_VERIFICATION",
      };

      const [updated] = await prisma.$transaction([
        prisma.broker.update({
          where: { id },
          data: { verificationStatus },
        }),
        prisma.adminAction.create({
          data: {
            adminId: session.user.id,
            action: actionMap[verificationStatus] || "UPDATE_BROKER",
            targetType: "BROKER",
            targetId: broker.user.publicId,
            details: JSON.stringify({
              previousStatus: broker.verificationStatus,
              newStatus: verificationStatus,
            }),
          },
        }),
      ]);

      return res.status(200).json(updated);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error in /api/admin/brokers/[id]:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
