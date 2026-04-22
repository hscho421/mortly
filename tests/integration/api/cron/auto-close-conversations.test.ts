import { describe, it, expect, beforeEach, vi } from "vitest";
import "@/tests/mocks/prisma";
import { prismaMock } from "@/tests/mocks/prisma";
import { makeReqRes } from "@/tests/utils/apiHelpers";

import handler from "@/pages/api/cron/auto-close-conversations";

const SECRET = process.env.CRON_SECRET!;
const authHeaders = { authorization: `Bearer ${SECRET}` };

describe("POST /api/cron/auto-close-conversations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: nothing to close (override per test).
    prismaMock.conversation.findMany.mockResolvedValue([] as never);
    prismaMock.conversation.updateMany.mockResolvedValue({ count: 0 } as never);
    prismaMock.conversation.groupBy.mockResolvedValue([] as never);
    prismaMock.borrowerRequest.updateMany.mockResolvedValue({ count: 0 } as never);
  });

  // ─── Auth gates ──────────────────────────────────────────────

  it("405s on unsupported method", async () => {
    const { req, res } = makeReqRes({ method: "DELETE" });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it("401s without bearer token", async () => {
    const { req, res } = makeReqRes({ method: "POST" });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("401s on wrong secret", async () => {
    const { req, res } = makeReqRes({
      method: "POST",
      headers: { authorization: "Bearer wrong-secret" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(prismaMock.conversation.updateMany).not.toHaveBeenCalled();
  });

  it("401s on partial-prefix match (defends against early-exit compare bugs)", async () => {
    const { req, res } = makeReqRes({
      method: "POST",
      headers: { authorization: `Bearer ${SECRET}extra` },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("accepts both POST and GET (Vercel cron runners use GET)", async () => {
    for (const method of ["POST", "GET"] as const) {
      const { req, res } = makeReqRes({ method, headers: authHeaders });
      await handler(req, res);
      expect(res.statusCode, `method=${method}`).toBe(200);
    }
  });

  // ─── 72h-stale sweep ─────────────────────────────────────────

  it("closes conversations inactive for > 72h", async () => {
    prismaMock.conversation.findMany
      // First call: 72h-stale sweep
      .mockResolvedValueOnce([
        { id: "c1", request: { id: "r1", borrowerId: "b1" } },
        { id: "c2", request: { id: "r2", borrowerId: "b2" } },
      ] as never)
      // Second call: 7d-unstarted sweep — empty
      .mockResolvedValueOnce([] as never);
    prismaMock.conversation.updateMany.mockResolvedValueOnce({ count: 2 } as never);

    const { req, res } = makeReqRes({ method: "POST", headers: authHeaders });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const updateArgs = prismaMock.conversation.updateMany.mock.calls[0][0];
    expect(updateArgs.where.id).toEqual({ in: ["c1", "c2"] });
    expect(updateArgs.where.status).toBe("ACTIVE"); // guard against races
    expect(updateArgs.data.status).toBe("CLOSED");

    const cutoff = prismaMock.conversation.findMany.mock.calls[0][0].where.updatedAt.lt as Date;
    const hoursAgo = (Date.now() - cutoff.getTime()) / (60 * 60 * 1000);
    expect(hoursAgo).toBeGreaterThanOrEqual(71.9);
    expect(hoursAgo).toBeLessThanOrEqual(72.1);
  });

  // ─── 7d-unstarted sweep (borrower never replied) ─────────────

  it("closes 7d-unstarted conversations only where borrower never sent a message", async () => {
    // 3 convos: one where borrower replied, two where only the broker messaged.
    const convos = [
      // borrower engaged → must NOT close
      {
        id: "engaged",
        request: { id: "r1", borrowerId: "borrower_1" },
        messages: [
          { senderId: "broker_user_1" },
          { senderId: "borrower_1" }, // borrower reply present
        ],
      },
      // only broker messaged → must close
      {
        id: "silent_a",
        request: { id: "r2", borrowerId: "borrower_2" },
        messages: [{ senderId: "broker_user_2" }, { senderId: "broker_user_2" }],
      },
      // zero messages — still counts as "borrower never engaged"
      {
        id: "silent_b",
        request: { id: "r3", borrowerId: "borrower_3" },
        messages: [],
      },
    ];

    prismaMock.conversation.findMany
      .mockResolvedValueOnce([] as never) // 72h-stale sweep: none
      .mockResolvedValueOnce(convos as never);
    prismaMock.conversation.updateMany.mockResolvedValueOnce({ count: 2 } as never);

    const { req, res } = makeReqRes({ method: "POST", headers: authHeaders });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const ids = prismaMock.conversation.updateMany.mock.calls[0][0].where.id.in;
    expect(ids).toEqual(["silent_a", "silent_b"]);
    expect(ids).not.toContain("engaged");
  });

  // ─── Request cascade ────────────────────────────────────────

  it("when all conversations on an IN_PROGRESS request are now CLOSED, request → CLOSED too", async () => {
    prismaMock.conversation.findMany
      .mockResolvedValueOnce([
        { id: "c1", request: { id: "req_inprogress", borrowerId: "b1" } },
      ] as never)
      .mockResolvedValueOnce([] as never);
    prismaMock.conversation.updateMany.mockResolvedValueOnce({ count: 1 } as never);
    // After closing c1, no ACTIVE convos remain on req_inprogress.
    prismaMock.conversation.groupBy.mockResolvedValue([] as never);
    prismaMock.borrowerRequest.updateMany.mockResolvedValue({ count: 1 } as never);

    const { req, res } = makeReqRes({ method: "POST", headers: authHeaders });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const args = prismaMock.borrowerRequest.updateMany.mock.calls[0][0];
    // CRITICAL: only IN_PROGRESS requests get auto-closed. OPEN/PENDING must stay put.
    expect(args.where.status).toBe("IN_PROGRESS");
    expect(args.data.status).toBe("CLOSED");
    expect(args.where.id.in).toEqual(["req_inprogress"]);
  });

  it("does NOT cascade-close a request that still has OTHER active conversations", async () => {
    prismaMock.conversation.findMany
      .mockResolvedValueOnce([
        { id: "c1", request: { id: "req_1", borrowerId: "b1" } },
      ] as never)
      .mockResolvedValueOnce([] as never);
    prismaMock.conversation.updateMany.mockResolvedValueOnce({ count: 1 } as never);
    // One active convo remains on req_1.
    prismaMock.conversation.groupBy.mockResolvedValue([
      { requestId: "req_1", _count: { _all: 1 } },
    ] as never);

    const { req, res } = makeReqRes({ method: "POST", headers: authHeaders });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    // borrowerRequest.updateMany either not called, or called with an empty `in`.
    const calls = prismaMock.borrowerRequest.updateMany.mock.calls;
    if (calls.length > 0) {
      expect(calls[0][0].where.id.in).not.toContain("req_1");
    }
  });

  it("when nothing is stale, returns success with closedConversations=0 and does no writes", async () => {
    const { req, res } = makeReqRes({ method: "POST", headers: authHeaders });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    // No conversations to close → no updateMany at all
    expect(prismaMock.conversation.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.borrowerRequest.updateMany).not.toHaveBeenCalled();
    const body = JSON.parse(res._getData());
    expect(body).toEqual({ success: true, closedConversations: 0 });
  });
});
