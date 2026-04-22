import { describe, it, expect, beforeEach, vi } from "vitest";
import "@/tests/mocks/prisma";
import "@/tests/mocks/next-auth";
import { prismaMock } from "@/tests/mocks/prisma";
import { setSession, borrowerSession, brokerSession } from "@/tests/mocks/next-auth";
import { makeReqRes, jsonBody } from "@/tests/utils/apiHelpers";
import { makeBroker } from "@/tests/fixtures/users";
import { makeBorrowerRequest, makeConversation } from "@/tests/fixtures/requests";

vi.mock("@/lib/publicId", () => ({
  generatePublicId: vi.fn(async () => "100000099"),
  generateRequestPublicId: vi.fn(async () => "300000099"),
  generateConversationPublicId: vi.fn(async () => "400000099"),
}));

// Don't actually push anything during tests.
vi.mock("@/lib/push", () => ({
  sendPushToUsers: vi.fn(async () => undefined),
  brokerInquiryPush: vi.fn(() => ({ title: "t", body: "b" })),
  borrowerInquiryPush: vi.fn(() => ({ title: "t", body: "b" })),
  messagePush: vi.fn(() => ({ title: "t", body: "b" })),
}));

import handler from "@/pages/api/conversations/index";

describe("POST /api/conversations — broker-initiated (credit economy)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSession(brokerSession());
    prismaMock.borrowerRequest.findUnique.mockResolvedValue(
      makeBorrowerRequest({ borrowerId: "user_borrower_1" })
    );
    prismaMock.userBlock.findFirst.mockResolvedValue(null);
  });

  it("rejects an unverified broker", async () => {
    prismaMock.broker.findUnique.mockResolvedValue(
      makeBroker({ verificationStatus: "PENDING" })
    );
    const { req, res } = makeReqRes({ method: "POST", body: { requestId: "req_1" } });
    await handler(req, res);
    expect(res.statusCode).toBe(403);
    expect(jsonBody<{ error: string }>(res).error).toMatch(/verified/);
  });

  it("blocks FREE tier from initiating conversations", async () => {
    prismaMock.broker.findUnique.mockResolvedValue(
      makeBroker({ subscriptionTier: "FREE", responseCredits: 0 })
    );
    const { req, res } = makeReqRes({ method: "POST", body: { requestId: "req_1" } });
    await handler(req, res);
    expect(res.statusCode).toBe(403);
    expect(jsonBody<{ error: string }>(res).error).toMatch(/Free plan/);
  });

  it("BASIC tier broker with credits: deducts 1 credit atomically + creates conversation", async () => {
    prismaMock.broker.findUnique.mockResolvedValue(
      makeBroker({ subscriptionTier: "BASIC", responseCredits: 5 })
    );
    // Inside-tx calls:
    prismaMock.conversation.findUnique.mockResolvedValue(null); // no dupe
    prismaMock.broker.updateMany.mockResolvedValue({ count: 1 } as never); // credit deducted
    prismaMock.conversation.create.mockResolvedValue(makeConversation());

    const { req, res } = makeReqRes({
      method: "POST",
      body: { requestId: "req_1", message: "Hi, I'd love to help." },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(201);
    // Credit decrement must use the gt:0 guard so the query is race-safe.
    const updateArgs = prismaMock.broker.updateMany.mock.calls[0][0];
    expect(updateArgs.where).toEqual(expect.objectContaining({ responseCredits: { gt: 0 } }));
    expect(updateArgs.data).toEqual({ responseCredits: { decrement: 1 } });
    expect(prismaMock.conversation.create).toHaveBeenCalledOnce();
    expect(prismaMock.message.create).toHaveBeenCalledOnce();
  });

  it("BASIC tier broker with 0 credits: 403 NO_CREDITS, no conversation", async () => {
    prismaMock.broker.findUnique.mockResolvedValue(
      makeBroker({ subscriptionTier: "BASIC", responseCredits: 0 })
    );
    prismaMock.conversation.findUnique.mockResolvedValue(null);
    prismaMock.broker.updateMany.mockResolvedValue({ count: 0 } as never); // nothing decremented

    const { req, res } = makeReqRes({
      method: "POST",
      body: { requestId: "req_1", message: "Hi" },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(jsonBody<{ error: string }>(res).error).toMatch(/No response credits/);
    expect(prismaMock.conversation.create).not.toHaveBeenCalled();
  });

  it("PREMIUM tier skips credit deduction entirely", async () => {
    prismaMock.broker.findUnique.mockResolvedValue(
      makeBroker({ subscriptionTier: "PREMIUM", responseCredits: 0 })
    );
    prismaMock.conversation.findUnique.mockResolvedValue(null);
    prismaMock.conversation.create.mockResolvedValue(makeConversation());

    const { req, res } = makeReqRes({
      method: "POST",
      body: { requestId: "req_1", message: "Hi" },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect(prismaMock.broker.updateMany).not.toHaveBeenCalled();
  });

  it("idempotency: duplicate conversation returns the existing row without double-deducting", async () => {
    prismaMock.broker.findUnique.mockResolvedValue(
      makeBroker({ subscriptionTier: "BASIC", responseCredits: 5 })
    );
    const existing = makeConversation();
    prismaMock.conversation.findUnique.mockResolvedValue(existing);

    const { req, res } = makeReqRes({
      method: "POST",
      body: { requestId: "req_1", message: "Hi" },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(jsonBody<{ id: string }>(res).id).toBe(existing.id);
    expect(prismaMock.broker.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.conversation.create).not.toHaveBeenCalled();
  });

  it("refuses when broker ↔ borrower are blocked in either direction", async () => {
    prismaMock.broker.findUnique.mockResolvedValue(
      makeBroker({ subscriptionTier: "BASIC", responseCredits: 5 })
    );
    prismaMock.userBlock.findFirst.mockResolvedValue({
      blockerId: "user_borrower_1",
      blockedId: "user_broker_1",
      createdAt: new Date(),
    } as never);

    const { req, res } = makeReqRes({
      method: "POST",
      body: { requestId: "req_1", message: "Hi" },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(prismaMock.conversation.create).not.toHaveBeenCalled();
    expect(prismaMock.broker.updateMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/conversations — borrower-initiated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSession(borrowerSession());
    prismaMock.borrowerRequest.findUnique.mockResolvedValue(
      makeBorrowerRequest({ borrowerId: "user_borrower_1" })
    );
    prismaMock.userBlock.findFirst.mockResolvedValue(null);
  });

  it("requires a brokerId", async () => {
    const { req, res } = makeReqRes({ method: "POST", body: { requestId: "req_1" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("forbids creating conversations for someone else's request", async () => {
    prismaMock.borrowerRequest.findUnique.mockResolvedValue(
      makeBorrowerRequest({ borrowerId: "user_other" })
    );
    const { req, res } = makeReqRes({
      method: "POST",
      body: { requestId: "req_1", brokerId: "broker_1" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(403);
  });

  it("creates the conversation when valid", async () => {
    prismaMock.broker.findUnique.mockResolvedValue(makeBroker());
    prismaMock.conversation.findUnique.mockResolvedValue(null);
    prismaMock.conversation.create.mockResolvedValue(makeConversation());

    const { req, res } = makeReqRes({
      method: "POST",
      body: { requestId: "req_1", brokerId: "broker_1" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(201);
  });
});
