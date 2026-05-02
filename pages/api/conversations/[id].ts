import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";

export default withAuth(async (req, res, session) => {
  const { id } = req.query;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Invalid conversation ID" });
  }

  try {
    if (req.method === "GET") {
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
      const before = req.query.before as string | undefined;

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
            ...(before ? { cursor: { id: before }, skip: 1 } : {}),
            take: limit,
            orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
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
            select: { id: true, publicId: true, name: true },
          },
          request: {
            select: {
              id: true,
              publicId: true,
              province: true,
              city: true,
              status: true,
              mortgageCategory: true,
              productTypes: true,
              desiredTimeline: true,
              details: true,
              notes: true,
              createdAt: true,
            },
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

      conversation.messages.reverse();
      const hasMore = conversation.messages.length === limit;

      // Mark conversation as read for this user (only on initial load, not pagination)
      if (!before) {
        const isBorrower = conversation.borrowerId === session.user.id;
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: isBorrower
            ? { borrowerLastReadAt: new Date() }
            : { brokerLastReadAt: new Date() },
        });
      }

      // L2 hardening: when the viewer is the broker side, only return the
      // rich request fields (notes, details, desiredTimeline, createdAt) if
      // their verification status is currently VERIFIED. A broker whose
      // status was revoked AFTER the conversation started keeps thread
      // access (so support hand-off doesn't break ongoing chats) but no
      // longer sees the borrower's financial details.
      const viewerIsBroker = conversation.broker.userId === session.user.id;
      if (viewerIsBroker && conversation.broker.verificationStatus !== "VERIFIED") {
        const safeRequest = conversation.request
          ? {
              id: conversation.request.id,
              publicId: conversation.request.publicId,
              province: conversation.request.province,
              city: conversation.request.city,
              status: conversation.request.status,
              mortgageCategory: conversation.request.mortgageCategory,
              productTypes: conversation.request.productTypes,
            }
          : conversation.request;
        return res
          .status(200)
          .json({ ...conversation, request: safeRequest, hasMore });
      }

      return res.status(200).json({ ...conversation, hasMore });
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

      if (conversation.status === "CLOSED") {
        return res.status(400).json({ error: "Conversation already closed" });
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
});

