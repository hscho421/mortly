import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateConversationPublicId } from "@/lib/publicId";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    if (req.method === "GET") {
      const where: Record<string, unknown> = {};

      if (session.user.role === "BORROWER") {
        where.borrowerId = session.user.id;
      } else if (session.user.role === "BROKER") {
        const broker = await prisma.broker.findUnique({
          where: { userId: session.user.id },
        });
        if (!broker) {
          return res.status(404).json({ error: "Broker profile not found" });
        }
        where.brokerId = broker.id;
      } else {
        return res.status(403).json({ error: "Forbidden" });
      }

      const isBorrower = session.user.role === "BORROWER";

      const conversations = await prisma.conversation.findMany({
        where,
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          broker: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
          borrower: {
            select: { id: true, name: true, email: true },
          },
          request: {
            select: { id: true, publicId: true, province: true, city: true, status: true, mortgageCategory: true, productTypes: true },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      // Compute unread counts in a single batched query instead of N+1
      const userId = session.user.id;
      const conversationIds = conversations.map((c) => c.id);

      // Build per-conversation lastReadAt map
      const lastReadMap = new Map<string, Date | null>();
      for (const c of conversations) {
        lastReadMap.set(c.id, isBorrower ? c.borrowerLastReadAt : c.brokerLastReadAt);
      }

      // Single groupBy query for all unread counts
      const unreadCounts = conversationIds.length > 0
        ? await prisma.message.groupBy({
            by: ["conversationId"],
            where: {
              conversationId: { in: conversationIds },
              senderId: { not: userId },
            },
            _count: { _all: true },
          })
        : [];

      // For conversations with lastReadAt, we need filtered counts
      const convsWithLastRead = conversations.filter(
        (c) => lastReadMap.get(c.id) != null
      );
      const filteredUnreadCounts = convsWithLastRead.length > 0
        ? await Promise.all(
            convsWithLastRead.map((c) =>
              prisma.message.count({
                where: {
                  conversationId: c.id,
                  senderId: { not: userId },
                  createdAt: { gt: lastReadMap.get(c.id)! },
                },
              }).then((count) => ({ conversationId: c.id, count }))
            )
          )
        : [];

      const filteredCountMap = new Map(
        filteredUnreadCounts.map((r) => [r.conversationId, r.count])
      );
      const totalCountMap = new Map(
        unreadCounts.map((r) => [r.conversationId, r._count._all])
      );

      const withUnread = conversations.map((c) => ({
        ...c,
        unreadCount: lastReadMap.get(c.id)
          ? (filteredCountMap.get(c.id) ?? 0)
          : (totalCountMap.get(c.id) ?? 0),
      }));

      return res.status(200).json(withUnread);
    }

    if (req.method === "POST") {
      if (session.user.role !== "BORROWER") {
        return res.status(403).json({ error: "Only borrowers can create conversations" });
      }

      const { requestId, brokerId } = req.body;

      if (!requestId || !brokerId) {
        return res.status(400).json({ error: "requestId and brokerId are required" });
      }

      // Resolve publicId to internal id
      const reqLookup = /^\d{9}$/.test(requestId)
        ? { publicId: requestId }
        : { id: requestId };
      const request = await prisma.borrowerRequest.findUnique({
        where: reqLookup,
      });

      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }

      if (request.borrowerId !== session.user.id) {
        return res.status(403).json({ error: "You can only create conversations for your own requests" });
      }

      // Check for existing conversation to prevent duplicates
      const existing = await prisma.conversation.findUnique({
        where: { requestId_brokerId: { requestId: request.id, brokerId } },
      });

      if (existing) {
        return res.status(200).json(existing);
      }

      const convoPublicId = await generateConversationPublicId();
      const conversation = await prisma.conversation.create({
        data: {
          publicId: convoPublicId,
          requestId: request.id,
          borrowerId: session.user.id,
          brokerId,
        },
      });

      return res.status(201).json(conversation);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error in /api/conversations:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
