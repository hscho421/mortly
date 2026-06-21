import { describe, it, expect, beforeEach, vi } from "vitest";
import "@/tests/mocks/prisma";
import "@/tests/mocks/next-auth";
import { prismaMock } from "@/tests/mocks/prisma";
import { setSession, brokerSession, borrowerSession, clearSession } from "@/tests/mocks/next-auth";
import { makeReqRes, jsonBody } from "@/tests/utils/apiHelpers";

import handler from "@/pages/api/messages/unread";

describe("GET /api/messages/unread", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401s when unauthenticated", async () => {
    clearSession();
    const { req, res } = makeReqRes({ method: "GET" });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  // Regression: a broker with no Broker row (signed up, not yet onboarded /
  // awaiting verification) must get 0 — NOT the platform-wide unread total.
  // Previously `brokerId` was undefined and Prisma dropped the filter, counting
  // every conversation's unread (the "38 unread on the messages tab" bug).
  it("returns 0 for a broker with no Broker profile WITHOUT querying conversations", async () => {
    setSession(brokerSession());
    prismaMock.broker.findUnique.mockResolvedValue(null);

    const { req, res } = makeReqRes({ method: "GET" });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(jsonBody<{ unread: number }>(res).unread).toBe(0);
    // The early return is the fix — never reach the conversation scan.
    expect(prismaMock.conversation.findMany).not.toHaveBeenCalled();
    expect(prismaMock.message.count).not.toHaveBeenCalled();
  });

  it("returns 0 for a verified broker with no active conversations", async () => {
    setSession(brokerSession());
    prismaMock.broker.findUnique.mockResolvedValue({ id: "broker_1" } as never);
    prismaMock.conversation.findMany.mockResolvedValue([] as never);

    const { req, res } = makeReqRes({ method: "GET" });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(jsonBody<{ unread: number }>(res).unread).toBe(0);
    // Scoped strictly to this broker's conversations (defined brokerId).
    const where = prismaMock.conversation.findMany.mock.calls[0][0].where;
    expect(where.brokerId).toBe("broker_1");
    expect(where.status).toBe("ACTIVE");
  });

  it("counts unread for a broker's own conversations only", async () => {
    setSession(brokerSession());
    prismaMock.broker.findUnique.mockResolvedValue({ id: "broker_1" } as never);
    prismaMock.conversation.findMany.mockResolvedValue([
      { id: "c1", borrowerLastReadAt: null, brokerLastReadAt: null },
    ] as never);
    prismaMock.message.count.mockResolvedValue(5);

    const { req, res } = makeReqRes({ method: "GET" });
    await handler(req, res);

    expect(jsonBody<{ unread: number }>(res).unread).toBe(5);
  });

  it("scopes a borrower to their own conversations", async () => {
    setSession(borrowerSession());
    prismaMock.conversation.findMany.mockResolvedValue([] as never);

    const { req, res } = makeReqRes({ method: "GET" });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const where = prismaMock.conversation.findMany.mock.calls[0][0].where;
    expect(where.borrowerId).toBe("user_borrower_1");
    expect(prismaMock.broker.findUnique).not.toHaveBeenCalled();
  });
});
