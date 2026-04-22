import type { BorrowerRequest, Conversation, Message, Subscription } from "@prisma/client";

const baseDate = new Date("2026-01-01T00:00:00Z");

export function makeBorrowerRequest(
  overrides: Partial<BorrowerRequest> = {}
): BorrowerRequest {
  return {
    id: "req_1",
    publicId: "300000001",
    borrowerId: "user_borrower_1",
    mortgageCategory: "RESIDENTIAL",
    productTypes: ["NEW_MORTGAGE"],
    province: "Ontario",
    city: "Toronto",
    details: {
      purposeOfUse: ["OWNER_OCCUPIED"],
      incomeTypes: ["EMPLOYMENT"],
      annualIncome: { "2025": "100,000" },
    },
    desiredTimeline: "3_MONTHS",
    notes: "Looking for first home",
    status: "OPEN",
    rejectionReason: null,
    schemaVersion: 2,
    createdAt: baseDate,
    updatedAt: baseDate,
    ...overrides,
  } as BorrowerRequest;
}

export function makeConversation(
  overrides: Partial<Conversation> = {}
): Conversation {
  return {
    id: "conv_1",
    publicId: "400000001",
    requestId: "req_1",
    borrowerId: "user_borrower_1",
    brokerId: "broker_1",
    status: "ACTIVE",
    createdAt: baseDate,
    updatedAt: baseDate,
    borrowerLastReadAt: null,
    brokerLastReadAt: null,
    ...overrides,
  } as Conversation;
}

export function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg_1",
    conversationId: "conv_1",
    senderId: "user_broker_1",
    body: "Hello! I can help with your mortgage.",
    createdAt: baseDate,
    ...overrides,
  } as Message;
}

export function makeSubscription(
  overrides: Partial<Subscription> = {}
): Subscription {
  return {
    id: "sub_1",
    brokerId: "broker_1",
    tier: "BASIC",
    status: "ACTIVE",
    stripeSubscriptionId: "sub_stripe_1",
    stripePriceId: "price_basic_test",
    currentPeriodStart: baseDate,
    currentPeriodEnd: new Date("2026-02-01T00:00:00Z"),
    cancelAtPeriodEnd: false,
    pendingTier: null,
    startedAt: baseDate,
    endedAt: null,
    ...overrides,
  } as Subscription;
}
