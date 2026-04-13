import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const userId = session.user.id;
    const isBroker = session.user.role === "BROKER";

    let brokerId: string | undefined;
    if (isBroker) {
      const broker = await prisma.broker.findUnique({
        where: { userId },
        select: { id: true },
      });
      brokerId = broker?.id;
    }

    // Get all active conversations with their lastReadAt in one query
    const conversations = await prisma.conversation.findMany({
      where: {
        status: "ACTIVE",
        ...(isBroker ? { brokerId } : { borrowerId: userId }),
      },
      select: {
        id: true,
        borrowerLastReadAt: true,
        brokerLastReadAt: true,
      },
    });

    if (conversations.length === 0) {
      return res.status(200).json({ unread: 0 });
    }

    // Build OR conditions for a single query across all conversations
    const orConditions = conversations.map((c: { id: string; borrowerLastReadAt: Date | null; brokerLastReadAt: Date | null }) => {
      const lastReadAt = isBroker ? c.brokerLastReadAt : c.borrowerLastReadAt;
      return {
        conversationId: c.id,
        senderId: { not: userId },
        ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
      };
    });

    // Single query: count total unread messages across all conversations
    const unreadCount = await prisma.message.count({
      where: { OR: orConditions },
    });

    return res.status(200).json({ unread: unreadCount });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
