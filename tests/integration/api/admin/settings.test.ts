import { describe, it, expect, beforeEach, vi } from "vitest";
import "@/tests/mocks/prisma";
import "@/tests/mocks/next-auth";
import { prismaMock } from "@/tests/mocks/prisma";
import { setSession, adminSession, brokerSession } from "@/tests/mocks/next-auth";
import { makeReqRes, jsonBody } from "@/tests/utils/apiHelpers";

vi.mock("@/lib/settings", () => ({
  invalidateSettingsCache: vi.fn(),
  DEFAULTS: {
    premium_early_access_enabled: "false",
    premium_window_hours: "12",
    premium_valve_hours: "6",
    premium_valve_min_responses: "2",
    free_tier_credits: "0",
  },
}));

import handler from "@/pages/api/admin/settings";

describe("PUT /api/admin/settings — premium early-access validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSession(adminSession());
    prismaMock.systemSetting.upsert.mockResolvedValue({} as never);
    prismaMock.adminAction.create.mockResolvedValue({} as never);
    prismaMock.systemSetting.findMany.mockResolvedValue([] as never);
    // Default: feature was previously OFF (no row) + backlog-release stub.
    prismaMock.systemSetting.findUnique.mockResolvedValue(null);
    prismaMock.borrowerRequest.updateMany.mockResolvedValue({ count: 0 } as never);
  });

  const put = (body: Record<string, string>) => makeReqRes({ method: "PUT", body });

  it("403s for a non-admin", async () => {
    setSession(brokerSession());
    const { req, res } = put({ premium_window_hours: "12" });
    await handler(req, res);
    expect(res.statusCode).toBe(403);
  });

  it("GET returns effective values (stored rows overlaid on code defaults)", async () => {
    prismaMock.systemSetting.findMany.mockResolvedValue([
      { key: "premium_window_hours", value: "8" },
    ] as never);
    const { req, res } = makeReqRes({ method: "GET" });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    const body = jsonBody<Record<string, string>>(res);
    expect(body.premium_window_hours).toBe("8"); // stored override wins
    expect(body.premium_valve_hours).toBe("6"); // falls back to default
    expect(body.premium_early_access_enabled).toBe("false"); // default
  });

  it("rejects a zero window", async () => {
    const { req, res } = put({ premium_window_hours: "0" });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(prismaMock.systemSetting.upsert).not.toHaveBeenCalled();
  });

  it("rejects a non-integer window", async () => {
    const { req, res } = put({ premium_window_hours: "abc" });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("rejects a negative min-responses", async () => {
    const { req, res } = put({ premium_valve_min_responses: "-1" });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("rejects valve >= window", async () => {
    const { req, res } = put({ premium_window_hours: "6", premium_valve_hours: "12" });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("accepts a valid premium config", async () => {
    const { req, res } = put({
      premium_window_hours: "12",
      premium_valve_hours: "6",
      premium_valve_min_responses: "2",
      premium_early_access_enabled: "true",
    });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(prismaMock.systemSetting.upsert).toHaveBeenCalled();
  });

  it("accepts a min-responses of 0", async () => {
    const { req, res } = put({ premium_valve_min_responses: "0" });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  it("releases the OPEN backlog when the feature is switched ON (false→true)", async () => {
    prismaMock.systemSetting.findUnique.mockResolvedValue(null); // not previously enabled
    prismaMock.borrowerRequest.updateMany.mockResolvedValue({ count: 3 } as never);

    const { req, res } = put({ premium_early_access_enabled: "true" });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(prismaMock.borrowerRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "OPEN", premiumReleasedAt: null },
        data: expect.objectContaining({ premiumReleasedAt: expect.any(Date) }),
      }),
    );
  });

  it("does NOT release the backlog when re-saving while already enabled", async () => {
    prismaMock.systemSetting.findUnique.mockResolvedValue({
      key: "premium_early_access_enabled",
      value: "true",
    } as never);

    const { req, res } = put({ premium_early_access_enabled: "true", premium_window_hours: "10" });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(prismaMock.borrowerRequest.updateMany).not.toHaveBeenCalled();
  });
});
