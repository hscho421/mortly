import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeReqRes, jsonBody } from "@/tests/utils/apiHelpers";

// Mock the three job modules — this test verifies the dispatcher's orchestration
// (auth gate, runs every job, isolates failures), not the jobs themselves (which
// have their own tests).
vi.mock("@/pages/api/cron/expire-requests", () => ({
  runExpireRequests: vi.fn(async () => ({ expiredCount: 2 })),
}));
vi.mock("@/pages/api/cron/auto-close-conversations", () => ({
  runAutoCloseConversations: vi.fn(async () => ({ closedConversations: 1 })),
}));
vi.mock("@/pages/api/cron/purge-expired", () => ({
  runPurgeExpired: vi.fn(async () => ({ purgedRequests: 3, redactedMessages: 4 })),
}));

import handler from "@/pages/api/cron/daily";
import { runExpireRequests } from "@/pages/api/cron/expire-requests";
import { runAutoCloseConversations } from "@/pages/api/cron/auto-close-conversations";
import { runPurgeExpired } from "@/pages/api/cron/purge-expired";

const SECRET = process.env.CRON_SECRET!;
const authHeaders = { authorization: `Bearer ${SECRET}` };

describe("cron/daily dispatcher", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401s without the cron secret (and runs no jobs)", async () => {
    const { req, res } = makeReqRes({ method: "POST" });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(runExpireRequests).not.toHaveBeenCalled();
    expect(runPurgeExpired).not.toHaveBeenCalled();
  });

  it("runs all three jobs and returns their results", async () => {
    const { req, res } = makeReqRes({ method: "GET", headers: authHeaders });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(runExpireRequests).toHaveBeenCalledTimes(1);
    expect(runAutoCloseConversations).toHaveBeenCalledTimes(1);
    expect(runPurgeExpired).toHaveBeenCalledTimes(1);

    const body = jsonBody<{ success: boolean; results: Record<string, unknown> }>(res);
    expect(body.success).toBe(true);
    expect(body.results.expireRequests).toEqual({ expiredCount: 2 });
    expect(body.results.purgeExpired).toEqual({ purgedRequests: 3, redactedMessages: 4 });
  });

  it("isolates a failing job — the others still run and the response is 500", async () => {
    vi.mocked(runAutoCloseConversations).mockRejectedValueOnce(new Error("boom"));
    const { req, res } = makeReqRes({ method: "POST", headers: authHeaders });
    await handler(req, res);

    expect(res.statusCode).toBe(500);
    // The job BEFORE and AFTER the failure both still ran — purge (the PIPEDA
    // job) must never be skipped just because an earlier step threw.
    expect(runExpireRequests).toHaveBeenCalledTimes(1);
    expect(runPurgeExpired).toHaveBeenCalledTimes(1);

    const body = jsonBody<{ success: boolean; errors: Record<string, string> }>(res);
    expect(body.success).toBe(false);
    expect(body.errors.autoCloseConversations).toBe("boom");
  });
});
