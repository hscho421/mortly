import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";

const INACTIVE_HOURS = 72;
const UNSTARTED_DAYS = 7;
const SYSTEM_USER_ID = "SYSTEM";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    let closedCount = 0;

    // 1. Close conversations inactive for 72+ hours
    const inactiveCutoff = new Date(Date.now() - INACTIVE_HOURS * 60 * 60 * 1000);
    const inactiveConversations = await prisma.conversation.findMany({
      where: {
        status: "ACTIVE",
        updatedAt: { lt: inactiveCutoff },
      },
      include: {
        request: { select: { id: true, borrowerId: true } },
      },
    });

    for (const convo of inactiveConversations) {
      // Find a valid senderId — use the borrower who owns the request
      const senderId = convo.request.borrowerId;

      await prisma.message.create({
        data: {
          conversationId: convo.id,
          senderId,
          body: "[System] This conversation was automatically closed due to inactivity.",
        },
      });

      await prisma.conversation.update({
        where: { id: convo.id },
        data: { status: "CLOSED" },
      });

      closedCount++;
    }

    // 2. Close conversations where borrower never engaged within 7 days of broker intro
    const unstartedCutoff = new Date(Date.now() - UNSTARTED_DAYS * 24 * 60 * 60 * 1000);

    // Find active conversations that were created more than 7 days ago
    // where the borrower has never sent a message
    const unstartedConversations = await prisma.conversation.findMany({
      where: {
        status: "ACTIVE",
        createdAt: { lt: unstartedCutoff },
      },
      include: {
        messages: {
          where: { senderId: { not: SYSTEM_USER_ID } },
          select: { senderId: true },
          take: 10,
        },
        request: { select: { id: true, borrowerId: true } },
      },
    });

    for (const convo of unstartedConversations) {
      // Check if the borrower has sent any messages in this conversation
      const borrowerSentMessage = convo.messages.some(
        (msg) => msg.senderId === convo.request.borrowerId
      );

      if (!borrowerSentMessage) {
        const senderId = convo.request.borrowerId;

        await prisma.message.create({
          data: {
            conversationId: convo.id,
            senderId,
            body: "[System] This conversation was automatically closed because the borrower did not respond within 7 days.",
          },
        });

        await prisma.conversation.update({
          where: { id: convo.id },
          data: { status: "CLOSED" },
        });

        closedCount++;
      }
    }

    // 3. For requests where ALL conversations are now CLOSED, update request status to CLOSED
    if (closedCount > 0) {
      // Get unique request IDs from all closed conversations
      const affectedRequestIds = new Set<string>();
      for (const convo of [...inactiveConversations, ...unstartedConversations]) {
        affectedRequestIds.add(convo.request.id);
      }

      for (const requestId of affectedRequestIds) {
        const activeConvoCount = await prisma.conversation.count({
          where: { requestId, status: "ACTIVE" },
        });

        if (activeConvoCount === 0) {
          // Check if the request has any conversations at all and is IN_PROGRESS
          const request = await prisma.borrowerRequest.findUnique({
            where: { id: requestId },
            select: { status: true, _count: { select: { conversations: true } } },
          });

          if (request && request.status === "IN_PROGRESS" && request._count.conversations > 0) {
            await prisma.borrowerRequest.update({
              where: { id: requestId },
              data: { status: "CLOSED" },
            });
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      closedConversations: closedCount,
    });
  } catch (error) {
    console.error("Error in /api/cron/auto-close-conversations:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
