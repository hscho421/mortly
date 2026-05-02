import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextApiRequest, NextApiResponse } from "next";

// Mock the auth + rate-limit deps so we can focus the test on the CSRF gate.
vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(async () => ({
    user: { id: "admin_1", role: "ADMIN" },
  })),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ success: true, remaining: 29 })),
}));

import { withAdmin } from "@/lib/admin/withAdmin";

interface MockRes {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
  headersSent: boolean;
  statusCode: number;
  jsonBody: unknown;
}

function makeReq(opts: {
  method: string;
  host: string;
  origin?: string;
  referer?: string;
}): NextApiRequest {
  const headers: Record<string, string> = { host: opts.host };
  if (opts.origin) headers.origin = opts.origin;
  if (opts.referer) headers.referer = opts.referer;
  return {
    method: opts.method,
    headers,
    url: "/api/admin/test",
    body: {},
  } as unknown as NextApiRequest;
}

function makeRes(): MockRes {
  const res: MockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
    headersSent: false,
    statusCode: 200,
    jsonBody: undefined,
  };
  res.status.mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json.mockImplementation((body: unknown) => {
    res.jsonBody = body;
    return res;
  });
  return res;
}

describe("withAdmin CSRF gate", () => {
  const handler = vi.fn(async () => {});
  const wrapped = withAdmin(handler);

  beforeEach(() => {
    handler.mockClear();
  });

  it("allows GET requests with no Origin header (reads aren't CSRF-risky)", async () => {
    const req = makeReq({ method: "GET", host: "example.com" });
    const res = makeRes();
    await wrapped(req, res as unknown as NextApiResponse);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  it("rejects POST with missing Origin/Referer (403)", async () => {
    const req = makeReq({ method: "POST", host: "example.com" });
    const res = makeRes();
    await wrapped(req, res as unknown as NextApiResponse);
    expect(handler).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.jsonBody).toEqual({ error: "Cross-origin request rejected" });
  });

  it("rejects POST with cross-origin Origin header", async () => {
    const req = makeReq({
      method: "POST",
      host: "example.com",
      origin: "https://attacker.com",
    });
    const res = makeRes();
    await wrapped(req, res as unknown as NextApiResponse);
    expect(handler).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("allows POST when Origin is in the server-side allowlist (NEXTAUTH_URL)", async () => {
    // Allowlist now drives CSRF, not host equality. NEXTAUTH_URL
    // (= http://localhost:3000 in tests) is the trusted origin.
    const req = makeReq({
      method: "POST",
      host: "example.com",
      origin: "http://localhost:3000",
    });
    const res = makeRes();
    await wrapped(req, res as unknown as NextApiResponse);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("falls back to Referer when Origin is absent", async () => {
    const req = makeReq({
      method: "PUT",
      host: "example.com",
      referer: "http://localhost:3000/admin/people",
    });
    const res = makeRes();
    await wrapped(req, res as unknown as NextApiResponse);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("rejects DELETE with malformed Origin", async () => {
    const req = makeReq({
      method: "DELETE",
      host: "example.com",
      origin: "not-a-url",
    });
    const res = makeRes();
    await wrapped(req, res as unknown as NextApiResponse);
    expect(handler).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("rejects POST whose Origin includes a different port than host", async () => {
    const req = makeReq({
      method: "POST",
      host: "example.com:3000",
      origin: "https://example.com:4000",
    });
    const res = makeRes();
    await wrapped(req, res as unknown as NextApiResponse);
    expect(handler).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });
});
