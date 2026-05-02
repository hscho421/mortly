import { describe, it, expect, beforeEach, vi } from "vitest";
import "@/tests/mocks/prisma";
import { prismaMock } from "@/tests/mocks/prisma";
import { makeReqRes, jsonBody } from "@/tests/utils/apiHelpers";
import { makeUser } from "@/tests/fixtures/users";
import { CURRENT_LEGAL_VERSION } from "@/lib/legal";

// The endpoint sends a real verification email. Stub it so tests never hit Resend.
vi.mock("@/lib/email", () => ({
  generateVerificationCode: vi.fn(() => "123456"),
  sendVerificationCode: vi.fn(async () => undefined),
}));

import handler from "@/pages/api/auth/signup";
import { sendVerificationCode } from "@/lib/email";

const VALID_BODY = () => ({
  name: "Bob Borrower",
  email: "new-borrower@test.com",
  password: "CorrectHorseBattery1",
  role: "BORROWER",
  locale: "en",
  legalVersion: CURRENT_LEGAL_VERSION,
});

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The endpoint uses an in-memory rate limiter keyed by IP. Tests rely on
    // fresh IPs via random header so buckets don't bleed.
  });

  function withFreshIp(body: unknown) {
    const ip = `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    return makeReqRes({
      method: "POST",
      body,
      headers: { "x-forwarded-for": ip },
    });
  }

  it("rejects non-POST methods", async () => {
    const { req, res } = makeReqRes({ method: "GET" });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it("creates a pending-verification user on happy path", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null); // email doesn't exist
    prismaMock.user.findUnique.mockResolvedValueOnce(null); // publicId collision check
    prismaMock.user.create.mockResolvedValue({
      ...makeUser({ email: VALID_BODY().email, emailVerified: false }),
    });

    const { req, res } = withFreshIp(VALID_BODY());
    await handler(req, res);

    expect(res.statusCode).toBe(201);
    const body = jsonBody<{ requiresVerification: boolean; emailSent: boolean }>(res);
    expect(body.requiresVerification).toBe(true);
    expect(body.emailSent).toBe(true);
    expect(sendVerificationCode).toHaveBeenCalledOnce();
    // Password must be hashed, not stored plaintext
    const createArgs = prismaMock.user.create.mock.calls[0][0];
    expect(createArgs.data.passwordHash).toBeDefined();
    expect(createArgs.data.passwordHash).not.toBe(VALID_BODY().password);
  });

  it.each([
    ["missing name", { name: undefined }, /All fields/],
    ["missing email", { email: undefined }, /All fields/],
    ["missing password", { password: undefined }, /All fields/],
    ["invalid email", { email: "not-an-email" }, /Invalid email/],
    ["short password", { password: "short" }, /8-200/],
    ["invalid role", { role: "HACKER" }, /Invalid role/],
  ])("returns 400 for %s", async (_label, patch, msg) => {
    const { req, res } = withFreshIp({ ...VALID_BODY(), ...patch });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(jsonBody<{ message: string }>(res).message).toMatch(msg);
  });

  it("rejects stale legal version", async () => {
    const { req, res } = withFreshIp({ ...VALID_BODY(), legalVersion: "1999-01-01" });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(jsonBody<{ message: string }>(res).message).toMatch(/Terms|Privacy/);
  });

  it("rejects duplicate email with 409", async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser());
    const { req, res } = withFreshIp(VALID_BODY());
    await handler(req, res);
    expect(res.statusCode).toBe(409);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("reports emailSent=false when Resend throws but still creates the user", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue(makeUser({ emailVerified: false }));
    (sendVerificationCode as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("SMTP down"));

    const { req, res } = withFreshIp(VALID_BODY());
    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect(jsonBody<{ emailSent: boolean }>(res).emailSent).toBe(false);
  });

  it("enforces rate limit per IP (6th request fails)", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue(makeUser({ emailVerified: false }));

    const ip = "10.99.99.99";
    const withIp = (body: unknown) =>
      makeReqRes({ method: "POST", body, headers: { "x-forwarded-for": ip } });

    for (let i = 0; i < 5; i++) {
      const { req, res } = withIp(VALID_BODY());
      await handler(req, res);
      expect(res.statusCode).toBe(201);
    }

    const { req, res } = withIp(VALID_BODY());
    await handler(req, res);
    expect(res.statusCode).toBe(429);
  });
});
