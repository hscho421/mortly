/**
 * Marketplace invariants.
 *
 * These tests are framed around *system truths* rather than endpoint behavior.
 * Each block asserts one invariant across every relevant entry point + input
 * shape, so a regression that slips past a narrow endpoint test still trips an
 * invariant. Bias: money, privacy, fairness — the three failure modes that
 * hurt a marketplace most.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import "@/tests/mocks/prisma";
import "@/tests/mocks/next-auth";
import { prismaMock } from "@/tests/mocks/prisma";
import {
  setSession,
  borrowerSession,
  brokerSession,
  adminSession,
  clearSession,
} from "@/tests/mocks/next-auth";
import { makeReqRes, jsonBody } from "@/tests/utils/apiHelpers";
import { makeBroker } from "@/tests/fixtures/users";
import { makeBorrowerRequest, makeConversation } from "@/tests/fixtures/requests";

vi.mock("@/lib/publicId", () => ({
  generatePublicId: vi.fn(async () => "100000099"),
  generateRequestPublicId: vi.fn(async () => "300000099"),
  generateConversationPublicId: vi.fn(async () => "400000099"),
}));
vi.mock("@/lib/push", () => ({
  sendPushToUsers: vi.fn(async () => undefined),
  brokerInquiryPush: vi.fn(() => ({ title: "t", body: "b" })),
  borrowerInquiryPush: vi.fn(() => ({ title: "t", body: "b" })),
  messagePush: vi.fn(() => ({ title: "t", body: "b" })),
}));
vi.mock("@/lib/settings", () => ({
  getSettingInt: vi.fn(async (k: string) => (k === "broker_initial_message_limit" ? 3 : 10)),
  getSettingBool: vi.fn(async () => false),
  getSetting: vi.fn(async () => ""),
  invalidateSettingsCache: vi.fn(),
}));

import conversationsHandler from "@/pages/api/conversations/index";
import messagesHandler from "@/pages/api/messages/index";
import requestsHandler from "@/pages/api/requests/index";
import requestsIdHandler from "@/pages/api/requests/[id]";
import adminCreditsHandler from "@/pages/api/admin/credits";

// ─────────────────────────────────────────────────────────────
// 💸 INVARIANT 1 — Credit conservation
// A broker cannot spend a credit they don't own. The only legal balance
// transitions per conversation-create are: (credits > 0 → credits - 1) for
// non-PREMIUM, or unchanged for PREMIUM. Never < 0. Never decremented twice
// for the same (broker, request) pair.
// ─────────────────────────────────────────────────────────────
describe("Invariant 1 — credit conservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSession(brokerSession());
    prismaMock.borrowerRequest.findUnique.mockResolvedValue(
      makeBorrowerRequest({ borrowerId: "user_borrower_1" })
    );
    prismaMock.userBlock.findFirst.mockResolvedValue(null);
  });

  it("FREE tier: credits strictly never decrement (gated before the tx)", async () => {
    for (const startingCredits of [0, 1, 5, 100]) {
      vi.clearAllMocks();
      prismaMock.broker.findUnique.mockResolvedValue(
        makeBroker({ subscriptionTier: "FREE", responseCredits: startingCredits })
      );
      const { req, res } = makeReqRes({ method: "POST", body: { requestId: "req_1" } });
      await conversationsHandler(req, res);
      expect(res.statusCode).toBe(403);
      expect(prismaMock.broker.updateMany).not.toHaveBeenCalled();
    }
  });

  it("PREMIUM tier: credits untouched regardless of starting balance (including 0, -1)", async () => {
    for (const startingCredits of [-1, 0, 1, 50]) {
      vi.clearAllMocks();
      prismaMock.broker.findUnique.mockResolvedValue(
        makeBroker({ subscriptionTier: "PREMIUM", responseCredits: startingCredits })
      );
      prismaMock.conversation.findUnique.mockResolvedValue(null);
      prismaMock.conversation.create.mockResolvedValue(makeConversation());
      const { req, res } = makeReqRes({ method: "POST", body: { requestId: "req_1" } });
      await conversationsHandler(req, res);
      expect(res.statusCode).toBe(201);
      expect(prismaMock.broker.updateMany).not.toHaveBeenCalled();
    }
  });

  it("BASIC/PRO tier: decrement uses { gt: 0 } guard so credits can never go negative", async () => {
    for (const tier of ["BASIC", "PRO"] as const) {
      vi.clearAllMocks();
      prismaMock.broker.findUnique.mockResolvedValue(
        makeBroker({ subscriptionTier: tier, responseCredits: 5 })
      );
      prismaMock.conversation.findUnique.mockResolvedValue(null);
      prismaMock.broker.updateMany.mockResolvedValue({ count: 1 } as never);
      prismaMock.conversation.create.mockResolvedValue(makeConversation());

      const { req, res } = makeReqRes({ method: "POST", body: { requestId: "req_1" } });
      await conversationsHandler(req, res);
      expect(res.statusCode).toBe(201);

      const where = prismaMock.broker.updateMany.mock.calls[0][0].where;
      // INVARIANT: the where clause MUST include `responseCredits: { gt: 0 }`.
      // Without this, parallel decrements could drive the balance negative.
      expect(where.responseCredits).toEqual({ gt: 0 });
    }
  });

  it("duplicate conversation: the second attempt must never decrement a second time", async () => {
    prismaMock.broker.findUnique.mockResolvedValue(
      makeBroker({ subscriptionTier: "BASIC", responseCredits: 5 })
    );
    prismaMock.conversation.findUnique.mockResolvedValue(makeConversation()); // already exists

    const { req, res } = makeReqRes({
      method: "POST",
      body: { requestId: "req_1", message: "hi again" },
    });
    await conversationsHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(prismaMock.broker.updateMany).not.toHaveBeenCalled();
  });

  it("admin credit adjust: never crosses zero (for any starting balance × amount)", async () => {
    setSession(adminSession());
    const cases: Array<[number, number, "allowed" | "blocked"]> = [
      [5, 10, "allowed"],
      [5, -5, "allowed"], // goes to exactly 0
      [5, -6, "blocked"], // would go to -1
      [0, -1, "blocked"],
      [0, 100, "allowed"],
      [100, -100, "allowed"],
      [100, -101, "blocked"],
    ];

    for (const [start, amount, outcome] of cases) {
      vi.clearAllMocks();
      prismaMock.broker.findUnique.mockResolvedValue({
        ...makeBroker({ responseCredits: start }),
        user: { publicId: "200000001", name: "B", email: "b@t" },
      } as never);
      prismaMock.broker.update.mockResolvedValue(
        { ...makeBroker({ responseCredits: start + amount }), user: { name: "b", email: "b@t" } } as never
      );
      prismaMock.adminAction.create.mockResolvedValue({} as never);

      const { req, res } = makeReqRes({
        method: "POST",
        body: { brokerId: "broker_1", amount },
      });
      await adminCreditsHandler(req, res);

      if (outcome === "allowed") {
        expect(res.statusCode, `start=${start} amount=${amount}`).toBe(200);
      } else {
        expect(res.statusCode, `start=${start} amount=${amount}`).toBe(400);
        expect(prismaMock.broker.update).not.toHaveBeenCalled();
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 🔐 INVARIANT 2 — Privacy: cross-tenant isolation
// No user ever sees another user's private data via any endpoint shape.
// ─────────────────────────────────────────────────────────────
describe("Invariant 2 — cross-tenant isolation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("borrower cannot read another borrower's request (GET)", async () => {
    setSession(borrowerSession({ id: "attacker_1" }));
    prismaMock.borrowerRequest.findUnique.mockResolvedValue({
      ...makeBorrowerRequest({ borrowerId: "victim_1" }),
      conversations: [],
    } as never);

    const { req, res } = makeReqRes({ method: "GET", query: { id: "300000001" } });
    await requestsIdHandler(req, res);
    expect(res.statusCode).toBe(403);
  });

  it("borrower cannot edit/close/delete another borrower's request (PUT/PATCH/DELETE)", async () => {
    setSession(borrowerSession({ id: "attacker_1" }));
    prismaMock.borrowerRequest.findUnique.mockResolvedValue(
      makeBorrowerRequest({ borrowerId: "victim_1", status: "OPEN" })
    );

    for (const method of ["PUT", "PATCH", "DELETE"] as const) {
      vi.clearAllMocks();
      prismaMock.borrowerRequest.findUnique.mockResolvedValue(
        makeBorrowerRequest({ borrowerId: "victim_1", status: "OPEN" })
      );
      const { req, res } = makeReqRes({
        method,
        query: { id: "300000001" },
        body: method === "PUT" ? { status: "CLOSED" } : { notes: "pwned" },
      });
      await requestsIdHandler(req, res);
      expect(res.statusCode, `method=${method}`).toBe(403);
      expect(prismaMock.borrowerRequest.update).not.toHaveBeenCalled();
      expect(prismaMock.borrowerRequest.delete).not.toHaveBeenCalled();
    }
  });

  it("broker marketplace list: query is scoped to status=OPEN, borrower query is scoped to own id", async () => {
    // Borrower list → borrowerId filter only
    setSession(borrowerSession());
    prismaMock.borrowerRequest.findMany.mockResolvedValue([]);
    prismaMock.borrowerRequest.count.mockResolvedValue(0);
    {
      const { req, res } = makeReqRes({ method: "GET" });
      await requestsHandler(req, res);
      const where = prismaMock.borrowerRequest.findMany.mock.calls[0][0].where;
      expect(where.borrowerId).toBe("user_borrower_1");
      expect(where.status).toBeUndefined(); // borrowers see all their statuses
    }

    // Broker list → status=OPEN only (never sees other statuses, never sees owner field filter)
    vi.clearAllMocks();
    setSession(brokerSession());
    prismaMock.broker.findUnique.mockResolvedValue(makeBroker());
    prismaMock.borrowerRequest.findMany.mockResolvedValue([]);
    prismaMock.borrowerRequest.count.mockResolvedValue(0);
    {
      const { req, res } = makeReqRes({ method: "GET" });
      await requestsHandler(req, res);
      const where = prismaMock.borrowerRequest.findMany.mock.calls[0][0].where;
      expect(where.status).toBe("OPEN");
      expect(where.borrowerId).toBeUndefined();
    }
  });

  it("broker reading a request strips competitor conversations", async () => {
    setSession(brokerSession());
    prismaMock.broker.findUnique.mockResolvedValue(makeBroker({ id: "broker_self" }));
    prismaMock.borrowerRequest.findUnique.mockResolvedValue({
      ...makeBorrowerRequest({ status: "OPEN" }),
      conversations: [
        { ...makeConversation({ brokerId: "broker_self" }), _count: { messages: 1 }, broker: {} },
        { ...makeConversation({ id: "conv_x", brokerId: "competitor_a" }), _count: { messages: 1 }, broker: {} },
        { ...makeConversation({ id: "conv_y", brokerId: "competitor_b" }), _count: { messages: 1 }, broker: {} },
      ],
    } as never);

    const { req, res } = makeReqRes({ method: "GET", query: { id: "300000001" } });
    await requestsIdHandler(req, res);
    expect(res.statusCode).toBe(200);

    const body = jsonBody<{ conversations: Array<{ brokerId: string }> }>(res);
    expect(body.conversations).toHaveLength(1);
    expect(body.conversations[0].brokerId).toBe("broker_self");
  });

  it("messages: non-participant cannot send to a conversation they don't belong to", async () => {
    setSession({
      user: { id: "stranger", publicId: "x", email: "s@t", name: null, role: "BORROWER" },
    });
    prismaMock.conversation.findUnique.mockResolvedValue({
      id: "conv_1",
      borrowerId: "user_borrower_1",
      broker: {
        userId: "user_broker_1",
        brokerageName: "Acme",
        user: { name: "Brenda" },
      },
      borrower: { id: "user_borrower_1", name: "Bob" },
    } as never);
    prismaMock.userBlock.findFirst.mockResolvedValue(null);

    const { req, res } = makeReqRes({
      method: "POST",
      body: { conversationId: "conv_1", body: "leak" },
    });
    await messagesHandler(req, res);
    expect(res.statusCode).toBe(403);
    expect(prismaMock.message.create).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// ⚖️ INVARIANT 3 — Role fences
// A user at role X can never execute the write path reserved for role Y.
// ─────────────────────────────────────────────────────────────
describe("Invariant 3 — role fences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Every POST /api/requests hits max-active count; pre-arm it to pass.
    prismaMock.borrowerRequest.count.mockResolvedValue(0);
  });

  const validResidentialBody = () => ({
    mortgageCategory: "RESIDENTIAL",
    productTypes: ["NEW_MORTGAGE"],
    province: "Ontario",
    details: { purposeOfUse: ["OWNER_OCCUPIED"], incomeTypes: ["EMPLOYMENT"] },
    notes: "n/a",
  });

  it("only BORROWER can POST /api/requests (broker, admin, anon all rejected)", async () => {
    const forbidden: Array<[ReturnType<typeof brokerSession> | null, number]> = [
      [null, 401],
      [brokerSession(), 403],
      [adminSession(), 403],
    ];
    for (const [session, expectedStatus] of forbidden) {
      vi.clearAllMocks();
      prismaMock.borrowerRequest.count.mockResolvedValue(0);
      if (session) setSession(session);
      else clearSession();
      const { req, res } = makeReqRes({ method: "POST", body: validResidentialBody() });
      await requestsHandler(req, res);
      expect(res.statusCode).toBe(expectedStatus);
      expect(prismaMock.borrowerRequest.create).not.toHaveBeenCalled();
    }
  });

  it("only ADMIN can POST /api/admin/credits (borrower, broker, anon all rejected)", async () => {
    const forbidden: Array<[ReturnType<typeof brokerSession> | null, number]> = [
      [null, 401],
      [borrowerSession(), 403],
      [brokerSession(), 403],
    ];
    for (const [session, expectedStatus] of forbidden) {
      vi.clearAllMocks();
      if (session) setSession(session);
      else clearSession();
      const { req, res } = makeReqRes({
        method: "POST",
        body: { brokerId: "broker_1", amount: 5 },
      });
      await adminCreditsHandler(req, res);
      expect(res.statusCode).toBe(expectedStatus);
      expect(prismaMock.broker.update).not.toHaveBeenCalled();
    }
  });

  it("an unverified broker never reaches a write path (credit deduct, message intro)", async () => {
    setSession(brokerSession());
    prismaMock.broker.findUnique.mockResolvedValue(
      makeBroker({ verificationStatus: "PENDING", responseCredits: 100 })
    );
    prismaMock.borrowerRequest.findUnique.mockResolvedValue(makeBorrowerRequest());
    prismaMock.userBlock.findFirst.mockResolvedValue(null);

    const { req, res } = makeReqRes({
      method: "POST",
      body: { requestId: "req_1", message: "hi" },
    });
    await conversationsHandler(req, res);
    expect(res.statusCode).toBe(403);
    expect(prismaMock.broker.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.conversation.create).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// 🚫 INVARIANT 4 — Block-list symmetry
// A block by A on B must prevent actions from both A→B and B→A. One-way
// blocks are a privacy bug.
// ─────────────────────────────────────────────────────────────
describe("Invariant 4 — block-list symmetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.conversation.findUnique.mockResolvedValue({
      id: "conv_1",
      borrowerId: "user_borrower_1",
      broker: { userId: "user_broker_1", brokerageName: "A", user: { name: "B" } },
      borrower: { id: "user_borrower_1", name: "Bob" },
    } as never);
    prismaMock.message.groupBy.mockResolvedValue([] as never);
  });

  it("messages: blocked in EITHER direction → 403 for BOTH participants", async () => {
    // Direction 1: borrower blocks broker
    prismaMock.userBlock.findFirst.mockResolvedValue({
      blockerId: "user_borrower_1",
      blockedId: "user_broker_1",
      createdAt: new Date(),
    } as never);

    for (const sender of [borrowerSession(), brokerSession()]) {
      setSession(sender);
      const { req, res } = makeReqRes({
        method: "POST",
        body: { conversationId: "conv_1", body: "hi" },
      });
      await messagesHandler(req, res);
      expect(res.statusCode, `sender=${sender!.user.role}`).toBe(403);
    }

    // Direction 2: broker blocks borrower — same invariant
    vi.clearAllMocks();
    prismaMock.conversation.findUnique.mockResolvedValue({
      id: "conv_1",
      borrowerId: "user_borrower_1",
      broker: { userId: "user_broker_1", brokerageName: "A", user: { name: "B" } },
      borrower: { id: "user_borrower_1", name: "Bob" },
    } as never);
    prismaMock.userBlock.findFirst.mockResolvedValue({
      blockerId: "user_broker_1",
      blockedId: "user_borrower_1",
      createdAt: new Date(),
    } as never);
    prismaMock.message.groupBy.mockResolvedValue([] as never);

    for (const sender of [borrowerSession(), brokerSession()]) {
      setSession(sender);
      const { req, res } = makeReqRes({
        method: "POST",
        body: { conversationId: "conv_1", body: "hi" },
      });
      await messagesHandler(req, res);
      expect(res.statusCode, `sender=${sender!.user.role}`).toBe(403);
    }
  });

  it("broker-initiated conversation: blocked in EITHER direction → 403, credits untouched", async () => {
    setSession(brokerSession());
    prismaMock.borrowerRequest.findUnique.mockResolvedValue(
      makeBorrowerRequest({ borrowerId: "user_borrower_1" })
    );
    prismaMock.broker.findUnique.mockResolvedValue(
      makeBroker({ subscriptionTier: "BASIC", responseCredits: 10 })
    );

    for (const block of [
      { blockerId: "user_broker_1", blockedId: "user_borrower_1" },
      { blockerId: "user_borrower_1", blockedId: "user_broker_1" },
    ]) {
      vi.clearAllMocks();
      prismaMock.borrowerRequest.findUnique.mockResolvedValue(
        makeBorrowerRequest({ borrowerId: "user_borrower_1" })
      );
      prismaMock.broker.findUnique.mockResolvedValue(
        makeBroker({ subscriptionTier: "BASIC", responseCredits: 10 })
      );
      prismaMock.userBlock.findFirst.mockResolvedValue({ ...block, createdAt: new Date() } as never);

      const { req, res } = makeReqRes({
        method: "POST",
        body: { requestId: "req_1", message: "hi" },
      });
      await conversationsHandler(req, res);
      expect(res.statusCode).toBe(403);
      expect(prismaMock.broker.updateMany).not.toHaveBeenCalled();
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 📏 INVARIANT 5 — Input bounds are enforced before DB writes
// Any rejected input must not produce a row. This catches "validation after
// create" bugs where a DB row sneaks in before validation fails.
// ─────────────────────────────────────────────────────────────
describe("Invariant 5 — no side-effects on rejected input", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSession(borrowerSession());
    prismaMock.borrowerRequest.count.mockResolvedValue(0);
  });

  const invalidBodies: Array<[string, Record<string, unknown>]> = [
    ["missing mortgageCategory", { productTypes: ["NEW_MORTGAGE"], province: "ON", details: {}, notes: "x" }],
    ["unknown mortgageCategory", { mortgageCategory: "INDUSTRIAL", productTypes: ["NEW_MORTGAGE"], province: "ON", details: {}, notes: "x" }],
    ["empty productTypes", { mortgageCategory: "RESIDENTIAL", productTypes: [], province: "ON", details: {}, notes: "x" }],
    ["cross-category product mix", { mortgageCategory: "RESIDENTIAL", productTypes: ["COMM_NEW_LOAN"], province: "ON", details: {}, notes: "x" }],
    ["missing province", { mortgageCategory: "RESIDENTIAL", productTypes: ["NEW_MORTGAGE"], details: {}, notes: "x" }],
    ["missing residential details", { mortgageCategory: "RESIDENTIAL", productTypes: ["NEW_MORTGAGE"], province: "ON", details: {}, notes: "x" }],
  ];

  it.each(invalidBodies)("rejecting %s must NOT call borrowerRequest.create", async (_label, body) => {
    const { req, res } = makeReqRes({ method: "POST", body });
    await requestsHandler(req, res);
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.statusCode).toBeLessThan(500);
    expect(prismaMock.borrowerRequest.create).not.toHaveBeenCalled();
  });

  it("rejecting an oversized message body must NOT call message.create", async () => {
    prismaMock.conversation.findUnique.mockResolvedValue({
      id: "conv_1",
      borrowerId: "user_borrower_1",
      broker: { userId: "user_broker_1", brokerageName: "A", user: { name: "B" } },
      borrower: { id: "user_borrower_1", name: "Bob" },
    } as never);
    prismaMock.userBlock.findFirst.mockResolvedValue(null);

    const { req, res } = makeReqRes({
      method: "POST",
      body: { conversationId: "conv_1", body: "a".repeat(5001) },
    });
    await messagesHandler(req, res);
    expect(res.statusCode).toBe(400);
    expect(prismaMock.message.create).not.toHaveBeenCalled();
  });
});
