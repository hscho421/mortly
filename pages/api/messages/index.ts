import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getSettingInt } from "@/lib/settings";
import { sendPushToUsers, messagePush } from "@/lib/push";

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

      if (!conversationId || typeof conversationId !== "string") {
        return res.status(400).json({ error: "conversationId is required" });
      }
      if (!body || typeof body !== "string") {
        return res.status(400).json({ error: "body is required" });
      }
      const trimmed = body.trim();
      if (trimmed.length === 0 || trimmed.length > 5000) {
        return res.status(400).json({ error: "Message must be between 1 and 5000 characters" });
      }

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          broker: { select: { userId: true, brokerageName: true } },
          borrower: { select: { id: true, name: true } },
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

      // Spam guard: limit brokers to 3 messages before borrower responds
      if (conversation.broker.userId === session.user.id) {
        const counts = await prisma.message.groupBy({
          by: ["senderId"],
          where: { conversationId },
          _count: { _all: true },
        });
        const brokerMsgCount = counts.find((c: { senderId: string }) => c.senderId === session.user.id)?._count._all ?? 0;
        const borrowerMsgCount = counts.find((c: { senderId: string }) => c.senderId === conversation.borrowerId)?._count._all ?? 0;
        const msgLimit = await getSettingInt("broker_initial_message_limit") || 3;
        if (borrowerMsgCount === 0 && brokerMsgCount >= msgLimit) {
          return res.status(429).json({ error: "Please wait for the client to respond before sending more messages" });
        }
      }

      const message = await prisma.message.create({
        data: {
          conversationId,
          senderId: session.user.id,
          body: trimmed,
        },
      });

      const isBorrower = conversation.borrowerId === session.user.id;
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          updatedAt: new Date(),
          ...(isBorrower
            ? { borrowerLastReadAt: new Date() }
            : { brokerLastReadAt: new Date() }),
        },
      });

      // Fire-and-forget push to the other participant
      const recipientUserId = isBorrower
        ? conversation.broker.userId
        : conversation.borrowerId;
      const senderName = isBorrower
        ? conversation.borrower?.name || "Client"
        : conversation.broker.brokerageName || "Broker";
      sendPushToUsers({
        userIds: [recipientUserId],
        content: messagePush(senderName, trimmed),
        data: {
          type: "message",
          conversationId: conversation.id,
        },
      }).catch((err) => console.error("Push notify failed:", err));

      return res.status(201).json(message);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error in /api/messages:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
