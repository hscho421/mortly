-- Standing admin-granted bonus credits, re-applied on top of the monthly tier
-- grant so renewals/tier-changes no longer silently wipe audited admin credit
-- adjustments (H5). Additive + idempotent.
ALTER TABLE "brokers" ADD COLUMN IF NOT EXISTS "bonusCredits" INTEGER NOT NULL DEFAULT 0;
