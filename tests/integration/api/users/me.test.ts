import { describe, it, expect, beforeEach, vi } from "vitest";
import "@/tests/mocks/prisma";
import { prismaMock } from "@/tests/mocks/prisma";
import { setSession, clearSession, borrowerSession } from "@/tests/mocks/next-auth";
import { makeReqRes, jsonBody } from "@/tests/utils/apiHelpers";

vi.mock("@/lib/origin", () => ({ isAllowedOrigin: vi.fn(() => false) }));

import handler from "@/pages/api/users/me";

const MOBILE = { "x-mortly-mobile": "1" };

describe("GET /api/users/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSession();
  });

  it("401 when unauthenticated", async () => {
    const { req, res } = makeReqRes({ method: "GET", headers: MOBILE });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("403 for a non-mobile cross-origin request", async () => {
    setSession(borrowerSession());
    const { req, res } = makeReqRes({ method: "GET" }); // no mobile header → CSRF gate applies
    await handler(req, res);
    expect(res.statusCode).toBe(403);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("200 returns the fresh user (mobile), deriving onboarding flags from prefs", async () => {
    setSession(borrowerSession({ id: "u1" }));
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1", publicId: "100000001", email: "b@test.com", name: "Bo", role: "BORROWER",
      preferences: { needsRoleSelection: false }, status: "ACTIVE",
    } as never);
    const { req, res } = makeReqRes({ method: "GET", headers: MOBILE });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(jsonBody<{ user: unknown }>(res).user).toEqual({
      id: "u1", publicId: "100000001", email: "b@test.com", name: "Bo", role: "BORROWER",
      needsRoleSelection: false, needsNameEntry: false, status: "ACTIVE",
    });
  });

  it("derives needsNameEntry when the name is missing", async () => {
    setSession(borrowerSession({ id: "u2" }));
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u2", publicId: "100000002", email: "n@test.com", name: null, role: "BORROWER",
      preferences: null, status: "ACTIVE",
    } as never);
    const { req, res } = makeReqRes({ method: "GET", headers: MOBILE });
    await handler(req, res);
    expect(jsonBody<{ user: { needsNameEntry: boolean } }>(res).user.needsNameEntry).toBe(true);
  });

  it("404 when the session user no longer exists (e.g. deleted)", async () => {
    setSession(borrowerSession({ id: "gone" }));
    prismaMock.user.findUnique.mockResolvedValue(null);
    const { req, res } = makeReqRes({ method: "GET", headers: MOBILE });
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });
});
