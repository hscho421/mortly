-- Security hardening Phase 2 — schema changes for revocable JWTs, brute-force
-- counters, system-message flag, Stripe webhook idempotency, and case-insensitive
-- email uniqueness.

-- 1. User additions
ALTER TABLE "users" ADD COLUMN "verificationAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- 2. Lowercase all existing emails so the functional unique index below succeeds.
-- Pre-launch: any duplicate-by-lower-case rows would be unexpected; the index
-- creation will fail and surface them rather than silently merge.
UPDATE "users" SET "email" = LOWER("email");

-- 3. Functional unique index on email — case-insensitive uniqueness.
-- The plain `users_email_key` from the original schema stays in place (unique
-- on the now-lowercased column) so direct equality lookups still hit an index.
CREATE UNIQUE INDEX "users_email_lower_key" ON "users" (LOWER("email"));

-- 4. Message: system flag. Default false preserves all current rows.
ALTER TABLE "messages" ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- 5. Stripe webhook idempotency ledger.
CREATE TABLE "processed_stripe_events" (
  "eventId"   TEXT      NOT NULL,
  "type"      TEXT      NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "processed_stripe_events_pkey" PRIMARY KEY ("eventId")
);
CREATE INDEX "processed_stripe_events_createdAt_idx" ON "processed_stripe_events" ("createdAt");
