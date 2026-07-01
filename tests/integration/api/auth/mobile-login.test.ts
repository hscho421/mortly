import { describe, it, expect, beforeEach, vi } from "vitest";
import "@/tests/mocks/prisma";
import { prismaMock } from "@/tests/mocks/prisma";
import { makeReqRes, jsonBody } from "@/tests/utils/apiHelpers";

vi.mock("bcryptjs", () => ({ compare: vi.fn(), hash: vi.fn(async () => "$2b$12$hash") }));
vi.mock("next-auth/jwt", () => ({ encode: vi.fn(async () => "signed.jwt.token") }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ success: true })),
  getClientIp: () => "1.2.3.4",
}));

import { compare } from "bcryptjs";
import { encode } from "next-auth/jwt";
import { checkRateLimit } from "@/lib/rate-limit";
import handler from "@/pages/api/auth/mobile-login";

const baseUser = {
  id: "u1",
  publicId: "100000001",
  email: "borrower@test.com",
  name: "Bo Rower",
  role: "BORROWER",
  passwordHash: "$2b$12$realhash",
  emailVerified: true,
  status: "ACTIVE",
  tokenVersion: 3,
  preferences: null,
} as never;

const post = (body: unknown) => makeReqRes({ method: "POST", body });

describe("POST /api/auth/mobile-login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTAUTH_SECRET = "test-secret";
    (checkRateLimit as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({ success: true });
    (compare as unknown as { mockResolvedValue: (v: boolean) => void }).mockResolvedValue(true);
  });

  it("405s on non-POST", async () => {
    const { req, res } = makeReqRes({ method: "GET" });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it("429s when rate-limited (before touching the DB)", async () => {
    (checkRateLimit as unknown as { mockResolvedValueOnce: (v: unknown) => void }).mockResolvedValueOnce({ success: false });
    const { req, res } = post({ email: "a@b.com", password: "x" });
    await handler(req, res);
    expect(res.statusCode).toBe(429);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("400 MISSING_CREDENTIALS when email/password absent", async () => {
    const { req, res } = post({});
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(jsonBody<{ error: string }>(res).error).toBe("MISSING_CREDENTIALS");
  });

  it("401 INVALID_CREDENTIALS for a wrong password", async () => {
    prismaMock.user.findUnique.mockResolvedValue(baseUser);
    (compare as unknown as { mockResolvedValue: (v: boolean) => void }).mockResolvedValue(false);
    const { req, res } = post({ email: "borrower@test.com", password: "nope" });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(jsonBody<{ error: string }>(res).error).toBe("INVALID_CREDENTIALS");
  });

  it("401 INVALID_CREDENTIALS for a non-existent account (timing-safe)", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    (compare as unknown as { mockResolvedValue: (v: boolean) => void }).mockResolvedValue(false);
    const { req, res } = post({ email: "ghost@test.com", password: "x" });
    await handler(req, res);
    // still ran a bcrypt compare (against the dummy hash) before failing
    expect(compare).toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(jsonBody<{ error: string }>(res).error).toBe("INVALID_CREDENTIALS");
  });

  it("401 GOOGLE_ACCOUNT for an OAuth-only account (no password set)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash: null } as never);
    const { req, res } = post({ email: "borrower@test.com", password: "x" });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(jsonBody<{ error: string }>(res).error).toBe("GOOGLE_ACCOUNT");
  });

  it("401 EMAIL_NOT_VERIFIED for an unverified account", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...baseUser, emailVerified: false } as never);
    const { req, res } = post({ email: "borrower@test.com", password: "x" });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(jsonBody<{ error: string }>(res).error).toBe("EMAIL_NOT_VERIFIED");
  });

  it("403 ACCOUNT_SUSPENDED / ACCOUNT_BANNED", async () => {
    for (const [status, code] of [["SUSPENDED", "ACCOUNT_SUSPENDED"], ["BANNED", "ACCOUNT_BANNED"]] as const) {
      prismaMock.user.findUnique.mockResolvedValue({ ...baseUser, status } as never);
      const { req, res } = post({ email: "borrower@test.com", password: "x" });
      await handler(req, res);
      expect(res.statusCode).toBe(403);
      expect(jsonBody<{ error: string }>(res).error).toBe(code);
    }
  });

  it("200 mints a 30-day session token + safe user on success", async () => {
    prismaMock.user.findUnique.mockResolvedValue(baseUser);
    const { req, res } = post({ email: "borrower@test.com", password: "correct" });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const body = jsonBody<{ sessionToken: string; user: Record<string, unknown> }>(res);
    expect(body.sessionToken).toBe("signed.jwt.token");
    expect(body.user).toEqual({
      id: "u1",
      publicId: "100000001",
      email: "borrower@test.com",
      name: "Bo Rower",
      role: "BORROWER",
      needsRoleSelection: false,
      needsNameEntry: false,
    });
    // The JWT embeds tokenVersion + status (for server-side revocation) and a 30-day TTL.
    const arg = (encode as unknown as { mock: { calls: { 0: { token: Record<string, unknown>; maxAge: number } }[] } }).mock.calls[0][0];
    expect(arg.token).toMatchObject({ id: "u1", role: "BORROWER", tokenVersion: 3, status: "ACTIVE" });
    expect(arg.maxAge).toBe(30 * 24 * 60 * 60);
    // Never leak the hash.
    expect(JSON.stringify(body)).not.toContain("realhash");
  });
});
