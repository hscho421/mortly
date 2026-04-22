import { describe, it, expect, beforeEach, vi } from "vitest";
import "@/tests/mocks/prisma";
import "@/tests/mocks/next-auth";
import { prismaMock } from "@/tests/mocks/prisma";
import { setSession, borrowerSession, brokerSession } from "@/tests/mocks/next-auth";
import { makeReqRes, jsonBody } from "@/tests/utils/apiHelpers";
import { makeConversation, makeMessage } from "@/tests/fixtures/requests";

vi.mock("@/lib/settings", () => ({
  getSettingInt: vi.fn(async (k: string) => (k === "broker_initial_message_limit" ? 3 : 0)),
  getSettingBool: vi.fn(async () => false),
  getSetting: vi.fn(async () => ""),
  invalidateSettingsCache: vi.fn(),
}));

vi.mock("@/lib/push", () => ({
  sendPushToUsers: vi.fn(async () => undefined),
  messagePush: vi.fn(() => ({ title: "t", body: "b" })),
  brokerInquiryPush: vi.fn(() => ({ title: "t", body: "b" })),
  borrowerInquiryPush: vi.fn(() => ({ title: "t", body: "b" })),
}));

import handler from "@/pages/api/messages/index";

const convoWithParticipants = {
  id: "conv_1",
  borrowerId: "user_borrower_1",
  broker: {
    userId: "user_broker_1",
    brokerageName: "Acme",
    user: { name: "Brenda" },
  },
  borrower: { id: "user_borrower_1", name: "Bob" },
};

describe("POST /api/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.conversation.findUnique.mockResolvedValue(convoWithParticipants as never);
    prismaMock.userBlock.findFirst.mockResolvedValue(null);
    prismaMock.message.groupBy.mockResolvedValue([] as never);
    prismaMock.message.create.mockResolvedValue(makeMessage());
    prismaMock.conversation.update.mockResolvedValue(makeConversation());
  });

  it("rejects unauthenticated", async () => {
    setSession(null);
    const { req, res } = makeReqRes({ method: "POST", body: { conversationId: "conv_1", body: "hi" } });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("borrower participant can send a message", async () => {
    setSession(borrowerSession());
    const { req, res } = makeReqRes({
      method: "POST",
      body: { conversationId: "conv_1", body: "  Hi there  " },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(201);
    // Must trim before persisting.
    const createArgs = prismaMock.message.create.mock.calls[0][0];
    expect(createArgs.data.body).toBe("Hi there");
    // Updates borrowerLastReadAt (self-read on send).
    const updateArgs = prismaMock.conversation.update.mock.calls[0][0];
    expect(updateArgs.data.borrowerLastReadAt).toBeInstanceOf(Date);
  });

  it("non-participant cannot send", async () => {
    setSession({ user: { id: "user_stranger", publicId: "x", email: "s@t", name: null, role: "BORROWER" } });
    const { req, res } = makeReqRes({
      method: "POST",
      body: { conversationId: "conv_1", body: "Hi" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(403);
    expect(prismaMock.message.create).not.toHaveBeenCalled();
  });

  it("rejects empty / whitespace-only body", async () => {
    setSession(borrowerSession());
    for (const body of ["", "   ", "\n\t"]) {
      const { req, res } = makeReqRes({
        method: "POST",
        body: { conversationId: "conv_1", body },
      });
      await handler(req, res);
      expect(res.statusCode).toBe(400);
    }
  });

  it("rejects body > 5000 chars", async () => {
    setSession(borrowerSession());
    const { req, res } = makeReqRes({
      method: "POST",
      body: { conversationId: "conv_1", body: "a".repeat(5001) },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("block list blocks sending in either direction", async () => {
    setSession(borrowerSession());
    prismaMock.userBlock.findFirst.mockResolvedValue({
      blockerId: "user_borrower_1",
      blockedId: "user_broker_1",
      createdAt: new Date(),
    } as never);

    const { req, res } = makeReqRes({
      method: "POST",
      body: { conversationId: "conv_1", body: "Hi" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(403);
    expect(prismaMock.message.create).not.toHaveBeenCalled();
  });

  it("broker hitting 3-message cap before borrower replies → 429", async () => {
    setSession(brokerSession());
    prismaMock.message.groupBy.mockResolvedValue([
      { senderId: "user_broker_1", _count: { _all: 3 } },
    ] as never);

    const { req, res } = makeReqRes({
      method: "POST",
      body: { conversationId: "conv_1", body: "Hey still here?" },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(429);
    expect(prismaMock.message.create).not.toHaveBeenCalled();
  });

  it("broker within cap sends successfully", async () => {
    setSession(brokerSession());
    prismaMock.message.groupBy.mockResolvedValue([
      { senderId: "user_broker_1", _count: { _all: 2 } },
    ] as never);

    const { req, res } = makeReqRes({
      method: "POST",
      body: { conversationId: "conv_1", body: "Follow-up" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(201);
  });

  it("broker cap doesn't apply once borrower has engaged", async () => {
    setSession(brokerSession());
    prismaMock.message.groupBy.mockResolvedValue([
      { senderId: "user_broker_1", _count: { _all: 10 } },
      { senderId: "user_borrower_1", _count: { _all: 1 } },
    ] as never);

    const { req, res } = makeReqRes({
      method: "POST",
      body: { conversationId: "conv_1", body: "Another one" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(201);
  });
});
