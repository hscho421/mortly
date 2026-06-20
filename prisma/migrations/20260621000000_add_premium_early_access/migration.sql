-- PREMIUM early-access window for borrower requests.
-- approvedAt: when the request entered OPEN (window start).
-- premiumReleasedAt: one-way latch — null = PREMIUM-only, non-null = released to all.
-- Idempotent (IF NOT EXISTS) so environments provisioned via `prisma db push`
-- or manual SQL can `prisma migrate resolve --applied` instead of re-running.

ALTER TABLE "borrower_requests" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "borrower_requests" ADD COLUMN IF NOT EXISTS "premiumReleasedAt" TIMESTAMP(3);

-- Backfill: existing OPEN requests are already public — mark them released so
-- the new feed gate never retroactively hides a live lead. approvedAt is set to
-- createdAt as the best available proxy for when it went live.
UPDATE "borrower_requests"
  SET "premiumReleasedAt" = NOW(),
      "approvedAt" = "createdAt"
  WHERE "status" = 'OPEN' AND "premiumReleasedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "borrower_requests_status_premiumReleasedAt_idx"
  ON "borrower_requests"("status", "premiumReleasedAt");
