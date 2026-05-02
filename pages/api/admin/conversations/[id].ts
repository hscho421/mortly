import prisma from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/withAdmin";
import {
  buildAdminActionCreate,
  MAX_REASON_LEN,
  validateText,
} from "@/lib/admin/audit";

export default withAdmin(async (req, res, session) => {
  // GET on this endpoint exposes full chat history including borrower
  // financial details — opt into the per-admin GET rate limit so a leaked
  // admin token can't be used as a wholesale chat-extraction firehose.
  const { id: rawId } = req.query;
  if (!rawId || typeof rawId !== "string") {
    return res.status(400).json({ error: "Invalid conversation ID" });
  }

  // Support lookup by publicId (9-digit) or internal id
  const lookup = /^\d{9}$/.test(rawId) ? { publicId: rawId } : { id: rawId };

  if (req.method === "GET") {
    // Pagination: cursor-based. messagesBefore=<messageId> fetches older messages than the cursor.
    const messagesBeforeRaw = req.query.messagesBefore;
    const messagesBefore =
      typeof messagesBeforeRaw === "string" && messagesBeforeRaw.length > 0
        ? messagesBeforeRaw
        : null;
    const PAGE_SIZE = 50;

    const conversation = await prisma.conversation.findUnique({
      where: lookup,
      include: {
        borrower: {
          select: { id: true, name: true, email: true, status: true },
        },
        broker: {
          include: {
            user: { select: { id: true, name: true, email: true, status: true } },
          },
        },
        request: {
          select: { id: true, province: true, city: true, status: true, mortgageCategory: true, productTypes: true },
        },
      },
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Fetch messages (newest first) with +1 to detect hasMore, then reverse to ascending for UI.
    const messagesDescPlusOne = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE + 1,
      ...(messagesBefore
        ? { cursor: { id: messagesBefore }, skip: 1 }
        : {}),
      include: {
        sender: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    const hasMore = messagesDescPlusOne.length > PAGE_SIZE;
    const pageDesc = hasMore ? messagesDescPlusOne.slice(0, PAGE_SIZE) : messagesDescPlusOne;
    // Reverse to ascending (oldest first) so the UI renders them in chronological order.
    const messages = [...pageDesc].reverse();
    // nextCursor: id of the OLDEST message in the returned batch — pass this as messagesBefore to fetch older.
    const nextCursor = messages.length > 0 ? messages[0].id : null;

    return res.status(200).json({
      ...conversation,
      messages,
      nextCursor,
      hasMore,
    });
  }

  if (req.method === "PUT") {
    const { status, reason } = req.body;

    if (status !== "CLOSED") {
      return res.status(400).json({ error: "Only CLOSED status is supported" });
    }

    const reasonValidated = validateText(reason, MAX_REASON_LEN, "reason");
    if (reasonValidated && typeof reasonValidated === "object") {
      return res.status(400).json({ error: reasonValidated.error });
    }

    const conversation = await prisma.conversation.findUnique({
      where: lookup,
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    if (conversation.status === "CLOSED") {
      return res.status(400).json({ error: "Conversation is already closed" });
    }

    // Wrap closure in transaction for atomicity
    const [, updated] = await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: session.user.id,
          // isSystem flags this row so the rendering layer can show the
          // admin/system marker from the column instead of the body prefix
          // (regular users are blocked from sending body text starting with
          // "[Admin]" so spoofing the same-looking message is impossible).
          isSystem: true,
          body:
            "This conversation has been closed by an administrator." +
            (reasonValidated ? ` Reason: ${reasonValidated}` : ""),
        },
      }),
      prisma.conversation.update({
        where: { id: conversation.id },
        data: { status: "CLOSED" },
      }),
      prisma.adminAction.create(
        buildAdminActionCreate(req, session, {
          action: "CLOSE_CONVERSATION",
          targetType: "CONVERSATION",
          targetId: conversation.publicId,
          details: {
            borrowerId: conversation.borrowerId,
            brokerId: conversation.brokerId,
            requestId: conversation.requestId,
          },
          reason: reasonValidated,
        }),
      ),
    ]);

    return res.status(200).json(updated);
  }

  return res.status(405).json({ error: "Method not allowed" });
}, { rateLimitGet: true });
