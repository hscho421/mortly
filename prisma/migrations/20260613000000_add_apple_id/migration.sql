-- Backfill migration for Apple OAuth (schema.prisma has declared User.appleId
-- since commit 9787476, but no migration was ever generated — environments
-- provisioned with `prisma migrate deploy` were missing the column the Apple
-- OAuth paths query). If the column already exists in an environment (added
-- via `prisma db push` or manual SQL), mark this migration applied instead of
-- running it: `npx prisma migrate resolve --applied 20260613000000_add_apple_id`.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "appleId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "users_appleId_key" ON "users"("appleId");
