import { describe, it, expect, vi, beforeEach } from "vitest";

// Vercel KV is module-scoped — override to a controllable spy before
// importing the limiter so we can assert it's actually called.
const kvMock = {
  incr: vi.fn(async () => 1),
  pexpire: vi.fn(async () => 1),
};
vi.mock("@vercel/kv", () => ({ kv: kvMock }));

describe("checkRateLimit (Phase 7: Vercel KV)", () => {
  beforeEach(() => {
    kvMock.incr.mockReset();
    kvMock.pexpire.mockReset();
    vi.resetModules();
    delete process.env.KV_REST_API_URL;
  });

  it("falls back to in-memory when KV_REST_API_URL is unset", async () => {
    const mod = await import("@/lib/rate-limit");
    const r1 = await mod.checkRateLimit({ key: "user-1", limit: 2, windowMs: 1000 });
    const r2 = await mod.checkRateLimit({ key: "user-1", limit: 2, windowMs: 1000 });
    const r3 = await mod.checkRateLimit({ key: "user-1", limit: 2, windowMs: 1000 });
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(r3.success).toBe(false);
    expect(kvMock.incr).not.toHaveBeenCalled();
  });

  it("uses KV when KV_REST_API_URL is set", async () => {
    process.env.KV_REST_API_URL = "https://fake-kv.example.com";
    kvMock.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    const mod = await import("@/lib/rate-limit");

    const first = await mod.checkRateLimit({ key: "admin-1", limit: 3, windowMs: 60000 });
    expect(first.success).toBe(true);
    expect(first.remaining).toBe(2);
    // First increment sets expiry; second does not.
    expect(kvMock.pexpire).toHaveBeenCalledTimes(1);
    expect(kvMock.pexpire.mock.calls[0]).toEqual(["rl:admin-1", 60000]);

    const second = await mod.checkRateLimit({ key: "admin-1", limit: 3, windowMs: 60000 });
    expect(second.success).toBe(true);
    expect(second.remaining).toBe(1);
    expect(kvMock.pexpire).toHaveBeenCalledTimes(1);
  });

  it("returns success=false when KV counter exceeds limit", async () => {
    process.env.KV_REST_API_URL = "https://fake-kv.example.com";
    kvMock.incr.mockResolvedValueOnce(11);
    const mod = await import("@/lib/rate-limit");
    const res = await mod.checkRateLimit({ key: "admin-2", limit: 10, windowMs: 60000 });
    expect(res.success).toBe(false);
    expect(res.remaining).toBe(0);
  });

  it("fails open if KV throws (doesn't lock admins out on outage)", async () => {
    process.env.KV_REST_API_URL = "https://fake-kv.example.com";
    kvMock.incr.mockRejectedValueOnce(new Error("network down"));
    const mod = await import("@/lib/rate-limit");
    const res = await mod.checkRateLimit({ key: "admin-3", limit: 10, windowMs: 60000 });
    expect(res.success).toBe(true);
  });

  it("scopes keys so different admins don't share a counter", async () => {
    process.env.KV_REST_API_URL = "https://fake-kv.example.com";
    kvMock.incr.mockResolvedValue(1);
    const mod = await import("@/lib/rate-limit");
    await mod.checkRateLimit({ key: "admin-A", limit: 5, windowMs: 1000 });
    await mod.checkRateLimit({ key: "admin-B", limit: 5, windowMs: 1000 });
    expect(kvMock.incr.mock.calls[0]?.[0]).toBe("rl:admin-A");
    expect(kvMock.incr.mock.calls[1]?.[0]).toBe("rl:admin-B");
  });
});
