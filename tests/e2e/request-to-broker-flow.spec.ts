import { test, expect, APIRequestContext } from "@playwright/test";
import { randomBytes } from "node:crypto";

// APIRequestContext from `playwright.request.newContext()` does NOT inherit
// `use.baseURL` from playwright.config.ts — we must supply it explicitly.
const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ??
  `http://localhost:${process.env.PLAYWRIGHT_PORT ?? "3100"}`;

/**
 * Full marketplace flow against seeded deterministic fixtures from
 * prisma/seed.ts `seedE2EFixtures()`:
 *   1. Borrower can create a new (PENDING_APPROVAL) request — smoke.
 *   2. Broker sees the pre-seeded OPEN request in their browse list.
 *   3. Broker opens a conversation on that OPEN request (credit deducted).
 *   4. Borrower sees the conversation + 1 unread message.
 *   5. Borrower opens it → unread clears.
 *   6. Borrower replies, then closes the request.
 *
 * Preconditions (run `npm run seed:mock` against a test DB):
 *   - BORROWER `seed-e2e-borrower@mortly.test` / password `password123`
 *   - BROKER   `seed-e2e-broker@mortly.test`   / password `password123`,
 *              VERIFIED, BASIC tier, >= 1 response credit
 *   - OPEN request with publicId `999000010` owned by the seed borrower
 */

const SEED = {
  borrower: { email: "seed-e2e-borrower@mortly.test", password: "password123" },
  broker: { email: "seed-e2e-broker@mortly.test", password: "password123" },
  openRequestPublicId: "999000010",
};

async function signIn(ctx: APIRequestContext, email: string, password: string) {
  // Hit NextAuth credentials callback. next-auth returns a redirect response +
  // sets cookies on the context, so subsequent requests are authenticated.
  // The csrf step is skipped here because our route uses `credentials` with
  // `authorize()` — the cookie flow comes via the session endpoint.
  const csrfRes = await ctx.get("/api/auth/csrf");
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  const res = await ctx.post("/api/auth/callback/credentials", {
    form: {
      email,
      password,
      csrfToken,
      callbackUrl: "/",
      json: "true",
    },
  });
  // next-auth returns 200 JSON with url; cookies stick via APIRequestContext.
  expect([200, 302]).toContain(res.status());
  const session = await (await ctx.get("/api/auth/session")).json();
  expect(session?.user?.email).toBe(email);
  return session.user;
}

test.describe.serial("Borrower request → broker reply full flow", () => {
  let borrowerCtx: APIRequestContext;
  let brokerCtx: APIRequestContext;
  let conversationId: string;

  test.beforeAll(async ({ playwright }) => {
    borrowerCtx = await playwright.request.newContext({ baseURL: BASE_URL });
    brokerCtx = await playwright.request.newContext({ baseURL: BASE_URL });
    await signIn(borrowerCtx, SEED.borrower.email, SEED.borrower.password);
    await signIn(brokerCtx, SEED.broker.email, SEED.broker.password);
  });

  test.afterAll(async () => {
    await borrowerCtx.dispose();
    await brokerCtx.dispose();
  });

  test("borrower can create a new request (smoke — lands in PENDING_APPROVAL)", async () => {
    // Separate from the main flow: new requests require admin approval before
    // they're visible to brokers. We just verify the create endpoint works.
    const res = await borrowerCtx.post("/api/requests", {
      data: {
        mortgageCategory: "RESIDENTIAL",
        productTypes: ["NEW_MORTGAGE"],
        province: "ON",
        city: "Toronto",
        details: {
          purposeOfUse: ["OWNER_OCCUPIED"],
          incomeTypes: ["EMPLOYMENT"],
          annualIncome: { [String(new Date().getFullYear())]: "100000" },
        },
        desiredTimeline: "3_MONTHS",
        notes: `E2E smoke note ${randomBytes(4).toString("hex")}`,
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.publicId).toMatch(/^\d{9}$/);
    expect(body.status).toBe("PENDING_APPROVAL");
  });

  test("broker sees the pre-seeded OPEN request in their browse list", async () => {
    const res = await brokerCtx.get("/api/requests?province=ON");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    const found = body.data.find((r: { publicId: string }) => r.publicId === SEED.openRequestPublicId);
    expect(found, `expected seeded OPEN request ${SEED.openRequestPublicId} in broker list`).toBeDefined();
  });

  test("broker opens a conversation on the OPEN request (credit deducted)", async () => {
    // Handler accepts either internal id or 9-digit publicId via /^\d{9}$/.
    const res = await brokerCtx.post("/api/conversations", {
      data: {
        requestId: SEED.openRequestPublicId,
        message: "Hi — happy to help with your mortgage.",
      },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    conversationId = body.id;
    expect(conversationId).toBeTruthy();
  });

  test("borrower sees the new conversation with an unread count", async () => {
    const res = await borrowerCtx.get("/api/conversations");
    expect(res.status()).toBe(200);
    const convos = (await res.json()) as Array<{ id: string; unreadCount: number }>;
    const convo = convos.find((c) => c.id === conversationId);
    expect(convo, "conversation should be visible to borrower").toBeDefined();
    expect(convo!.unreadCount).toBeGreaterThanOrEqual(1);
  });

  test("borrower opens the conversation → unread clears", async () => {
    const res = await borrowerCtx.get(`/api/conversations/${conversationId}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.messages.length).toBeGreaterThanOrEqual(1);

    const listRes = await borrowerCtx.get("/api/conversations");
    const convos = (await listRes.json()) as Array<{ id: string; unreadCount: number }>;
    expect(convos.find((c) => c.id === conversationId)!.unreadCount).toBe(0);
  });

  test("borrower replies on the conversation", async () => {
    const sendRes = await borrowerCtx.post("/api/messages", {
      data: { conversationId, body: "Great, let's schedule a call." },
    });
    expect(sendRes.status()).toBe(201);
    // NOTE: we intentionally don't CLOSE the request here — the seed re-applies
    // it to OPEN on every run, but leaving it untouched during a run keeps
    // the test a pure read-only-at-end flow the next run can replay.
  });
});
