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
        select: {
          id: true,
          publicId: true,
          status: true,
          updatedAt: true,
          borrowerLastReadAt: true,
          brokerLastReadAt: true,
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { body: true, createdAt: true, senderId: true },
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
        orderBy: { updatedAt: "desc" },
      });

      // Compute unread counts in a single batched query
      const userId = session.user.id;

      // Build per-conversation OR conditions (same pattern as /api/messages/unread)
      const orConditions = conversations.map((c) => {
        const lastReadAt = isBorrower ? c.borrowerLastReadAt : c.brokerLastReadAt;
        return {
          conversationId: c.id,
          senderId: { not: userId },
          ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
        };
      });

      // Single groupBy query for all conversations — no N+1
      const unreadCounts = orConditions.length > 0
        ? await prisma.message.groupBy({
            by: ["conversationId"],
            where: { OR: orConditions },
            _count: { _all: true },
          })
        : [];

      const unreadMap = new Map(
        unreadCounts.map((r) => [r.conversationId, r._count._all])
      );

      const withUnread = conversations.map((c) => ({
        ...c,
        borrower: c.borrower,
        unreadCount: unreadMap.get(c.id) ?? 0,
      }));

      return res.status(200).json(withUnread);
    }

    if (req.method === "POST") {
      if (session.user.role !== "BORROWER" && session.user.role !== "BROKER") {
        return res.status(403).json({ error: "Only borrowers or brokers can create conversations" });
      }

      const { requestId, brokerId: bodyBrokerId, message } = req.body;

      if (!requestId) {
        return res.status(400).json({ error: "requestId is required" });
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

      if (session.user.role === "BORROWER") {
        if (!bodyBrokerId) {
          return res.status(400).json({ error: "brokerId is required" });
        }
        if (request.borrowerId !== session.user.id) {
          return res.status(403).json({ error: "You can only create conversations for your own requests" });
        }

        const existing = await prisma.conversation.findUnique({
          where: { requestId_brokerId: { requestId: request.id, brokerId: bodyBrokerId } },
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
            brokerId: bodyBrokerId,
          },
        });
        return res.status(201).json(conversation);
      }

      // BROKER flow: create conversation directly with credit deduction
      const broker = await prisma.broker.findUnique({
        where: { userId: session.user.id },
        select: { id: true, verificationStatus: true, subscriptionTier: true, responseCredits: true },
      });

      if (!broker) {
        return res.status(404).json({ error: "Broker profile not found" });
      }
      if (broker.verificationStatus !== "VERIFIED") {
        return res.status(403).json({ error: "Broker must be verified to message clients" });
      }
      if (broker.subscriptionTier === "FREE") {
        return res.status(403).json({ error: "Free plan brokers cannot message clients. Please upgrade your plan." });
      }

      const isPremium = broker.subscriptionTier === "PREMIUM";

      if (!isPremium && broker.responseCredits <= 0) {
        return res.status(403).json({ error: "No response credits remaining" });
      }

      // Check for existing conversation
      const existing = await prisma.conversation.findUnique({
        where: { requestId_brokerId: { requestId: request.id, brokerId: broker.id } },
      });
      if (existing) {
        return res.status(200).json(existing);
      }

      const convoPublicId = await generateConversationPublicId();

      if (isPremium) {
        const conversation = await prisma.conversation.create({
          data: {
            publicId: convoPublicId,
            requestId: request.id,
            borrowerId: request.borrowerId,
            brokerId: broker.id,
          },
        });

        // Create initial message if provided
        if (message) {
          await prisma.message.create({
            data: { conversationId: conversation.id, senderId: session.user.id, body: message },
          });
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { updatedAt: new Date() },
          });
        }

        return res.status(201).json(conversation);
      }

      // Non-premium: atomically deduct credit and create conversation
      const conversation = await prisma.$transaction(async (tx) => {
        const updated = await tx.broker.updateMany({
          where: { id: broker.id, responseCredits: { gt: 0 } },
          data: { responseCredits: { decrement: 1 } },
        });
        if (updated.count === 0) {
          throw new Error("NO_CREDITS");
        }

        const conv = await tx.conversation.create({
          data: {
            publicId: convoPublicId,
            requestId: request.id,
            borrowerId: request.borrowerId,
            brokerId: broker.id,
          },
        });

        if (message) {
          await tx.message.create({
            data: { conversationId: conv.id, senderId: session.user.id, body: message },
          });
          await tx.conversation.update({
            where: { id: conv.id },
            data: { updatedAt: new Date() },
          });
        }

        return conv;
      });

      return res.status(201).json(conversation);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    if (error instanceof Error && error.message === "NO_CREDITS") {
      return res.status(403).json({ error: "No response credits remaining" });
    }
    console.error("Error in /api/conversations:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
