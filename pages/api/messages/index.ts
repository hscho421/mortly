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

  try {
    if (req.method === "POST") {
      const { conversationId, body } = req.body;

      if (!conversationId || !body) {
        return res.status(400).json({ error: "conversationId and body are required" });
      }

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          broker: { select: { userId: true } },
        },
      });

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      const isParticipant =
        conversation.borrowerId === session.user.id ||
        conversation.broker.userId === session.user.id;

      if (!isParticipant) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const message = await prisma.message.create({
        data: {
          conversationId,
          senderId: session.user.id,
          body,
        },
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      return res.status(201).json(message);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error in /api/messages:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
