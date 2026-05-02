import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { verifyCronRequest } from "@/lib/cron";

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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Accept GET (Vercel cron's only supported method — vercel.json has no
  // `method` field) and POST (for manual/curl runs from trusted env).
  // Image-preload exploitation isn't possible because the auth gate
  // requires the Authorization: Bearer header (which browsers refuse to
  // attach to <img> / <link> preloads) AND the platform-attached
  // `x-vercel-cron: 1` header (which browsers can't forge).
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!verifyCronRequest(req)) {
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
      const ids = inactiveConversations.map((c: { id: string }) => c.id);
      const result = await prisma.conversation.updateMany({
        where: { id: { in: ids }, status: "ACTIVE" },
        data: { status: "CLOSED", updatedAt: new Date() },
      });
      closedCount += result.count;
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
      const ids = toClose.map((c: { id: string }) => c.id);
      const result = await prisma.conversation.updateMany({
        where: { id: { in: ids }, status: "ACTIVE" },
        data: { status: "CLOSED", updatedAt: new Date() },
      });
      closedCount += result.count;
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
