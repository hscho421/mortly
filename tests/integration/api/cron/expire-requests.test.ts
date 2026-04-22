import { describe, it, expect, beforeEach, vi } from "vitest";
import "@/tests/mocks/prisma";
import { prismaMock } from "@/tests/mocks/prisma";
import { makeReqRes, jsonBody } from "@/tests/utils/apiHelpers";

vi.mock("@/lib/settings", () => ({
  getSettingInt: vi.fn(async () => 30),
  getSettingBool: vi.fn(async () => false),
  getSetting: vi.fn(async () => ""),
  invalidateSettingsCache: vi.fn(),
}));

import handler from "@/pages/api/cron/expire-requests";

const SECRET = process.env.CRON_SECRET!;

describe("POST /api/cron/expire-requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.borrowerRequest.updateMany.mockResolvedValue({ count: 3 } as never);
  });

  it("401s without bearer token", async () => {
    const { req, res } = makeReqRes({ method: "POST" });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("401s on wrong secret (timing-safe compare)", async () => {
    const { req, res } = makeReqRes({
      method: "POST",
      headers: { authorization: "Bearer definitely-not-the-secret" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(prismaMock.borrowerRequest.updateMany).not.toHaveBeenCalled();
  });

  it("401s on partially-matching wrong-length secret", async () => {
    // Guards against a bad impl short-circuiting on prefix match.
    const { req, res } = makeReqRes({
      method: "POST",
      headers: { authorization: `Bearer ${SECRET}extra` },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("sweeps OPEN + PENDING_APPROVAL older than 30d to EXPIRED", async () => {
    const { req, res } = makeReqRes({
      method: "POST",
      headers: { authorization: `Bearer ${SECRET}` },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(jsonBody<{ expiredCount: number }>(res).expiredCount).toBe(3);

    const args = prismaMock.borrowerRequest.updateMany.mock.calls[0][0];
    expect(args.data).toEqual({ status: "EXPIRED" });
    expect(args.where.status).toEqual({ in: ["OPEN", "PENDING_APPROVAL"] });
    expect(args.where.createdAt).toHaveProperty("lt");
    const cutoff = args.where.createdAt.lt as Date;
    const days = (Date.now() - cutoff.getTime()) / (1000 * 60 * 60 * 24);
    expect(days).toBeGreaterThanOrEqual(29.99);
    expect(days).toBeLessThanOrEqual(30.01);
  });

  it("also responds to GET (some cron runners use GET)", async () => {
    const { req, res } = makeReqRes({
      method: "GET",
      headers: { authorization: `Bearer ${SECRET}` },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  it("405s on unsupported method", async () => {
    const { req, res } = makeReqRes({ method: "DELETE" });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});
