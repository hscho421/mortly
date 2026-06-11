import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { withCron } from "@/lib/cron";
import { getSettingInt } from "@/lib/settings";

const BATCH = 500;
const MAX_BATCHES = 50; // up to 25K requests/run; backlog drains across daily firings
const REDACTED = "[redacted for privacy]";

/**
 * PIPEDA Principle 5 — Limiting Retention.
 *
 * `expire-requests` / `auto-close-conversations` only flip status; they never
 * erase data, so borrower financial dossiers (BorrowerRequest.details / notes)
 * and chat message bodies persisted in plaintext indefinitely. This cron
 * anonymizes terminal-status requests once they pass the configured retention
 * window: it nulls the request's financial fields and redacts the non-system
 * message bodies in those requests' conversations.
 *
 * Anonymize (not hard-delete) so AdminAction / Report rows that reference the
 * request keep referential integrity — only the sensitive payload is erased.
 *
 * Idempotent + self-paginating: once a request is purged it no longer matches
 * the `OR(notes / details not null)` filter, so it drops out of subsequent
 * batches and future runs automatically (no cursor / marker column needed).
 */
export default withCron(async (_req, res) => {
  const retentionDays = await getSettingInt("request_retention_days");
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  let purgedRequests = 0;
  let redactedMessages = 0;

  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const stale = await prisma.borrowerRequest.findMany({
      where: {
        status: { in: ["EXPIRED", "CLOSED", "REJECTED"] },
        updatedAt: { lt: cutoff },
        // Only rows that still hold PII — purged rows fall out of this filter.
        OR: [{ notes: { not: null } }, { details: { not: Prisma.AnyNull } }],
      },
      select: { id: true },
      take: BATCH,
    });
    if (stale.length === 0) break;
    const ids = stale.map((r) => r.id);

    // Redact non-system message bodies in those requests' conversations.
    const convos = await prisma.conversation.findMany({
      where: { requestId: { in: ids } },
      select: { id: true },
    });
    if (convos.length > 0) {
      const redaction = await prisma.message.updateMany({
        where: {
          conversationId: { in: convos.map((c) => c.id) },
          isSystem: false,
          body: { not: REDACTED },
        },
        data: { body: REDACTED },
      });
      redactedMessages += redaction.count;
    }

    // Erase the financial payload on the requests themselves.
    const purge = await prisma.borrowerRequest.updateMany({
      where: { id: { in: ids } },
      data: { details: Prisma.DbNull, notes: null },
    });
    purgedRequests += purge.count;

    if (stale.length < BATCH) break;
  }

  return res.status(200).json({ success: true, purgedRequests, redactedMessages });
});
