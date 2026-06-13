import prisma from "@/lib/prisma";
import { withCron } from "@/lib/cron";
import { notifyConversations } from "@/lib/realtime";
import {
  CONVERSATION_INACTIVE_HOURS,
  CONVERSATION_UNSTARTED_DAYS,
  CRON_BATCH_SIZE,
} from "@/lib/constants";

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
 *
 * Each closed conversation gets a bilingual system message (so participants
 * see WHY the thread ended instead of a silently disabled input) and a
 * realtime nudge so open tabs refresh.
 */
async function batchClose(
  whereClause: Record<string, unknown>,
  systemMessage: string,
): Promise<{ closedCount: number; affectedRequestIds: Set<string> }> {
  const affectedRequestIds = new Set<string>();
  let closedCount = 0;

  for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch++) {
    const conversations = await prisma.conversation.findMany({
      where: { ...whereClause, status: "ACTIVE" },
      include: {
        request: { select: { id: true, borrowerId: true } },
      },
      take: CRON_BATCH_SIZE,
    });

    if (conversations.length === 0) break;

    const ids = conversations.map((c) => c.id);
    const result = await prisma.conversation.updateMany({
      where: { id: { in: ids }, status: "ACTIVE" },
      data: { status: "CLOSED", updatedAt: new Date() },
    });
    closedCount += result.count;

    // System message per closed thread. Message.senderId is a required FK,
    // so attribute cron closes to the request's borrower with isSystem=true
    // (same pattern as the borrower-initiated close in /api/requests/[id]).
    await prisma.message.createMany({
      data: conversations
        .filter((c) => (c as ConvoWithRequest).request?.borrowerId)
        .map((c) => ({
          conversationId: c.id,
          senderId: (c as ConvoWithRequest).request.borrowerId,
          isSystem: true,
          body: systemMessage,
        })),
    });

    // Nudge open tabs so the closed state + system message appear without a
    // manual refresh. Fire-and-forget by design.
    notifyConversations(ids);

    for (const c of conversations) {
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
    const inactive = await batchClose(
      { updatedAt: { lt: inactiveCutoff } },
      "This conversation was closed due to inactivity. / 장기간 활동이 없어 대화가 종료되었습니다.",
    );
    totalClosed += inactive.closedCount;
    inactive.affectedRequestIds.forEach((id) => allAffectedRequests.add(id));

    // 2. Close conversations where the borrower never engaged within
    // UNSTARTED_DAYS. "Never engaged" = the denormalized borrowerMsgCount is
    // still 0 — exact, and replaces the previous broken heuristic
    // (senderId != "SYSTEM" excluded nothing since system messages carry a
    // real user id, and the unordered take:10 sample could miss the
    // borrower's messages entirely on broker-heavy threads).
    const unstartedCutoff = new Date(Date.now() - CONVERSATION_UNSTARTED_DAYS * 24 * 60 * 60 * 1000);
    const unstarted = await batchClose(
      { createdAt: { lt: unstartedCutoff }, borrowerMsgCount: 0 },
      "This conversation was closed because it never started. / 대화가 시작되지 않아 종료되었습니다.",
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
