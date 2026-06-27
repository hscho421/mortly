/**
 * Dev helper for the test-mode Stripe smoke test.
 *
 * Sets a broker's stripeCustomerId so the next Stripe Checkout REUSES that
 * customer instead of minting a fresh one (create-checkout.ts only creates a
 * customer when broker.stripeCustomerId is null). Used to bind a broker to a
 * test-clock customer before subscribing, so the renewal can be fast-forwarded.
 *
 *   npm run set:customer -- broker@example.com cus_XXXX
 *
 * TEST DATABASE ONLY. Refuses if the broker already has a non-cancelled
 * subscription, so it can't silently strand a live billing relationship.
 *
 * Exit codes: 0 = done, 2 = bad usage / no DB / broker not found / unsafe.
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
  const email = process.argv[2];
  const customerId = process.argv[3];
  if (!email || !customerId) {
    console.error("usage: npm run set:customer -- <broker-email> <cus_id>");
    process.exit(2);
  }
  if (!customerId.startsWith("cus_")) {
    console.error(`Refusing: "${customerId}" doesn't look like a Stripe customer id (cus_…).`);
    process.exit(2);
  }
  if (!process.env.DATABASE_URL) {
    console.error("set:customer — DATABASE_URL is not set.");
    process.exit(2);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { broker: { include: { subscription: true } } },
    });
    if (!user?.broker) {
      console.error(`No broker profile for ${email}.`);
      process.exit(2);
    }
    const status = user.broker.subscription?.status;
    if (status && status !== "CANCELLED" && status !== "EXPIRED") {
      console.error(
        `Refusing: ${email} has a ${status} subscription. Rebinding its customer id ` +
          "would strand that subscription. Use a fresh broker with no active plan.",
      );
      process.exit(2);
    }

    await prisma.broker.update({
      where: { id: user.broker.id },
      data: { stripeCustomerId: customerId },
    });
    console.log(
      `Set ${email} (broker ${user.broker.id}) stripeCustomerId = ${customerId}.\n` +
        "Now subscribe on the site as this broker — Checkout will reuse the test-clock customer.",
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("set:customer error:", err);
  process.exit(2);
});
