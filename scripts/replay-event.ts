/**
 * Dev helper for the test-mode Stripe smoke test.
 *
 * Deletes one ProcessedStripeEvent ledger row so a subsequent
 * `stripe events resend <id>` is RE-PROCESSED by the webhook handler instead of
 * short-circuiting as a duplicate (pages/api/webhooks/stripe.ts idempotency gate).
 *
 *   npm run replay:event -- evt_xxx
 *   stripe events resend evt_xxx
 *
 * TEST DATABASE ONLY — never point this at a live production ledger. Deleting one
 * row by exact event id is low-risk (the webhook handlers are idempotent, so a
 * reprocessed event converges to the same state), but it is still a dev-only tool.
 *
 * Exit codes: 0 = done, 2 = bad usage / no DB.
 */
import { PrismaClient } from "@prisma/client";

function loadEnv(): void {
  if (process.env.DATABASE_URL) return;
  const loader = (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile;
  if (typeof loader !== "function") return;
  for (const file of [".env.local", ".env"]) {
    try {
      loader.call(process, file);
      if (process.env.DATABASE_URL) return;
    } catch {
      /* file absent — try the next one */
    }
  }
}
loadEnv();

async function main() {
  const eventId = process.argv[2];
  if (!eventId) {
    console.error("usage: npm run replay:event -- <evt_id>");
    process.exit(2);
  }
  if (!process.env.DATABASE_URL) {
    console.error("replay:event — DATABASE_URL is not set.");
    process.exit(2);
  }

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.processedStripeEvent.findUnique({ where: { eventId } });
    if (!existing) {
      console.log(`No ledger row for ${eventId} — nothing to delete (resend will process it fresh).`);
      return;
    }
    await prisma.processedStripeEvent.delete({ where: { eventId } });
    console.log(
      `Deleted ledger row { eventId: ${eventId}, type: ${existing.type} }.\n` +
        `Now run:  stripe events resend ${eventId}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("replay:event error:", err);
  process.exit(2);
});
