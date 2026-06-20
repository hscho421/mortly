import { describe, it, expect, beforeEach, vi } from "vitest";
import "@/tests/mocks/prisma";
import { prismaMock } from "@/tests/mocks/prisma";
import { makeReqRes, jsonBody } from "@/tests/utils/apiHelpers";

// Feature enabled: window 12h, valve 6h, min 2 responses.
vi.mock("@/lib/settings", () => ({
  getSettingBool: vi.fn(async (key: string) => key === "premium_early_access_enabled"),
  getSettingInt: vi.fn(async (key: string) => {
    const map: Record<string, number> = {
      premium_window_hours: 12,
      premium_valve_hours: 6,
      premium_valve_min_responses: 2,
    };
    return map[key] ?? 0;
  }),
  getSetting: vi.fn(async () => ""),
  invalidateSettingsCache: vi.fn(),
}));

import { getSettingBool } from "@/lib/settings";
import handler from "@/pages/api/cron/release-premium-requests";

const SECRET = process.env.CRON_SECRET!;
const HOUR = 3_600_000;
const auth = () => ({ authorization: `Bearer ${SECRET}` });

// Candidate as returned by the cron's scoped findMany (select id/approvedAt/
// premiumReleasedAt/_count.conversations).
const cand = (id: string, hoursAgo: number, conversations: number) => ({
  id,
  approvedAt: new Date(Date.now() - hoursAgo * HOUR),
  premiumReleasedAt: null,
  _count: { conversations },
});

describe("cron/release-premium-requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401s without the cron secret", async () => {
    const { req, res } = makeReqRes({ method: "POST" });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(prismaMock.borrowerRequest.updateMany).not.toHaveBeenCalled();
  });

  it("no-ops when the feature is disabled", async () => {
    vi.mocked(getSettingBool).mockResolvedValueOnce(false);
    const { req, res } = makeReqRes({ method: "POST", headers: auth() });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(jsonBody<{ releasedCount: number }>(res).releasedCount).toBe(0);
    expect(prismaMock.borrowerRequest.findMany).not.toHaveBeenCalled();
  });

  it("releases hard-cap + valve requests but holds those with enough responses", async () => {
    prismaMock.borrowerRequest.findMany.mockResolvedValue([
      cand("a", 13, 5), // past 12h cap → release (count ignored)
      cand("b", 7, 1), // past 6h valve, < 2 responses → release
      cand("c", 7, 3), // past 6h valve, >= 2 responses → hold
    ] as never);
    prismaMock.borrowerRequest.updateMany.mockResolvedValue({ count: 2 } as never);

    const { req, res } = makeReqRes({ method: "POST", headers: auth() });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(jsonBody<{ releasedCount: number }>(res).releasedCount).toBe(2);

    const updateArgs = prismaMock.borrowerRequest.updateMany.mock.calls[0][0];
    expect(updateArgs.where.id).toEqual({ in: ["a", "b"] });
    // Idempotency guard: only latch rows still unreleased.
    expect(updateArgs.where.premiumReleasedAt).toBeNull();
    expect(updateArgs.data.premiumReleasedAt).toBeInstanceOf(Date);

    // The scan only considers OPEN, unreleased, approved requests.
    const findWhere = prismaMock.borrowerRequest.findMany.mock.calls[0][0].where;
    expect(findWhere.status).toBe("OPEN");
    expect(findWhere.premiumReleasedAt).toBeNull();
    expect(findWhere.approvedAt).toMatchObject({ not: null });
  });

  it("releases nothing when no candidate qualifies", async () => {
    prismaMock.borrowerRequest.findMany.mockResolvedValue([
      cand("c", 7, 3), // holds
    ] as never);

    const { req, res } = makeReqRes({ method: "POST", headers: auth() });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(jsonBody<{ releasedCount: number }>(res).releasedCount).toBe(0);
    expect(prismaMock.borrowerRequest.updateMany).not.toHaveBeenCalled();
  });
});
