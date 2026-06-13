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

const EXPIRING = [
  { id: "r1", publicId: "100000001", borrowerId: "u1" },
  { id: "r2", publicId: "100000002", borrowerId: "u2" },
  { id: "r3", publicId: "100000003", borrowerId: "u3" },
];

describe("POST /api/cron/expire-requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The cron now SELECTs the affected requests first (to notify each
    // borrower), then expires by id.
    prismaMock.borrowerRequest.findMany.mockResolvedValue(EXPIRING as never);
    prismaMock.borrowerRequest.updateMany.mockResolvedValue({ count: 3 } as never);
    // notifyUser internals (fire-safe — failures must not fail the cron).
    prismaMock.user.findFirst.mockResolvedValue({ id: "admin_1" } as never);
    prismaMock.adminNotice.create.mockResolvedValue({} as never);
    prismaMock.deviceToken.findMany.mockResolvedValue([] as never);
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

    // Selection criteria live on the findMany now.
    const findArgs = prismaMock.borrowerRequest.findMany.mock.calls[0][0];
    expect(findArgs.where.status).toEqual({ in: ["OPEN", "PENDING_APPROVAL"] });
    // Requests with ACTIVE conversations are never expired out from under
    // brokers who paid to be in them.
    expect(findArgs.where.conversations).toEqual({ none: { status: "ACTIVE" } });
    expect(findArgs.where.createdAt).toHaveProperty("lt");
    const cutoff = findArgs.where.createdAt.lt as Date;
    const days = (Date.now() - cutoff.getTime()) / (1000 * 60 * 60 * 24);
    expect(days).toBeGreaterThanOrEqual(29.99);
    expect(days).toBeLessThanOrEqual(30.01);

    const updateArgs = prismaMock.borrowerRequest.updateMany.mock.calls[0][0];
    expect(updateArgs.data).toEqual({ status: "EXPIRED" });
    expect(updateArgs.where.id).toEqual({ in: ["r1", "r2", "r3"] });

    // Each borrower gets an in-app notice with an idempotent dedupe key.
    expect(prismaMock.adminNotice.create).toHaveBeenCalledTimes(3);
    expect(prismaMock.adminNotice.create.mock.calls[0][0].data).toMatchObject({
      userId: "u1",
      dedupeKey: "request-expired-r1",
    });
  });

  it("also responds to GET (Vercel cron uses GET)", async () => {
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
