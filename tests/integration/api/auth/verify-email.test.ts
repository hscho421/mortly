import { describe, it, expect, beforeEach, vi } from "vitest";
import "@/tests/mocks/prisma";
import { prismaMock } from "@/tests/mocks/prisma";
import { makeReqRes, jsonBody } from "@/tests/utils/apiHelpers";
import handler from "@/pages/api/auth/verify-email";

function post(body: unknown) {
  const ip = `10.1.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  return makeReqRes({ method: "POST", body, headers: { "x-forwarded-for": ip } });
}

describe("POST /api/auth/verify-email", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-POST", async () => {
    const { req, res } = makeReqRes({ method: "GET" });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it("400s when email or code missing", async () => {
    const { req, res } = post({ email: "a@b.c" });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("flips emailVerified=true on valid code", async () => {
    const futureExpiry = new Date(Date.now() + 5 * 60 * 1000);
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      emailVerified: false,
      verificationCode: "123456",
      verificationCodeExpiry: futureExpiry,
    } as never);
    prismaMock.user.update.mockResolvedValue({} as never);

    const { req, res } = post({ email: "a@b.c", code: "123456" });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(jsonBody<{ success: boolean }>(res).success).toBe(true);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: expect.objectContaining({
        emailVerified: true,
        verificationCode: null,
        verificationCodeExpiry: null,
      }),
    });
  });

  it("rejects an expired code", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      emailVerified: false,
      verificationCode: "123456",
      verificationCodeExpiry: new Date(Date.now() - 1000),
    } as never);

    const { req, res } = post({ email: "a@b.c", code: "123456" });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(jsonBody<{ expired: boolean }>(res).expired).toBe(true);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("rejects a wrong-length code without touching DB", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      emailVerified: false,
      verificationCode: "123456",
      verificationCodeExpiry: new Date(Date.now() + 60_000),
    } as never);

    const { req, res } = post({ email: "a@b.c", code: "12345" });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("returns 200 idempotently when user is already verified", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      emailVerified: true,
      verificationCode: null,
      verificationCodeExpiry: null,
    } as never);

    const { req, res } = post({ email: "a@b.c", code: "anything" });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("doesn't leak whether the email exists", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const { req, res } = post({ email: "ghost@nobody.com", code: "000000" });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    // Same generic message regardless of existence.
    expect(jsonBody<{ message: string }>(res).message).toMatch(/Invalid code/);
  });

  it("rejects after 6 attempts on the same email", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      emailVerified: false,
      verificationCode: "000000",
      verificationCodeExpiry: new Date(Date.now() + 60_000),
    } as never);

    const email = `burst-${Math.random()}@test.com`;
    for (let i = 0; i < 5; i++) {
      const { req, res } = post({ email, code: "111111" });
      await handler(req, res);
      expect(res.statusCode).toBe(400); // invalid code, but not rate-limited yet
    }
    const { req, res } = post({ email, code: "111111" });
    await handler(req, res);
    expect(res.statusCode).toBe(429);
  });
});
