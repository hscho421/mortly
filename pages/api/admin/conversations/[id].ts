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

  const { id: rawId } = req.query;
  if (!rawId || typeof rawId !== "string") {
    return res.status(400).json({ error: "Invalid conversation ID" });
  }

  // Support lookup by publicId (9-digit) or internal id
  const lookup = /^\d{9}$/.test(rawId) ? { publicId: rawId } : { id: rawId };

  try {
    if (req.method === "GET") {
      const conversation = await prisma.conversation.findUnique({
        where: lookup,
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            include: {
              sender: {
                select: { id: true, name: true, email: true, role: true },
              },
            },
          },
          borrower: {
            select: { id: true, name: true, email: true, status: true },
          },
          broker: {
            include: {
              user: { select: { id: true, name: true, email: true, status: true } },
            },
          },
          request: {
            select: { id: true, province: true, city: true, status: true, mortgageCategory: true, productTypes: true },
          },
        },
      });

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      return res.status(200).json(conversation);
    }

    if (req.method === "PUT") {
      const { status, reason } = req.body;

      if (status !== "CLOSED") {
        return res.status(400).json({ error: "Only CLOSED status is supported" });
      }

      const conversation = await prisma.conversation.findUnique({
        where: lookup,
      });

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      if (conversation.status === "CLOSED") {
        return res.status(400).json({ error: "Conversation is already closed" });
      }

      // Send admin closure message
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: session.user.id,
          body: "[Admin] This conversation has been closed by an administrator." + (reason ? ` Reason: ${reason}` : ""),
        },
      });

      const updated = await prisma.conversation.update({
        where: { id: conversation.id },
        data: { status: "CLOSED" },
      });

      // Log the admin action
      await prisma.adminAction.create({
        data: {
          adminId: session.user.id,
          action: "CLOSE_CONVERSATION",
          targetType: "CONVERSATION",
          targetId: conversation.publicId,
          details: JSON.stringify({
            borrowerId: conversation.borrowerId,
            brokerId: conversation.brokerId,
            requestId: conversation.requestId,
          }),
          reason: reason || null,
        },
      });

      return res.status(200).json(updated);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error in /api/admin/conversations/[id]:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
