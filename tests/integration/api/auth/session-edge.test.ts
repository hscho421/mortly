/**
 * Session edge cases.
 *
 * Not "tests that next-auth correctly validates JWT signatures" — that's
 * library code. Instead: "when next-auth returns an expired/missing/malformed
 * session, our handlers behave safely". The `getServerSession` mock lets us
 * inject any shape the middleware might produce in weird real-world cases.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import "@/tests/mocks/prisma";
import "@/tests/mocks/next-auth";
import { prismaMock } from "@/tests/mocks/prisma";
import { setSession } from "@/tests/mocks/next-auth";
import { makeReqRes } from "@/tests/utils/apiHelpers";

vi.mock("@/lib/settings", () => ({
  getSettingInt: vi.fn(async () => 10),
  getSettingBool: vi.fn(async () => false),
  getSetting: vi.fn(async () => ""),
  invalidateSettingsCache: vi.fn(),
}));
vi.mock("@/lib/publicId", () => ({
  generatePublicId: vi.fn(async () => "100000099"),
  generateRequestPublicId: vi.fn(async () => "300000099"),
  generateConversationPublicId: vi.fn(async () => "400000099"),
}));

import requestsHandler from "@/pages/api/requests/index";
import conversationsHandler from "@/pages/api/conversations/index";
import adminCreditsHandler from "@/pages/api/admin/credits";
import usersMeHandler from "@/pages/api/users/me";

describe("Session edge cases", () => {
  beforeEach(() => vi.clearAllMocks());

  it("expired session (null) → every authenticated endpoint returns 401", async () => {
    setSession(null); // simulates getServerSession returning null for expired JWT

    const cases: Array<[string, (req: any, res: any) => Promise<unknown>]> = [
      ["POST /api/requests", requestsHandler],
      ["POST /api/conversations", conversationsHandler],
      ["DELETE /api/users/me", usersMeHandler],
    ];

    for (const [label, handler] of cases) {
      const { req, res } = makeReqRes({
        method: label.startsWith("DELETE") ? "DELETE" : "POST",
        body: {},
      });
      await handler(req, res);
      expect(res.statusCode, label).toBe(401);
    }
  });

  it("admin endpoint: non-admin session returns 403 (not 500) even with malformed user shape", async () => {
    // Defensive: withAdmin reads `session.user.role` — if next-auth callbacks
    // fail to populate role (weird middleware state), must reject, not crash.
    setSession({
      user: {
        id: "user_1",
        publicId: "100000001",
        email: "x@y.com",
        name: null,
        role: undefined as unknown as "BORROWER", // missing role
      },
    } as never);

    const { req, res } = makeReqRes({
      method: "POST",
      body: { brokerId: "broker_1", amount: 5 },
    });
    await adminCreditsHandler(req, res);
    expect([401, 403]).toContain(res.statusCode);
    expect(prismaMock.broker.update).not.toHaveBeenCalled();
  });

  it("session with wrong role on admin endpoint: 403, never reaches DB", async () => {
    setSession({
      user: {
        id: "user_1",
        publicId: "100000001",
        email: "x@y.com",
        name: null,
        role: "BORROWER",
      },
    });

    const { req, res } = makeReqRes({
      method: "POST",
      body: { brokerId: "broker_1", amount: -1000 }, // would be destructive if it landed
    });
    await adminCreditsHandler(req, res);
    expect(res.statusCode).toBe(403);
    expect(prismaMock.broker.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.broker.update).not.toHaveBeenCalled();
  });

  it("user tries to delete another account via session spoofing: DELETE /api/users/me only deletes session.user.id", async () => {
    // Even if attacker passes `body: { userId: "victim" }`, the handler
    // ignores body and uses session.user.id. This asserts the contract.
    setSession({
      user: {
        id: "attacker_1",
        publicId: "100000001",
        email: "attacker@test.com",
        name: null,
        role: "BORROWER",
      },
    });
    // OAuth-only attacker (no passwordHash) — must pass the typed ack.
    // Real fix here is the other direction: a credentials user must now pass
    // currentPassword. Either way, body-supplied `userId` is still ignored.
    prismaMock.user.findUnique.mockResolvedValue({
      id: "attacker_1",
      role: "BORROWER",
      passwordHash: null,
      broker: null,
      borrowerRequests: [],
      conversations: [],
    } as never);
    prismaMock.conversation.findMany.mockResolvedValue([] as never);

    const { req, res } = makeReqRes({
      method: "DELETE",
      body: { userId: "victim_1", ack: "DELETE_MY_ACCOUNT" }, // userId ignored
    });
    await usersMeHandler(req, res);

    expect(res.statusCode).toBe(200);
    // Delete targeted attacker_1, not victim_1.
    const findUniqueCall = prismaMock.user.findUnique.mock.calls[0][0];
    expect(findUniqueCall.where.id).toBe("attacker_1");
  });

  it("admin cannot self-delete (Apple 5.1.1 + anti-lockout)", async () => {
    setSession({
      user: {
        id: "admin_1",
        publicId: "900000001",
        email: "admin@test.com",
        name: null,
        role: "ADMIN",
      },
    });
    prismaMock.user.findUnique.mockResolvedValue({
      id: "admin_1",
      role: "ADMIN",
      broker: null,
      borrowerRequests: [],
      conversations: [],
    } as never);

    const { req, res } = makeReqRes({ method: "DELETE", body: {} });
    await usersMeHandler(req, res);
    expect(res.statusCode).toBe(403);
    expect(prismaMock.user.delete).not.toHaveBeenCalled();
  });
});
