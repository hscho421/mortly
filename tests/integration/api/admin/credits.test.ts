import { describe, it, expect, beforeEach, vi } from "vitest";
import "@/tests/mocks/prisma";
import "@/tests/mocks/next-auth";
import { prismaMock } from "@/tests/mocks/prisma";
import { setSession, adminSession, brokerSession } from "@/tests/mocks/next-auth";
import { makeReqRes, jsonBody } from "@/tests/utils/apiHelpers";
import { makeBroker, makeBrokerUser } from "@/tests/fixtures/users";

import handler from "@/pages/api/admin/credits";

describe("POST /api/admin/credits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSession(adminSession());
    prismaMock.broker.findUnique.mockResolvedValue({
      ...makeBroker({ responseCredits: 5 }),
      user: { publicId: "200000001", name: "Brenda", email: "b@test.com" },
    } as never);
    prismaMock.broker.update.mockResolvedValue(
      { ...makeBroker({ responseCredits: 10 }), user: { name: "b", email: "b@t" } } as never
    );
    prismaMock.adminAction.create.mockResolvedValue({} as never);
  });

  it("401s when not logged in", async () => {
    setSession(null);
    const { req, res } = makeReqRes({ method: "POST", body: { brokerId: "broker_1", amount: 5 } });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("403s when logged in as non-admin", async () => {
    setSession(brokerSession());
    const { req, res } = makeReqRes({ method: "POST", body: { brokerId: "broker_1", amount: 5 } });
    await handler(req, res);
    expect(res.statusCode).toBe(403);
  });

  it("adds credits and writes an AdminAction audit row", async () => {
    const { req, res } = makeReqRes({
      method: "POST",
      body: { brokerId: "broker_1", amount: 5, reason: "Promo" },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(prismaMock.broker.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { responseCredits: { increment: 5 } },
      })
    );
    expect(prismaMock.adminAction.create).toHaveBeenCalledOnce();
    const auditArgs = prismaMock.adminAction.create.mock.calls[0][0];
    expect(auditArgs.data.action).toBe("CREDIT_ADJUST");
    expect(auditArgs.data.reason).toBe("Promo");
    const details = JSON.parse(auditArgs.data.details);
    expect(details).toEqual({ amount: 5, previousBalance: 5, newBalance: 10 });
  });

  it("removes credits when amount is negative", async () => {
    const { req, res } = makeReqRes({
      method: "POST",
      body: { brokerId: "broker_1", amount: -2 },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(prismaMock.broker.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { responseCredits: { increment: -2 } },
      })
    );
  });

  it("refuses to go negative", async () => {
    // Broker has 5, trying to remove 100.
    const { req, res } = makeReqRes({
      method: "POST",
      body: { brokerId: "broker_1", amount: -100 },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(jsonBody<{ error: string }>(res).error).toMatch(/only has 5/);
    expect(prismaMock.broker.update).not.toHaveBeenCalled();
  });

  it("rejects amount=0 (no-op)", async () => {
    const { req, res } = makeReqRes({
      method: "POST",
      body: { brokerId: "broker_1", amount: 0 },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("404s when broker doesn't exist", async () => {
    prismaMock.broker.findUnique.mockResolvedValue(null);
    const { req, res } = makeReqRes({
      method: "POST",
      body: { brokerId: "missing", amount: 5 },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it("405s on non-POST", async () => {
    const { req, res } = makeReqRes({ method: "GET" });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});
