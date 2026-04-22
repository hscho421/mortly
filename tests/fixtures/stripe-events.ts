import type Stripe from "stripe";

/**
 * Realistic shapes matching Stripe API v2026-02-25.clover (the version pinned
 * in lib/stripe.ts). Only the fields our handlers touch are populated.
 */

export function checkoutCompleted(overrides: {
  subscription?: string;
  brokerId?: string;
} = {}): Stripe.Checkout.Session {
  return {
    id: "cs_test_1",
    object: "checkout.session",
    mode: "subscription",
    status: "complete",
    subscription: overrides.subscription ?? "sub_stripe_1",
    customer: "cus_test_1",
    metadata: { brokerId: overrides.brokerId ?? "broker_1" },
  } as unknown as Stripe.Checkout.Session;
}

export function subscription(overrides: {
  id?: string;
  priceId?: string;
  brokerId?: string;
  tier?: string;
  cancelAtPeriodEnd?: boolean;
  status?: string;
  periodStart?: number;
  periodEnd?: number;
  itemId?: string;
} = {}): Stripe.Subscription {
  const start = overrides.periodStart ?? 1_767_225_600; // 2026-01-01
  const end = overrides.periodEnd ?? 1_769_904_000;   // 2026-02-01
  return {
    id: overrides.id ?? "sub_stripe_1",
    object: "subscription",
    status: overrides.status ?? "active",
    cancel_at_period_end: overrides.cancelAtPeriodEnd ?? false,
    metadata: { brokerId: overrides.brokerId ?? "broker_1", tier: overrides.tier ?? "BASIC" },
    items: {
      object: "list",
      data: [
        {
          id: overrides.itemId ?? "si_1",
          price: { id: overrides.priceId ?? "price_basic_test" },
          current_period_start: start,
          current_period_end: end,
        },
      ],
    },
  } as unknown as Stripe.Subscription;
}

export function invoicePaid(overrides: {
  subscriptionId?: string;
  billingReason?: string;
} = {}): Stripe.Invoice {
  return {
    id: "in_test_1",
    object: "invoice",
    billing_reason: overrides.billingReason ?? "subscription_cycle",
    parent: {
      type: "subscription_details",
      subscription_details: {
        subscription: overrides.subscriptionId ?? "sub_stripe_1",
      },
    },
  } as unknown as Stripe.Invoice;
}
