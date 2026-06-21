import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";

export default withAuth(async (req, res, session) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
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
      // No Broker profile yet (signed up, not onboarded / awaiting verification)
      // → they have no conversations. Return 0 WITHOUT falling through to the
      // `brokerId: undefined` filter below: Prisma drops an `undefined` filter
      // entirely, which would count unread across EVERY conversation platform-
      // wide — the "38 unread on the messages tab" bug for unverified brokers.
      if (!broker) {
        return res.status(200).json({ unread: 0 });
      }
      brokerId = broker.id;
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
});

