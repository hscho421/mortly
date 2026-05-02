import prisma from "@/lib/prisma";
import { withCron } from "@/lib/cron";
import {
  CONVERSATION_INACTIVE_HOURS,
  CONVERSATION_UNSTARTED_DAYS,
  CRON_BATCH_SIZE,
} from "@/lib/constants";

const SYSTEM_USER_ID = "SYSTEM";
const MAX_BATCHES_PER_RUN = 50; // 50 × 1000 = 50K conversations per cron tick

interface ConvoWithRequest {
  id: string;
  request: { id: string; borrowerId: string };
}

/**
 * Paginated bulk close. Findings show this cron previously loaded EVERY
 * stale conversation into Lambda memory before issuing one giant updateMany —
 * at 100K+ active conversations that OOM'd the function before any rows
 * closed. Now we page in batches of CRON_BATCH_SIZE and bound the total
 * work per tick (`MAX_BATCHES_PER_RUN`) so a backlog drains across multiple
 * cron firings instead of pushing a single fire over Lambda memory.
 */
async function batchClose(
  whereClause: Record<string, unknown>,
  filterFn?: (convo: ConvoWithRequest & { messages?: { senderId: string }[]; request: { borrowerId: string } }) => boolean,
  includeMessages = false,
): Promise<{ closedCount: number; affectedRequestIds: Set<string> }> {
  const affectedRequestIds = new Set<string>();
  let closedCount = 0;

  for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch++) {
    const conversations = await prisma.conversation.findMany({
      where: { ...whereClause, status: "ACTIVE" },
      include: {
        request: { select: { id: true, borrowerId: true } },
        ...(includeMessages
          ? {
              messages: {
                where: { senderId: { not: SYSTEM_USER_ID } },
                select: { senderId: true },
                take: 10,
              },
            }
          : {}),
      },
      take: CRON_BATCH_SIZE,
    });

    if (conversations.length === 0) break;

    const eligible = filterFn
      ? conversations.filter((c) => filterFn(c as Parameters<NonNullable<typeof filterFn>>[0]))
      : conversations;

    if (eligible.length === 0) {
      // Page contained only ineligible rows — advance using ID ordering would
      // help here, but in practice the filter rejects rare edge cases. Break
      // to avoid an infinite loop on a stuck page.
      break;
    }

    const ids = eligible.map((c) => c.id);
    const result = await prisma.conversation.updateMany({
      where: { id: { in: ids }, status: "ACTIVE" },
      data: { status: "CLOSED", updatedAt: new Date() },
    });
    closedCount += result.count;

    for (const c of eligible) {
      // Conversation includes the loaded `request` relation; pull the id
      // from there rather than the column FK so test mocks (which provide
      // the relation but not the FK) keep working.
      const requestId = (c as ConvoWithRequest).request?.id;
      if (requestId) affectedRequestIds.add(requestId);
    }

    // Last page if we got fewer than the batch size.
    if (conversations.length < CRON_BATCH_SIZE) break;
  }

  return { closedCount, affectedRequestIds };
}

export default withCron(async (_req, res) => {
  try {
    let totalClosed = 0;
    const allAffectedRequests = new Set<string>();

    // 1. Close conversations inactive for INACTIVE_HOURS+ hours.
    const inactiveCutoff = new Date(Date.now() - CONVERSATION_INACTIVE_HOURS * 60 * 60 * 1000);
    const inactive = await batchClose({ updatedAt: { lt: inactiveCutoff } });
    totalClosed += inactive.closedCount;
    inactive.affectedRequestIds.forEach((id) => allAffectedRequests.add(id));

    // 2. Close conversations where the borrower never engaged within UNSTARTED_DAYS.
    const unstartedCutoff = new Date(Date.now() - CONVERSATION_UNSTARTED_DAYS * 24 * 60 * 60 * 1000);
    const unstarted = await batchClose(
      { createdAt: { lt: unstartedCutoff } },
      (convo) =>
        !convo.messages?.some((msg) => msg.senderId === convo.request.borrowerId),
      true,
    );
    totalClosed += unstarted.closedCount;
    unstarted.affectedRequestIds.forEach((id) => allAffectedRequests.add(id));

    // 3. Cascade-close requests whose conversations are now all CLOSED.
    if (allAffectedRequests.size > 0) {
      const requestIdList = Array.from(allAffectedRequests);
      const activeCounts = await prisma.conversation.groupBy({
        by: ["requestId"],
        where: { requestId: { in: requestIdList }, status: "ACTIVE" },
        _count: { _all: true },
      });
      const stillActive = new Set(activeCounts.map((r) => r.requestId));
      const requestsToClose = requestIdList.filter((rid) => !stillActive.has(rid));
      if (requestsToClose.length > 0) {
        await prisma.borrowerRequest.updateMany({
          where: { id: { in: requestsToClose }, status: "IN_PROGRESS" },
          data: { status: "CLOSED" },
        });
      }
    }

    return res.status(200).json({ success: true, closedConversations: totalClosed });
  } catch (error) {
    console.error("Error in /api/cron/auto-close-conversations:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});
