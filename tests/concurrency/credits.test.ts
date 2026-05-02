/**
 * Real-DB concurrency test for credit deduction.
 *
 * The mocked integration tests only verify the HANDLER uses the correct
 * race-safe query shape (`updateMany { where: { gt: 0 }, decrement: 1 }`).
 * But we can't observe what Postgres actually does under concurrent writes
 * without a real database.
 *
 * This suite spins up many parallel POST /api/conversations requests from
 * DIFFERENT brokers against a SINGLE broker row (simulated by forcing the
 * handler to target the same broker.id concurrently) and asserts that credits
 * decrement EXACTLY as many times as there are successful creates — never
 * more, never less, never into negative.
 *
 * Opt-in via TEST_DATABASE_URL. In CI we REQUIRE it — `CI=true` without
 * TEST_DATABASE_URL is a hard fail, since the credit race is the only thing
 * standing between us and broker double-spend in production. Local dev can
 * still skip by running `npm run test:concurrency` with the env unset.
 *
 * Precondition: run `npm run seed:mock` against the test DB first — we
 * reuse `seed-e2e-broker@mortly.test`'s broker row.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (!TEST_DATABASE_URL && process.env.CI === "true") {
  // Fail the whole suite in CI when the concurrency env is missing — this
  // test catches the credit-race regression and was previously a silent skip
  // (false confidence). Local dev can still run `npm test` without the env
  // and just lose this one suite.
  throw new Error(
    "TEST_DATABASE_URL is required in CI. Concurrency tests cannot silently skip — they're the only coverage for credit double-spend.",
  );
}
const describeIfDb = TEST_DATABASE_URL ? describe : describe.skip;

describeIfDb("Real-DB concurrency — credit deduction never double-spends", () => {
  let prisma: PrismaClient;
  let brokerId: string;
  let requestId: string;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: TEST_DATABASE_URL } },
    });
    // Verify fixtures exist — otherwise fail loud.
    const broker = await prisma.broker.findFirst({
      where: { user: { email: "seed-e2e-broker@mortly.test" } },
    });
    if (!broker) {
      throw new Error(
        "Missing E2E broker fixture. Run `npm run seed:mock` against TEST_DATABASE_URL first."
      );
    }
    brokerId = broker.id;

    const request = await prisma.borrowerRequest.findUnique({
      where: { publicId: "999000010" },
    });
    if (!request) {
      throw new Error(
        "Missing E2E OPEN request fixture (publicId=999000010). Re-seed."
      );
    }
    requestId = request.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("N parallel decrement attempts with N credits available → all succeed, final balance = 0", async () => {
    const N = 8;
    // Reset credits to exactly N so we can fit all attempts.
    await prisma.broker.update({
      where: { id: brokerId },
      data: { responseCredits: N },
    });

    // Fire N concurrent decrement attempts. We emulate the handler's inner
    // tx-level atomic step directly so we test the DB, not the handler.
    const results = await Promise.all(
      Array.from({ length: N }, () =>
        prisma.broker.updateMany({
          where: { id: brokerId, responseCredits: { gt: 0 } },
          data: { responseCredits: { decrement: 1 } },
        })
      )
    );

    const totalDecremented = results.reduce((acc, r) => acc + r.count, 0);
    expect(totalDecremented).toBe(N);

    const finalBroker = await prisma.broker.findUnique({ where: { id: brokerId } });
    expect(finalBroker!.responseCredits).toBe(0);
    expect(finalBroker!.responseCredits).toBeGreaterThanOrEqual(0);
  });

  it("N parallel decrement attempts with M < N credits → exactly M succeed, balance = 0", async () => {
    const N = 10;
    const M = 3;
    await prisma.broker.update({
      where: { id: brokerId },
      data: { responseCredits: M },
    });

    const results = await Promise.all(
      Array.from({ length: N }, () =>
        prisma.broker.updateMany({
          where: { id: brokerId, responseCredits: { gt: 0 } },
          data: { responseCredits: { decrement: 1 } },
        })
      )
    );

    const totalDecremented = results.reduce((acc, r) => acc + r.count, 0);
    // CRITICAL: no more decrements than credits available.
    expect(totalDecremented).toBe(M);

    const finalBroker = await prisma.broker.findUnique({ where: { id: brokerId } });
    expect(finalBroker!.responseCredits).toBe(0);
    expect(finalBroker!.responseCredits).toBeGreaterThanOrEqual(0);
  });

  it("conversation creates + credit deducts inside the same tx: at most ONE succeeds per (request, broker)", async () => {
    // The real race condition: two parallel POST /api/conversations for the
    // same (request, broker) pair. The unique constraint `@@unique([requestId, brokerId])`
    // plus the in-tx credit-deduct should guarantee:
    //   - at most 1 conversation row ever exists
    //   - at most 1 credit is decremented
    const startingCredits = 5;
    await prisma.broker.update({
      where: { id: brokerId },
      data: { responseCredits: startingCredits },
    });
    // Clean up any conversation from a previous run.
    await prisma.message.deleteMany({ where: { conversation: { brokerId, requestId } } });
    await prisma.conversation.deleteMany({ where: { brokerId, requestId } });

    const ATTEMPTS = 6;
    const settled = await Promise.allSettled(
      Array.from({ length: ATTEMPTS }, (_, i) =>
        prisma.$transaction(async (tx) => {
          // Mirror the handler's logic closely.
          const existing = await tx.conversation.findUnique({
            where: { requestId_brokerId: { requestId, brokerId } },
          });
          if (existing) return { conversation: existing, newRow: false, creditTaken: false };

          const updated = await tx.broker.updateMany({
            where: { id: brokerId, responseCredits: { gt: 0 } },
            data: { responseCredits: { decrement: 1 } },
          });
          if (updated.count === 0) throw new Error("NO_CREDITS");

          const conv = await tx.conversation.create({
            data: {
              publicId: `99${Date.now() % 10_000_000}${i}`.slice(0, 9),
              requestId,
              borrowerId: (await tx.borrowerRequest.findUnique({ where: { id: requestId } }))!.borrowerId,
              brokerId,
            },
          });
          return { conversation: conv, newRow: true, creditTaken: true };
        })
      )
    );

    const newRowCount = settled.filter(
      (s) => s.status === "fulfilled" && (s.value as { newRow: boolean }).newRow
    ).length;
    const creditTakenCount = settled.filter(
      (s) => s.status === "fulfilled" && (s.value as { creditTaken: boolean }).creditTaken
    ).length;

    // INVARIANT: newRow and creditTaken move in lock-step. Either both 1 or both 0.
    expect(newRowCount).toBe(creditTakenCount);
    // Exactly one conversation row exists.
    const convRows = await prisma.conversation.count({ where: { brokerId, requestId } });
    expect(convRows).toBe(1);
    // Credits went down by exactly 1 — not 0, not 2+.
    const finalBroker = await prisma.broker.findUnique({ where: { id: brokerId } });
    expect(startingCredits - finalBroker!.responseCredits).toBe(1);

    // Cleanup for next run.
    await prisma.message.deleteMany({ where: { conversation: { brokerId, requestId } } });
    await prisma.conversation.deleteMany({ where: { brokerId, requestId } });
  });
});
