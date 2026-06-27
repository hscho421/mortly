/**
 * Smoke-test verifier — prints the live billing state of one broker so you can
 * confirm what each Stripe webhook actually did to the database, instead of
 * eyeballing rows by hand. Run it after every step of the test-mode smoke test:
 *
 *   npm run verify:broker -- broker@example.com
 *
 * It reads DATABASE_URL from your environment (self-loading .env.local / .env if
 * present), so point it at the same database the deployed site writes to.
 *
 * Exit codes: 0 = printed, 2 = bad usage / no DB / broker not found.
 */
import { PrismaClient } from "@prisma/client";

// Self-load env without a dotenv dependency. Node 20.12+/21.7+ ships
// process.loadEnvFile; if DATABASE_URL is already exported we skip this entirely.
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

function row(label: string, value: unknown): string {
  return `  ${label.padEnd(22)} ${value === null || value === undefined ? "—" : String(value)}`;
}

function iso(d: Date | null | undefined): string | null {
  return d ? new Date(d).toISOString() : null;
}

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("usage: npm run verify:broker -- <broker-email>");
    process.exit(2);
  }
  if (!process.env.DATABASE_URL) {
    console.error(
      "verify:broker — DATABASE_URL is not set. Run with your env file, e.g.\n" +
        "  npx tsx --env-file=.env.local scripts/verify-broker.ts <email>",
    );
    process.exit(2);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { broker: { include: { subscription: true } } },
    });

    if (!user) {
      console.error(`No user found for ${email}.`);
      process.exit(2);
    }
    if (!user.broker) {
      console.error(`User ${email} exists (role=${user.role}) but has no broker profile.`);
      process.exit(2);
    }

    const b = user.broker;
    const s = b.subscription;
    const unlimited = b.responseCredits < 0;

    // Most recent processed webhook events (global — confirms deliveries are
    // landing and being recorded in the idempotency ledger).
    const events = await prisma.processedStripeEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
    });
    // Dunning / billing notices addressed to this broker's user.
    const notices = await prisma.adminNotice.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    console.log(`\n=== broker billing state — ${email} ===`);
    console.log(row("broker.id", b.id));
    console.log(row("subscriptionTier", b.subscriptionTier));
    console.log(row("responseCredits", unlimited ? `${b.responseCredits} (UNLIMITED)` : b.responseCredits));
    console.log(row("bonusCredits", b.bonusCredits));
    console.log(row("stripeCustomerId", b.stripeCustomerId));
    console.log(row("verificationStatus", b.verificationStatus));

    console.log(`\n--- subscription row ---`);
    if (!s) {
      console.log("  (none)");
    } else {
      console.log(row("tier", s.tier));
      console.log(row("status", s.status));
      console.log(row("stripeSubscriptionId", s.stripeSubscriptionId));
      console.log(row("stripePriceId", s.stripePriceId));
      console.log(row("currentPeriodStart", iso(s.currentPeriodStart)));
      console.log(row("currentPeriodEnd", iso(s.currentPeriodEnd)));
      console.log(row("cancelAtPeriodEnd", s.cancelAtPeriodEnd));
      console.log(row("pendingTier", s.pendingTier));
      console.log(row("startedAt", iso(s.startedAt)));
      console.log(row("endedAt", iso(s.endedAt)));
    }

    console.log(`\n--- recent processed Stripe events (global, newest first) ---`);
    if (events.length === 0) {
      console.log("  (none — no webhooks recorded yet)");
    } else {
      for (const e of events) {
        console.log(`  ${iso(e.createdAt)}  ${e.type.padEnd(34)} ${e.eventId}`);
      }
    }

    console.log(`\n--- notices to this broker (newest first) ---`);
    if (notices.length === 0) {
      console.log("  (none)");
    } else {
      for (const n of notices) {
        console.log(`  ${iso(n.createdAt)}  ${n.read ? "read " : "UNREAD"}  ${n.subject}`);
      }
    }
    console.log("");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("verify:broker error:", err);
  process.exit(2);
});
