-- Engineering audit Phase 1 — DB schema changes for query efficiency,
-- denormalization, idempotency, and stricter typing.

-- 1. BorrowerRequest: add standalone status index for admin tabs / broker browse.
CREATE INDEX "borrower_requests_status_idx" ON "borrower_requests" ("status");

-- 2. Conversation: denormalized message counters so the spam-guard in
-- /api/messages doesn't need a groupBy over full message history per send.
ALTER TABLE "conversations" ADD COLUMN "broker_msg_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "conversations" ADD COLUMN "borrower_msg_count" INTEGER NOT NULL DEFAULT 0;

-- Backfill from existing data so the counters are correct from day one.
UPDATE "conversations" c
SET "broker_msg_count" = COALESCE(sub.broker_count, 0),
    "borrower_msg_count" = COALESCE(sub.borrower_count, 0)
FROM (
  SELECT
    m."conversationId" AS conversation_id,
    SUM(CASE WHEN m."senderId" = c2."borrowerId" THEN 1 ELSE 0 END) AS borrower_count,
    SUM(CASE WHEN m."senderId" != c2."borrowerId" THEN 1 ELSE 0 END) AS broker_count
  FROM "messages" m
  JOIN "conversations" c2 ON c2.id = m."conversationId"
  GROUP BY m."conversationId"
) sub
WHERE c.id = sub.conversation_id;

-- 3. Message.body: enforce 5000-char limit at DB level.
-- Existing rows that exceed get truncated — pre-launch + the app already
-- enforced 5000 in /api/messages, so this should be a no-op on real data.
ALTER TABLE "messages" ALTER COLUMN "body" TYPE VARCHAR(5000);

-- 4. Report.targetType: convert from String to enum.
-- Backfill case-mixed values to the canonical UPPER form first, then ALTER.
UPDATE "reports" SET "targetType" = UPPER("targetType");

CREATE TYPE "ReportTargetType" AS ENUM ('BROKER', 'REQUEST', 'CONVERSATION', 'USER');

ALTER TABLE "reports"
  ALTER COLUMN "targetType" TYPE "ReportTargetType"
  USING "targetType"::"ReportTargetType";

-- 5. AdminNotice idempotency key — optional column, unique when present.
-- Postgres treats multiple NULLs as distinct so existing rows are unaffected.
ALTER TABLE "admin_notices" ADD COLUMN "dedupe_key" TEXT;
CREATE UNIQUE INDEX "admin_notices_dedupe_key_key" ON "admin_notices" ("dedupe_key");
