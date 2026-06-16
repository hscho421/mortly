import { describe, it, expect, beforeEach, vi } from "vitest";
import "@/tests/mocks/prisma";
import "@/tests/mocks/next-auth";
import "@/tests/mocks/stripe";
import { prismaMock } from "@/tests/mocks/prisma";
import { stripeMock } from "@/tests/mocks/stripe";
import { setSession, brokerSession, borrowerSession } from "@/tests/mocks/next-auth";
import { makeReqRes, jsonBody } from "@/tests/utils/apiHelpers";

import handler from "@/pages/api/stripe/resume-subscription";

// A broker whose subscription is set to cancel at period end — the only state
// from which "resume" is valid.
const cancellingBroker = {
  id: "broker_1",
  subscription: { stripeSubscriptionId: "sub_123", cancelAtPeriodEnd: true },
};

describe("POST /api/stripe/resume-subscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSession(brokerSession());
    prismaMock.broker.findUnique.mockResolvedValue(cancellingBroker as never);
    stripeMock.subscriptions.update.mockResolvedValue({} as never);
  });

  it("403s a non-broker", async () => {
    setSession(borrowerSession());
    const { req, res } = makeReqRes({ method: "POST" });
    await handler(req, res);
    expect(res.statusCode).toBe(403);
    expect(stripeMock.subscriptions.update).not.toHaveBeenCalled();
  });

  it("405s a non-POST request", async () => {
    const { req, res } = makeReqRes({ method: "GET" });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
    expect(stripeMock.subscriptions.update).not.toHaveBeenCalled();
  });

  it("400s when the broker has no Stripe subscription", async () => {
    prismaMock.broker.findUnique.mockResolvedValue({ id: "broker_1", subscription: null } as never);
    const { req, res } = makeReqRes({ method: "POST" });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(stripeMock.subscriptions.update).not.toHaveBeenCalled();
  });

  it("400s when the subscription is not set to cancel (nothing to resume)", async () => {
    prismaMock.broker.findUnique.mockResolvedValue({
      id: "broker_1",
      subscription: { stripeSubscriptionId: "sub_123", cancelAtPeriodEnd: false },
    } as never);
    const { req, res } = makeReqRes({ method: "POST" });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(stripeMock.subscriptions.update).not.toHaveBeenCalled();
  });

  it("clears cancel_at_period_end in Stripe and returns resumed", async () => {
    const { req, res } = makeReqRes({ method: "POST" });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(jsonBody<{ resumed: boolean }>(res).resumed).toBe(true);
    // We flip the flag in Stripe only — the webhook writes it back to our DB,
    // so the handler must not touch subscription state directly.
    expect(stripeMock.subscriptions.update).toHaveBeenCalledWith("sub_123", {
      cancel_at_period_end: false,
    });
    expect(prismaMock.subscription.update).not.toHaveBeenCalled();
  });

  it("500s when Stripe throws", async () => {
    stripeMock.subscriptions.update.mockRejectedValueOnce(new Error("stripe down"));
    const { req, res } = makeReqRes({ method: "POST" });
    await handler(req, res);
    expect(res.statusCode).toBe(500);
  });
});
