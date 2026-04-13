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

  const { id } = req.query;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Invalid conversation ID" });
  }

  try {
    if (req.method === "GET") {
      const conversation = await prisma.conversation.findUnique({
        where: { id },
        select: {
          id: true,
          publicId: true,
          requestId: true,
          borrowerId: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          borrowerLastReadAt: true,
          brokerLastReadAt: true,
          messages: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              body: true,
              createdAt: true,
              senderId: true,
              conversationId: true,
              sender: {
                select: { id: true, name: true, role: true },
              },
            },
          },
          broker: {
            select: {
              id: true,
              userId: true,
              brokerageName: true,
              verificationStatus: true,
              user: {
                select: { id: true, publicId: true, name: true },
              },
            },
          },
          borrower: {
            select: { id: true, name: true },
          },
          request: {
            select: { id: true, publicId: true, province: true, city: true, status: true, mortgageCategory: true, productTypes: true },
          },
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

      // Mark conversation as read for this user
      const isBorrower = conversation.borrowerId === session.user.id;
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: isBorrower
          ? { borrowerLastReadAt: new Date() }
          : { brokerLastReadAt: new Date() },
      });

      return res.status(200).json(conversation);
    }

    if (req.method === "PUT") {
      if (session.user.role !== "BORROWER") {
        return res.status(403).json({ error: "Only borrowers can close conversations" });
      }

      const { status } = req.body;
      if (status !== "CLOSED") {
        return res.status(400).json({ error: "Only status CLOSED is supported" });
      }

      const conversation = await prisma.conversation.findUnique({
        where: { id },
      });

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      if (conversation.borrowerId !== session.user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const updated = await prisma.conversation.update({
        where: { id },
        data: { status: "CLOSED" },
      });

      return res.status(200).json(updated);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error in /api/conversations/[id]:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
