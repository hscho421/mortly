import prisma from "@/lib/prisma";
import { generateConversationPublicId } from "@/lib/publicId";
import { sendPushToUsers, brokerInquiryPush, borrowerInquiryPush } from "@/lib/push";
import { withAuth } from "@/lib/withAuth";

export default withAuth(async (req, res, session) => {
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

      // ── Block filtering ──
      // Hide conversations where the OTHER party has been blocked by this user,
      // or the OTHER party has blocked this user. Block is symmetric for visibility.
      // Apple guideline 1.2 compliance.
      const blockedUserIds = new Set<string>([
        ...(await prisma.userBlock.findMany({
          where: { blockerId: session.user.id },
          select: { blockedId: true },
        })).map((b) => b.blockedId),
        ...(await prisma.userBlock.findMany({
          where: { blockedId: session.user.id },
          select: { blockerId: true },
        })).map((b) => b.blockerId),
      ]);

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
            select: { id: true, publicId: true, name: true },
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
      const orConditions = conversations.map((c: { id: string; borrowerLastReadAt: Date | null; brokerLastReadAt: Date | null }) => {
        const lastReadAt = isBorrower ? c.borrowerLastReadAt : c.brokerLastReadAt;
        return {
          conversationId: c.id,
          senderId: { not: userId },
          ...(lastReadAt ? { createdAt: { gte: lastReadAt } } : {}),
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
        unreadCounts.map((r: { conversationId: string; _count: { _all: number } }) => [r.conversationId, r._count._all])
      );

      const withUnread = conversations
        .filter((c: typeof conversations[number]) => {
          // Drop conversations where the OTHER party is in the block set
          // (either direction). Block is symmetric for visibility — Apple
          // guideline 1.2.
          const otherUserId = isBorrower
            ? c.broker?.user?.id
            : c.borrower?.id;
          if (!otherUserId) return true; // no other party to compare → keep
          return !blockedUserIds.has(otherUserId);
        })
        .map((c: typeof conversations[number]) => ({
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

        // Look up the broker explicitly so we can return a clean 404 — the
        // FK on Conversation.brokerId would otherwise blow up with a P2003
        // and leak existence-by-error-text. Also gates broker-id enumeration
        // by attempt-count.
        const targetBroker = await prisma.broker.findUnique({
          where: { id: bodyBrokerId },
          select: { userId: true },
        });
        if (!targetBroker) {
          return res.status(404).json({ error: "Broker not found" });
        }

        // Block check — borrower starting convo with broker.
        const blocked = await prisma.userBlock.findFirst({
          where: {
            OR: [
              { blockerId: session.user.id, blockedId: targetBroker.userId },
              { blockerId: targetBroker.userId, blockedId: session.user.id },
            ],
          },
        });
        if (blocked) {
          return res.status(403).json({ error: "Cannot start conversation with this user" });
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

        // Fire-and-forget push to the broker
        const broker = await prisma.broker.findUnique({
          where: { id: bodyBrokerId },
          select: { userId: true },
        });
        if (broker) {
          sendPushToUsers({
            userIds: [broker.userId],
            content: borrowerInquiryPush(session.user.name),
            data: {
              type: "conversation",
              conversationId: conversation.id,
            },
          }).catch((err) => console.error("Push notify failed:", err));
        }

        return res.status(201).json(conversation);
      }

      // BROKER flow: create conversation directly with credit deduction
      const broker = await prisma.broker.findUnique({
        where: { userId: session.user.id },
        select: { id: true, brokerageName: true, verificationStatus: true, subscriptionTier: true, responseCredits: true },
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

      // Block check — broker reaching out to borrower.
      // Either direction blocks the intro.
      const blockedBetween = await prisma.userBlock.findFirst({
        where: {
          OR: [
            { blockerId: session.user.id, blockedId: request.borrowerId },
            { blockerId: request.borrowerId, blockedId: session.user.id },
          ],
        },
      });
      if (blockedBetween) {
        return res.status(403).json({ error: "Cannot send intro to this borrower" });
      }

      const isPremium = broker.subscriptionTier === "PREMIUM";

      // All conversation creation goes through a transaction to prevent
      // race conditions (duplicate conversations + credit double-spend)
      const convoPublicId = await generateConversationPublicId();

      // Serializable isolation pins us against race-double-spend: two
      // concurrent broker POSTs against the same request would otherwise both
      // pass the existence check, both decrement the credit, and only the
      // second create call would 5xx (unique violation triggers rollback,
      // restoring the credit). Serializable + the unique key guarantee that
      // exactly one transaction commits.
      const { conversation, isNew } = await prisma.$transaction(async (tx) => {
        // Idempotency: return existing conversation if already created
        const existing = await tx.conversation.findUnique({
          where: { requestId_brokerId: { requestId: request.id, brokerId: broker.id } },
        });
        if (existing) return { conversation: existing, isNew: false };

        // Non-premium brokers: atomically deduct credit
        if (!isPremium) {
          const updated = await tx.broker.updateMany({
            where: { id: broker.id, responseCredits: { gt: 0 } },
            data: { responseCredits: { decrement: 1 } },
          });
          if (updated.count === 0) {
            throw new Error("NO_CREDITS");
          }
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

        return { conversation: conv, isNew: true };
      }, { isolationLevel: "Serializable" });

      // Fire-and-forget push to the borrower (only on new conversation)
      if (isNew) {
        sendPushToUsers({
          userIds: [request.borrowerId],
          content: brokerInquiryPush(
            broker.brokerageName || "A broker",
            typeof message === "string" ? message : undefined
          ),
          data: {
            type: "conversation",
            conversationId: conversation.id,
          },
        }).catch((err) => console.error("Push notify failed:", err));
      }

      return res.status(isNew ? 201 : 200).json(conversation);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    if (error instanceof Error && error.message === "NO_CREDITS") {
      return res.status(403).json({ error: "No response credits remaining" });
    }
    console.error("Error in /api/conversations:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}, { rateLimit: { perMinute: 30, bucket: "conversations" } });

