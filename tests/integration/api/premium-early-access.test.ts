import { describe, it, expect, beforeEach, vi } from "vitest";
import "@/tests/mocks/prisma";
import "@/tests/mocks/next-auth";
import { prismaMock } from "@/tests/mocks/prisma";
import { setSession, brokerSession, borrowerSession } from "@/tests/mocks/next-auth";
import { makeReqRes, jsonBody } from "@/tests/utils/apiHelpers";
import { makeBroker } from "@/tests/fixtures/users";
import { makeBorrowerRequest, makeConversation } from "@/tests/fixtures/requests";

// Feature ENABLED for this whole file: window 12h, valve 6h, min 2 responses.
vi.mock("@/lib/settings", () => ({
  getSettingBool: vi.fn(async (key: string) => key === "premium_early_access_enabled"),
  getSettingInt: vi.fn(async (key: string) => {
    const map: Record<string, number> = {
      premium_window_hours: 12,
      premium_valve_hours: 6,
      premium_valve_min_responses: 2,
      max_requests_per_user: 10,
    };
    return map[key] ?? 0;
  }),
  getSetting: vi.fn(async () => ""),
  invalidateSettingsCache: vi.fn(),
}));

vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return {
    ...actual,
    checkRateLimit: vi.fn(async () => ({ success: true, remaining: 999, limit: 1000, reset: Date.now() + 60_000 })),
  };
});

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

import feedHandler from "@/pages/api/requests/index";
import convoHandler from "@/pages/api/conversations/index";
import detailHandler from "@/pages/api/requests/[id]";

const HOUR = 3_600_000;
// approved 1h ago, never released → inside the 12h exclusive window.
const inWindowReq = (overrides = {}) =>
  makeBorrowerRequest({
    status: "OPEN",
    approvedAt: new Date(Date.now() - HOUR),
    premiumReleasedAt: null,
    ...overrides,
  });
// released to all brokers already.
const releasedReq = (overrides = {}) =>
  makeBorrowerRequest({
    status: "OPEN",
    approvedAt: new Date(Date.now() - HOUR),
    premiumReleasedAt: new Date(Date.now() - HOUR / 2),
    ...overrides,
  });

describe("Premium early access — feed gate (GET /api/requests)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSession(brokerSession());
    prismaMock.conversation.findMany.mockResolvedValue([] as never);
  });

  it("non-PREMIUM broker feed is filtered to released/capped requests", async () => {
    prismaMock.broker.findUnique.mockResolvedValue(makeBroker({ subscriptionTier: "PRO" }));
    prismaMock.borrowerRequest.findMany.mockResolvedValue([] as never);
    prismaMock.borrowerRequest.count.mockResolvedValue(0);

    const { req, res } = makeReqRes({ method: "GET" });
    await feedHandler(req, res);

    expect(res.statusCode).toBe(200);
    const where = prismaMock.borrowerRequest.findMany.mock.calls[0][0].where as {
      status: string;
      OR?: unknown[];
    };
    expect(where.status).toBe("OPEN");
    expect(Array.isArray(where.OR)).toBe(true);
    expect(where.OR).toHaveLength(3);
  });

  it("PREMIUM broker feed has no visibility filter and flags in-window requests", async () => {
    prismaMock.broker.findUnique.mockResolvedValue(makeBroker({ subscriptionTier: "PREMIUM" }));
    prismaMock.borrowerRequest.findMany.mockResolvedValue([
      { ...inWindowReq(), brokerSeens: [] },
    ] as never);
    prismaMock.borrowerRequest.count.mockResolvedValue(1);

    const { req, res } = makeReqRes({ method: "GET" });
    await feedHandler(req, res);

    expect(res.statusCode).toBe(200);
    const where = prismaMock.borrowerRequest.findMany.mock.calls[0][0].where as {
      OR?: unknown[];
    };
    expect(where.OR).toBeUndefined(); // PREMIUM sees everything
    const body = jsonBody<{ data: Array<Record<string, unknown>> }>(res);
    expect(body.data[0].isPremiumExclusive).toBe(true);
    // Raw window timestamps must not leak in the response (feature mechanics).
    expect(body.data[0]).not.toHaveProperty("approvedAt");
    expect(body.data[0]).not.toHaveProperty("premiumReleasedAt");
  });

  it("PREMIUM feed does NOT flag an already-released request", async () => {
    prismaMock.broker.findUnique.mockResolvedValue(makeBroker({ subscriptionTier: "PREMIUM" }));
    prismaMock.borrowerRequest.findMany.mockResolvedValue([
      { ...releasedReq(), brokerSeens: [] },
    ] as never);
    prismaMock.borrowerRequest.count.mockResolvedValue(1);

    const { req, res } = makeReqRes({ method: "GET" });
    await feedHandler(req, res);

    const body = jsonBody<{ data: Array<{ isPremiumExclusive: boolean }> }>(res);
    expect(body.data[0].isPremiumExclusive).toBe(false);
  });
});

describe("Premium early access — intro gate (POST /api/conversations)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSession(brokerSession());
    prismaMock.userBlock.findFirst.mockResolvedValue(null);
    prismaMock.conversation.findUnique.mockResolvedValue(null);
    prismaMock.conversation.create.mockResolvedValue(makeConversation());
    prismaMock.broker.updateMany.mockResolvedValue({ count: 1 } as never);
  });

  it("blocks a PRO broker from contacting an in-window exclusive request", async () => {
    prismaMock.borrowerRequest.findUnique.mockResolvedValue(inWindowReq());
    prismaMock.broker.findUnique.mockResolvedValue(makeBroker({ subscriptionTier: "PRO", responseCredits: 20 }));

    const { req, res } = makeReqRes({ method: "POST", body: { requestId: "req_1", message: "Hi" } });
    await convoHandler(req, res);

    expect(res.statusCode).toBe(403);
    expect(jsonBody<{ code?: string }>(res).code).toBe("PREMIUM_EXCLUSIVE");
    expect(prismaMock.conversation.create).not.toHaveBeenCalled();
    expect(prismaMock.broker.updateMany).not.toHaveBeenCalled(); // no credit spent
  });

  it("allows a PREMIUM broker to contact an in-window exclusive request", async () => {
    prismaMock.borrowerRequest.findUnique.mockResolvedValue(inWindowReq());
    prismaMock.broker.findUnique.mockResolvedValue(makeBroker({ subscriptionTier: "PREMIUM", responseCredits: 0 }));

    const { req, res } = makeReqRes({ method: "POST", body: { requestId: "req_1", message: "Hi" } });
    await convoHandler(req, res);

    expect(res.statusCode).toBe(201);
  });

  it("allows a PRO broker once the request has released", async () => {
    prismaMock.borrowerRequest.findUnique.mockResolvedValue(releasedReq());
    prismaMock.broker.findUnique.mockResolvedValue(makeBroker({ subscriptionTier: "PRO", responseCredits: 20 }));

    const { req, res } = makeReqRes({ method: "POST", body: { requestId: "req_1", message: "Hi" } });
    await convoHandler(req, res);

    expect(res.statusCode).toBe(201);
  });
});

describe("Premium early access — borrower-initiated intro gate (POST /api/conversations)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSession(borrowerSession());
    prismaMock.userBlock.findFirst.mockResolvedValue(null);
    prismaMock.conversation.findUnique.mockResolvedValue(null);
    prismaMock.conversation.create.mockResolvedValue(makeConversation());
  });

  it("blocks a borrower from pulling a non-PREMIUM broker into an in-window request", async () => {
    prismaMock.borrowerRequest.findUnique.mockResolvedValue(inWindowReq());
    prismaMock.broker.findUnique.mockResolvedValue(
      makeBroker({ id: "broker_x", subscriptionTier: "PRO" }) as never,
    );

    const { req, res } = makeReqRes({
      method: "POST",
      body: { requestId: "req_1", brokerId: "broker_x" },
    });
    await convoHandler(req, res);

    expect(res.statusCode).toBe(403);
    expect(jsonBody<{ code?: string }>(res).code).toBe("PREMIUM_EXCLUSIVE");
    expect(prismaMock.conversation.create).not.toHaveBeenCalled();
  });

  it("allows a borrower to contact a PREMIUM broker on an in-window request", async () => {
    prismaMock.borrowerRequest.findUnique.mockResolvedValue(inWindowReq());
    prismaMock.broker.findUnique.mockResolvedValue(
      makeBroker({ id: "broker_x", subscriptionTier: "PREMIUM" }) as never,
    );

    const { req, res } = makeReqRes({
      method: "POST",
      body: { requestId: "req_1", brokerId: "broker_x" },
    });
    await convoHandler(req, res);

    expect(res.statusCode).toBe(201);
  });

  it("allows a borrower to contact any broker once the request has released", async () => {
    prismaMock.borrowerRequest.findUnique.mockResolvedValue(releasedReq());
    prismaMock.broker.findUnique.mockResolvedValue(
      makeBroker({ id: "broker_x", subscriptionTier: "PRO" }) as never,
    );

    const { req, res } = makeReqRes({
      method: "POST",
      body: { requestId: "req_1", brokerId: "broker_x" },
    });
    await convoHandler(req, res);

    expect(res.statusCode).toBe(201);
  });
});

describe("Premium early access — detail gate (GET /api/requests/[id])", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSession(brokerSession());
  });

  it("blocks a PRO broker (no conversation) from viewing an in-window exclusive request", async () => {
    prismaMock.borrowerRequest.findUnique.mockResolvedValue({
      ...inWindowReq(),
      conversations: [],
    } as never);
    prismaMock.broker.findUnique.mockResolvedValue(makeBroker({ subscriptionTier: "PRO" }));

    const { req, res } = makeReqRes({ method: "GET", query: { id: "300000001" } });
    await detailHandler(req, res);

    expect(res.statusCode).toBe(403);
    expect(jsonBody<{ code?: string }>(res).code).toBe("PREMIUM_EXCLUSIVE");
  });

  it("allows a PREMIUM broker to view an in-window exclusive request", async () => {
    prismaMock.borrowerRequest.findUnique.mockResolvedValue({
      ...inWindowReq(),
      conversations: [],
    } as never);
    prismaMock.broker.findUnique.mockResolvedValue(makeBroker({ subscriptionTier: "PREMIUM" }));

    const { req, res } = makeReqRes({ method: "GET", query: { id: "300000001" } });
    await detailHandler(req, res);

    expect(res.statusCode).toBe(200);
  });
});
