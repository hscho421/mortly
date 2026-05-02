import prisma from "@/lib/prisma";
import { getSettingInt } from "@/lib/settings";
import { sendPushToUsers, messagePush } from "@/lib/push";
import { withAuth } from "@/lib/withAuth";

// 30 messages/min per sender — enough for normal back-and-forth, blocks
// chat-flooding spam. The 3-message broker spam guard below remains in
// place for the early-conversation case.
export default withAuth(async (req, res, session) => {
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
      // Block users from impersonating system/admin tags. Real system messages
      // are written via prisma.message.create({ ..., isSystem: true }) by the
      // server; the rendering layer reads the column, never the body prefix.
      if (/^\s*\[(?:admin|system)\]/i.test(trimmed)) {
        return res.status(400).json({ error: "Message cannot start with a system tag" });
      }

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          broker: {
            select: {
              userId: true,
              brokerageName: true,
              user: { select: { name: true } },
            },
          },
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

      // Block check — refuse to deliver new messages between blocked users
      // (in either direction). Existing message history stays intact, but
      // no new messages can be added once blocked. Apple guideline 1.2.
      const otherUserId =
        session.user.id === conversation.borrowerId
          ? conversation.broker.userId
          : conversation.borrowerId;
      const blocked = await prisma.userBlock.findFirst({
        where: {
          OR: [
            { blockerId: session.user.id, blockedId: otherUserId },
            { blockerId: otherUserId, blockedId: session.user.id },
          ],
        },
      });
      if (blocked) {
        return res.status(403).json({ error: "Cannot send messages to this user" });
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

      // Fire-and-forget push to the other participant. Title must be the
      // sender's personal name (broker.user.name), not the brokerage name —
      // the brokerageName is only a fallback when the user hasn't set a name.
      const recipientUserId = isBorrower
        ? conversation.broker.userId
        : conversation.borrowerId;
      const senderName = isBorrower
        ? conversation.borrower?.name || "Client"
        : conversation.broker.user?.name ||
          conversation.broker.brokerageName ||
          "Broker";
      sendPushToUsers({
        userIds: [recipientUserId],
        content: messagePush(senderName, trimmed),
        data: {
          // Intentionally minimal — no sender name, no message body. The deep
          // link drives the user back into the app where the chat content
          // lives behind auth.
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
}, { rateLimit: { perMinute: 30, bucket: "messages" } });

