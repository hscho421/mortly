# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: request-to-broker-flow.spec.ts >> Borrower request → broker reply full flow >> borrower creates a request
- Location: tests/e2e/request-to-broker-flow.spec.ts:69:7

# Error details

```
TypeError: apiRequestContext.get: Invalid URL
```

# Test source

```ts
  1   | import { test, expect, request, APIRequestContext } from "@playwright/test";
  2   | import { randomBytes } from "node:crypto";
  3   | 
  4   | /**
  5   |  * Full marketplace flow:
  6   |  *   1. Borrower signs up and is verified (via admin bypass or direct DB tweak in seed)
  7   |  *   2. Borrower creates a request
  8   |  *   3. Broker (already seeded + VERIFIED + subscribed) picks up the request
  9   |  *   4. Broker opens a conversation (credit deducted)
  10  |  *   5. Broker sends a message
  11  |  *   6. Borrower reads the conversation; unread → 0
  12  |  *
  13  |  * Preconditions:
  14  |  *   - Run against a TEST database seeded via `npm run seed:mock` which creates:
  15  |  *       - a VERIFIED broker w/ BASIC tier + responseCredits > 0
  16  |  *       - the seed user passwords all being "password123"
  17  |  *   - NEXTAUTH_URL points at the test server
  18  |  *
  19  |  * If your seed doesn't produce those fixtures, adjust the `SEED` block below.
  20  |  */
  21  | 
  22  | const SEED = {
  23  |   borrower: { email: "seed-borrower@mortly.test", password: "password123" },
  24  |   broker: { email: "seed-broker@mortly.test", password: "password123" },
  25  | };
  26  | 
  27  | async function signIn(ctx: APIRequestContext, email: string, password: string) {
  28  |   // Hit NextAuth credentials callback. next-auth returns a redirect response +
  29  |   // sets cookies on the context, so subsequent requests are authenticated.
  30  |   // The csrf step is skipped here because our route uses `credentials` with
  31  |   // `authorize()` — the cookie flow comes via the session endpoint.
> 32  |   const csrfRes = await ctx.get("/api/auth/csrf");
      |                             ^ TypeError: apiRequestContext.get: Invalid URL
  33  |   const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  34  | 
  35  |   const res = await ctx.post("/api/auth/callback/credentials", {
  36  |     form: {
  37  |       email,
  38  |       password,
  39  |       csrfToken,
  40  |       callbackUrl: "/",
  41  |       json: "true",
  42  |     },
  43  |   });
  44  |   // next-auth returns 200 JSON with url; cookies stick via APIRequestContext.
  45  |   expect([200, 302]).toContain(res.status());
  46  |   const session = await (await ctx.get("/api/auth/session")).json();
  47  |   expect(session?.user?.email).toBe(email);
  48  |   return session.user;
  49  | }
  50  | 
  51  | test.describe.serial("Borrower request → broker reply full flow", () => {
  52  |   let borrowerCtx: APIRequestContext;
  53  |   let brokerCtx: APIRequestContext;
  54  |   let requestPublicId: string;
  55  |   let conversationId: string;
  56  | 
  57  |   test.beforeAll(async ({ playwright }) => {
  58  |     borrowerCtx = await playwright.request.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL });
  59  |     brokerCtx = await playwright.request.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL });
  60  |     await signIn(borrowerCtx, SEED.borrower.email, SEED.borrower.password);
  61  |     await signIn(brokerCtx, SEED.broker.email, SEED.broker.password);
  62  |   });
  63  | 
  64  |   test.afterAll(async () => {
  65  |     await borrowerCtx.dispose();
  66  |     await brokerCtx.dispose();
  67  |   });
  68  | 
  69  |   test("borrower creates a request", async () => {
  70  |     const res = await borrowerCtx.post("/api/requests", {
  71  |       data: {
  72  |         mortgageCategory: "RESIDENTIAL",
  73  |         productTypes: ["NEW_MORTGAGE"],
  74  |         province: "Ontario",
  75  |         city: "Toronto",
  76  |         details: {
  77  |           purposeOfUse: ["OWNER_OCCUPIED"],
  78  |           incomeTypes: ["EMPLOYMENT"],
  79  |           annualIncome: { [String(new Date().getFullYear())]: "100000" },
  80  |         },
  81  |         desiredTimeline: "3_MONTHS",
  82  |         notes: `E2E test note ${randomBytes(4).toString("hex")}`,
  83  |       },
  84  |     });
  85  |     expect(res.status()).toBe(201);
  86  |     const body = await res.json();
  87  |     requestPublicId = body.publicId;
  88  |     expect(requestPublicId).toMatch(/^\d{9}$/);
  89  |   });
  90  | 
  91  |   test("broker sees the request in OPEN list (after admin approval) — assumes seed flips to OPEN", async () => {
  92  |     // In a real flow an admin approves PENDING_APPROVAL → OPEN. For the E2E,
  93  |     // we rely on the seed to auto-approve fresh borrower requests in test mode,
  94  |     // OR we invoke an admin endpoint here. Adjust the seed if your test env
  95  |     // requires explicit approval.
  96  |     const res = await brokerCtx.get("/api/requests?province=Ontario");
  97  |     expect(res.status()).toBe(200);
  98  |     const body = await res.json();
  99  |     expect(Array.isArray(body.data)).toBe(true);
  100 |     // NOTE: if the seed doesn't auto-approve, this assertion surfaces that gap.
  101 |     const found = body.data.find((r: { publicId: string }) => r.publicId === requestPublicId);
  102 |     expect(found, "expected request to appear in broker OPEN list — is seed auto-approving?").toBeDefined();
  103 |   });
  104 | 
  105 |   test("broker opens a conversation with an intro message", async () => {
  106 |     // The conversations POST endpoint takes the internal request ID via the
  107 |     // publicId → id lookup. We pass the publicId (handler accepts /^\d{9}$/).
  108 |     const res = await brokerCtx.post("/api/conversations", {
  109 |       data: {
  110 |         requestId: requestPublicId,
  111 |         message: "Hi — happy to help with your mortgage.",
  112 |       },
  113 |     });
  114 |     expect([200, 201]).toContain(res.status());
  115 |     const body = await res.json();
  116 |     conversationId = body.id;
  117 |     expect(conversationId).toBeTruthy();
  118 |   });
  119 | 
  120 |   test("borrower sees the new conversation with an unread count", async () => {
  121 |     const res = await borrowerCtx.get("/api/conversations");
  122 |     expect(res.status()).toBe(200);
  123 |     const convos = (await res.json()) as Array<{ id: string; unreadCount: number }>;
  124 |     const convo = convos.find((c) => c.id === conversationId);
  125 |     expect(convo, "conversation should be visible to borrower").toBeDefined();
  126 |     expect(convo!.unreadCount).toBeGreaterThanOrEqual(1);
  127 |   });
  128 | 
  129 |   test("borrower opens the conversation → unread clears", async () => {
  130 |     const res = await borrowerCtx.get(`/api/conversations/${conversationId}`);
  131 |     expect(res.status()).toBe(200);
  132 |     const body = await res.json();
```