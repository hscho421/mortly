import type { NextApiRequest, NextApiResponse } from "next";
import { timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";

const INACTIVE_HOURS = 72;
const UNSTARTED_DAYS = 7;
const SYSTEM_USER_ID = "SYSTEM";

interface ConvoWithRequest {
  id: string;
  request: { id: string; borrowerId: string };
}
interface ConvoWithMessages extends ConvoWithRequest {
  messages: { senderId: string }[];
}

function verifyCronSecret(authHeader: string | undefined): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authHeader) return false;
  const token = authHeader.replace("Bearer ", "");
  if (token.length !== secret.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(secret));
  } catch {
    return false;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!verifyCronSecret(req.headers.authorization)) {
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

    if (inactiveConversations.length > 0) {
      const succeededIds: string[] = [];
      for (const convo of inactiveConversations) {
        try {
          await prisma.conversation.update({
            where: { id: convo.id },
            data: { status: "CLOSED" },
          });
          succeededIds.push(convo.id);
        } catch (err) {
          console.error(`Failed to close inactive conversation ${convo.id}:`, err);
        }
      }
      closedCount += succeededIds.length;
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

    const toClose = unstartedConversations.filter(
      (convo: ConvoWithMessages) => !convo.messages.some((msg: { senderId: string }) => msg.senderId === convo.request.borrowerId)
    );

    if (toClose.length > 0) {
      const succeededIds: string[] = [];
      for (const convo of toClose) {
        try {
          await prisma.conversation.update({
            where: { id: convo.id },
            data: { status: "CLOSED" },
          });
          succeededIds.push(convo.id);
        } catch (err) {
          console.error(`Failed to close unstarted conversation ${convo.id}:`, err);
        }
      }
      closedCount += succeededIds.length;
    }

    // 3. For requests where ALL conversations are now CLOSED, update request status to CLOSED
    if (closedCount > 0) {
      // Get unique request IDs from all closed conversations
      const affectedRequestIds = new Set<string>();
      for (const convo of [...inactiveConversations, ...unstartedConversations]) {
        affectedRequestIds.add(convo.request.id);
      }

      // Batch check: find requests with zero active conversations
      const requestIdList = Array.from(affectedRequestIds);
      const activeCounts = await prisma.conversation.groupBy({
        by: ["requestId"],
        where: { requestId: { in: requestIdList }, status: "ACTIVE" },
        _count: { _all: true },
      });
      const activeCountMap = new Map(activeCounts.map((r: { requestId: string; _count: { _all: number } }) => [r.requestId, r._count._all]));

      const requestsToClose = requestIdList.filter((rid) => !activeCountMap.has(rid) || activeCountMap.get(rid) === 0);

      if (requestsToClose.length > 0) {
        // Only close IN_PROGRESS requests that have conversations
        await prisma.borrowerRequest.updateMany({
          where: {
            id: { in: requestsToClose },
            status: "IN_PROGRESS",
          },
          data: { status: "CLOSED" },
        });
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
