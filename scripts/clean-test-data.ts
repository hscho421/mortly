/**
 * Delete test broker/user accounts and their full dependency graph from the DB.
 * For post-smoke-test cleanup of the (not-yet-live) prod database.
 *
 *   npm run clean:test-data -- a@x.com b@x.com          # DRY RUN — prints what it would delete
 *   npm run clean:test-data -- a@x.com b@x.com --confirm # actually deletes
 *
 * Only the emails you pass are touched — there is no hardcoded list, so it can't
 * surprise you. Each account is deleted in one transaction (FK-safe order); if any
 * step fails, that account rolls back wholesale and the others are unaffected.
 *
 * Cascade (auto) covers DeviceToken / UserBlock / BrokerRequestSeen; everything
 * else is deleted explicitly first.
 *
 * Exit codes: 0 = done (or dry run), 2 = bad usage / no DB.
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
  const args = process.argv.slice(2);
  const confirm = args.includes("--confirm");
  const emails = args.filter((a) => !a.startsWith("--"));

  if (emails.length === 0) {
    console.error(
      "usage: npm run clean:test-data -- <email> [<email>…] [--confirm]\n" +
        "(without --confirm it only prints what it would delete)",
    );
    process.exit(2);
  }
  if (!process.env.DATABASE_URL) {
    console.error("clean:test-data — DATABASE_URL is not set.");
    process.exit(2);
  }

  const prisma = new PrismaClient();
  try {
    for (const email of emails) {
      const user = await prisma.user.findUnique({
        where: { email },
        include: { broker: { select: { id: true } }, borrowerRequests: { select: { id: true } } },
      });
      if (!user) {
        console.log(`• ${email} — not found, skipping.`);
        continue;
      }
      const brokerId = user.broker?.id ?? null;
      const requestIds = user.borrowerRequests.map((r) => r.id);

      const convos = await prisma.conversation.findMany({
        where: {
          OR: [
            { borrowerId: user.id },
            ...(brokerId ? [{ brokerId }] : []),
            ...(requestIds.length ? [{ requestId: { in: requestIds } }] : []),
          ],
        },
        select: { id: true },
      });
      const convoIds = convos.map((c) => c.id);

      const [messages, notices, reports] = await Promise.all([
        prisma.message.count({
          where: { OR: [{ senderId: user.id }, { conversationId: { in: convoIds } }] },
        }),
        prisma.adminNotice.count({ where: { OR: [{ userId: user.id }, { adminId: user.id }] } }),
        prisma.report.count({ where: { reporterId: user.id } }),
      ]);

      console.log(
        `• ${email} (user ${user.id}, role ${user.role})` +
          `\n    broker: ${brokerId ?? "none"}` +
          `\n    conversations: ${convoIds.length}, messages: ${messages}, ` +
          `notices: ${notices}, reports: ${reports}, borrowerRequests: ${requestIds.length}`,
      );

      if (!confirm) continue;

      await prisma.$transaction(async (tx) => {
        await tx.message.deleteMany({
          where: { OR: [{ senderId: user.id }, { conversationId: { in: convoIds } }] },
        });
        await tx.conversation.deleteMany({ where: { id: { in: convoIds } } });
        if (brokerId) await tx.subscription.deleteMany({ where: { brokerId } });
        await tx.adminNotice.deleteMany({ where: { OR: [{ userId: user.id }, { adminId: user.id }] } });
        await tx.adminAction.deleteMany({ where: { adminId: user.id } });
        await tx.report.deleteMany({ where: { reporterId: user.id } });
        await tx.borrowerRequest.deleteMany({ where: { borrowerId: user.id } });
        if (brokerId) await tx.broker.delete({ where: { id: brokerId } });
        await tx.user.delete({ where: { id: user.id } });
      });
      console.log(`    ✓ deleted.`);
    }

    if (!confirm) {
      console.log("\nDRY RUN — re-run with --confirm to delete the above.");
    } else {
      console.log("\nDone. (ProcessedStripeEvent rows are global and not tied to a broker — clear them separately if desired.)");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("clean:test-data error:", err);
  process.exit(2);
});
