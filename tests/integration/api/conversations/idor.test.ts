/**
 * IDOR coverage for `/api/conversations/[id]`.
 *
 * The handler authorizes via "is the requester the borrower OR the broker
 * on this conversation?". This test asserts the negative path — a logged-in
 * user who is neither participant gets 403 even when they know the
 * conversation id. Without this test, a refactor that drops the participant
 * check would silently expose every chat in the system to any logged-in user.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import "@/tests/mocks/prisma";
import "@/tests/mocks/next-auth";
import { prismaMock } from "@/tests/mocks/prisma";
import { setSession, borrowerSession } from "@/tests/mocks/next-auth";
import { makeReqRes } from "@/tests/utils/apiHelpers";
import handler from "@/pages/api/conversations/[id]";

describe("GET /api/conversations/[id] — IDOR", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("403s when the viewer is neither borrower nor broker on the conversation", async () => {
    // Attacker session — a logged-in borrower whose id matches NEITHER
    // the conversation.borrowerId NOR the conversation.broker.userId.
    setSession(
      borrowerSession({
        id: "attacker_user",
        publicId: "999999999",
      }),
    );

    // Realistic conversation row owned by entirely different parties.
    prismaMock.conversation.findUnique.mockResolvedValue({
      id: "conv_target",
      publicId: "400000111",
      requestId: "req_target",
      borrowerId: "victim_borrower",
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
      borrowerLastReadAt: null,
      brokerLastReadAt: null,
      messages: [],
      broker: {
        id: "victim_broker",
        userId: "victim_broker_user",
        brokerageName: "Acme",
        verificationStatus: "VERIFIED",
        user: { id: "victim_broker_user", publicId: "200000111", name: "Brenda" },
      },
      borrower: {
        id: "victim_borrower",
        publicId: "100000111",
        name: "Bob",
      },
      request: null,
    } as never);

    const { req, res } = makeReqRes({
      method: "GET",
      query: { id: "conv_target" },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(403);
    // The handler must NOT mark the conversation as read on behalf of an
    // unauthorized viewer — that would update lastReadAt for a chat they
    // can't even see, leaking activity to the real participants.
    expect(prismaMock.conversation.update).not.toHaveBeenCalled();
  });

  it("404s when the conversation does not exist (no info disclosure)", async () => {
    setSession(borrowerSession());
    prismaMock.conversation.findUnique.mockResolvedValue(null);

    const { req, res } = makeReqRes({
      method: "GET",
      query: { id: "does_not_exist" },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(404);
  });
});
