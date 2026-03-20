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

    let brokerRecord: { id: string } | null = null;
    if (isBroker) {
      brokerRecord = await prisma.broker.findUnique({
        where: { userId },
        select: { id: true },
      });
    }

    // Find all active conversations the user is part of
    const conversations = await prisma.conversation.findMany({
      where: {
        status: "ACTIVE",
        ...(isBroker
          ? { brokerId: brokerRecord?.id }
          : { borrowerId: userId }),
      },
      select: {
        id: true,
        borrowerId: true,
        borrowerLastReadAt: true,
        brokerLastReadAt: true,
        _count: {
          select: { messages: true },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { senderId: true, createdAt: true },
        },
      },
    });

    // Count conversations with messages after the user's lastReadAt
    let unread = 0;
    for (const c of conversations) {
      if (c.messages.length === 0) continue;
      const lastMsg = c.messages[0];
      // Skip if the last message is from us
      if (lastMsg.senderId === userId) continue;

      const lastReadAt = isBroker ? c.brokerLastReadAt : c.borrowerLastReadAt;
      // If never read, or last message is after lastReadAt, it's unread
      if (!lastReadAt || lastMsg.createdAt > lastReadAt) {
        unread++;
      }
    }

    return res.status(200).json({ unread });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
