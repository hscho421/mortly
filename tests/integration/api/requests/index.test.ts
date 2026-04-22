import { describe, it, expect, beforeEach, vi } from "vitest";
import "@/tests/mocks/prisma";
import "@/tests/mocks/next-auth";
import { prismaMock } from "@/tests/mocks/prisma";
import { setSession, borrowerSession, brokerSession, clearSession } from "@/tests/mocks/next-auth";
import { makeReqRes, jsonBody } from "@/tests/utils/apiHelpers";
import { makeBroker } from "@/tests/fixtures/users";
import { makeBorrowerRequest } from "@/tests/fixtures/requests";

// Settings lookup for max_requests_per_user / others.
vi.mock("@/lib/settings", () => ({
  getSettingInt: vi.fn(async () => 10),
  getSettingBool: vi.fn(async () => false),
  getSetting: vi.fn(async () => ""),
  invalidateSettingsCache: vi.fn(),
}));

// publicId helpers do I/O; stub them to deterministic strings.
vi.mock("@/lib/publicId", () => ({
  generatePublicId: vi.fn(async () => "100000099"),
  generateRequestPublicId: vi.fn(async () => "300000099"),
  generateConversationPublicId: vi.fn(async () => "400000099"),
}));

import handler from "@/pages/api/requests/index";

const validResidentialBody = () => ({
  mortgageCategory: "RESIDENTIAL",
  productTypes: ["NEW_MORTGAGE"],
  province: "Ontario",
  city: "Toronto",
  details: {
    purposeOfUse: ["OWNER_OCCUPIED"],
    incomeTypes: ["EMPLOYMENT"],
    annualIncome: { "2025": "100000" },
  },
  desiredTimeline: "3_MONTHS",
  notes: "Looking to buy",
});

const validCommercialBody = () => ({
  mortgageCategory: "COMMERCIAL",
  productTypes: ["COMM_NEW_LOAN"],
  province: "Ontario",
  details: { businessType: "Restaurant" },
  notes: "Need working capital",
});

describe("POST /api/requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSession(borrowerSession());
    prismaMock.borrowerRequest.count.mockResolvedValue(0);
  });

  it("rejects unauthenticated", async () => {
    clearSession();
    const { req, res } = makeReqRes({ method: "POST", body: validResidentialBody() });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("forbids brokers from creating requests", async () => {
    setSession(brokerSession());
    const { req, res } = makeReqRes({ method: "POST", body: validResidentialBody() });
    await handler(req, res);
    expect(res.statusCode).toBe(403);
  });

  it("creates a residential request on happy path", async () => {
    prismaMock.borrowerRequest.create.mockResolvedValue(makeBorrowerRequest());
    const { req, res } = makeReqRes({ method: "POST", body: validResidentialBody() });
    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect(prismaMock.borrowerRequest.create).toHaveBeenCalledOnce();
    const createArgs = prismaMock.borrowerRequest.create.mock.calls[0][0];
    expect(createArgs.data.mortgageCategory).toBe("RESIDENTIAL");
    expect(createArgs.data.borrowerId).toBe("user_borrower_1");
    expect(createArgs.data.publicId).toBe("300000099");
    // PENDING_APPROVAL is the schema default — not explicitly passed.
    expect(createArgs.data.status).toBeUndefined();
  });

  it("creates a commercial request with businessType + notes", async () => {
    prismaMock.borrowerRequest.create.mockResolvedValue(makeBorrowerRequest({ mortgageCategory: "COMMERCIAL" }));
    const { req, res } = makeReqRes({ method: "POST", body: validCommercialBody() });
    await handler(req, res);
    expect(res.statusCode).toBe(201);
  });

  it("rejects invalid mortgageCategory", async () => {
    const { req, res } = makeReqRes({
      method: "POST",
      body: { ...validResidentialBody(), mortgageCategory: "INDUSTRIAL" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("rejects residential + commercial product mix-up", async () => {
    const { req, res } = makeReqRes({
      method: "POST",
      body: { ...validResidentialBody(), productTypes: ["COMM_NEW_LOAN"] },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(jsonBody<{ error: string }>(res).error).toMatch(/Invalid product type/);
  });

  it("requires province", async () => {
    const { req, res } = makeReqRes({
      method: "POST",
      body: { ...validResidentialBody(), province: "" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("requires purposeOfUse + incomeTypes for RESIDENTIAL", async () => {
    const { req, res } = makeReqRes({
      method: "POST",
      body: { ...validResidentialBody(), details: { purposeOfUse: [], incomeTypes: [] } },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("requires businessType + notes for COMMERCIAL", async () => {
    const { req, res } = makeReqRes({
      method: "POST",
      body: { ...validCommercialBody(), details: { businessType: "" } },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("enforces max active requests per user", async () => {
    prismaMock.borrowerRequest.count.mockResolvedValue(10); // at limit
    const { req, res } = makeReqRes({ method: "POST", body: validResidentialBody() });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(jsonBody<{ error: string }>(res).error).toMatch(/at most/);
  });
});

describe("GET /api/requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("borrower only sees their own requests", async () => {
    setSession(borrowerSession());
    prismaMock.borrowerRequest.findMany.mockResolvedValue([]);
    prismaMock.borrowerRequest.count.mockResolvedValue(0);

    const { req, res } = makeReqRes({ method: "GET" });
    await handler(req, res);
    expect(res.statusCode).toBe(200);

    const where = prismaMock.borrowerRequest.findMany.mock.calls[0][0].where;
    expect(where.borrowerId).toBe("user_borrower_1");
  });

  it("rejects unverified broker", async () => {
    setSession(brokerSession());
    prismaMock.broker.findUnique.mockResolvedValue(makeBroker({ verificationStatus: "PENDING" }));

    const { req, res } = makeReqRes({ method: "GET" });
    await handler(req, res);
    expect(res.statusCode).toBe(403);
  });

  it("verified broker sees OPEN requests with newCount", async () => {
    setSession(brokerSession());
    prismaMock.broker.findUnique.mockResolvedValue(makeBroker());
    prismaMock.borrowerRequest.findMany.mockResolvedValue([
      { ...makeBorrowerRequest(), brokerSeens: [] } as never,
      { ...makeBorrowerRequest({ id: "req_2" }), brokerSeens: [{ seenAt: new Date() }] } as never,
    ]);
    prismaMock.borrowerRequest.count
      .mockResolvedValueOnce(2) // total
      .mockResolvedValueOnce(1); // newCount

    const { req, res } = makeReqRes({ method: "GET" });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const body = jsonBody<{ data: Array<{ isNew: boolean }>; newCount: number }>(res);
    expect(body.data[0].isNew).toBe(true);
    expect(body.data[1].isNew).toBe(false);
    expect(body.newCount).toBe(1);

    const where = prismaMock.borrowerRequest.findMany.mock.calls[0][0].where;
    expect(where.status).toBe("OPEN");
  });

  it("honors province + mortgageCategory filters", async () => {
    setSession(brokerSession());
    prismaMock.broker.findUnique.mockResolvedValue(makeBroker());
    prismaMock.borrowerRequest.findMany.mockResolvedValue([]);
    prismaMock.borrowerRequest.count.mockResolvedValue(0);

    const { req, res } = makeReqRes({
      method: "GET",
      query: { province: "Ontario", mortgageCategory: "COMMERCIAL" },
    });
    await handler(req, res);
    const where = prismaMock.borrowerRequest.findMany.mock.calls[0][0].where;
    expect(where.province).toBe("Ontario");
    expect(where.mortgageCategory).toBe("COMMERCIAL");
  });
});
