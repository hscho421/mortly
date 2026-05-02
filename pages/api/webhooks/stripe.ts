import type { NextApiRequest, NextApiResponse } from "next";
import type Stripe from "stripe";
import { getStripe, getTierForPriceId, getPriceIdForTier, getCreditsForTier } from "@/lib/stripe";
import prisma from "@/lib/prisma";
import { getPostHogClient } from "@/lib/posthog-server";

export const config = {
  api: { bodyParser: false },
};

async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// In Stripe API v2026+, period dates live on the subscription item, not the subscription
function getSubPeriod(stripeSub: Stripe.Subscription): { start: Date; end: Date } | null {
  const item = stripeSub.items.data[0];
  if (!item) return null;
  return {
    start: new Date(item.current_period_start * 1000),
    end: new Date(item.current_period_end * 1000),
  };
}

// In Stripe API v2026+, invoice.subscription moved to invoice.parent.subscription_details
function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const sub = invoice.parent?.subscription_details?.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return res.status(500).json({ error: "Webhook secret not configured" });
  }

  const stripe = getStripe();
  const sig = req.headers["stripe-signature"] as string;

  if (!sig) {
    return res.status(400).json({ error: "Missing stripe-signature header" });
  }

  let event: Stripe.Event;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return res.status(400).json({ error: "Invalid signature" });
  }

  // Idempotency ledger — Stripe retries aggressively, and out-of-order
  // delivery is a real production failure mode (we've seen invoice.paid
  // arrive twice within 100ms). Inserting `event.id` first ensures a duplicate
  // delivery short-circuits before mutating any of our state.
  try {
    await prisma.processedStripeEvent.create({
      data: { eventId: event.id, type: event.type },
    });
  } catch (err) {
    // Unique constraint violation = we've seen this event id before. Ack the
    // delivery so Stripe stops retrying, but don't run handlers again.
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      return res.status(200).json({ received: true, duplicate: true });
    }
    console.error("Webhook ledger insert failed:", err);
    return res.status(500).json({ error: "Webhook ledger failed" });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error(`Webhook handler error for ${event.type}:`, err);
    // Roll back the ledger so Stripe's retry isn't short-circuited as a
    // duplicate. If the rollback ALSO fails (KV outage, DB blip), surface it
    // loudly — silently swallowing means Stripe retries see the ledger row
    // and 200, dropping the event entirely. Logging + observability event so
    // it's noisy in metrics; we still return 500 to trigger Stripe's retry.
    try {
      await prisma.processedStripeEvent.delete({ where: { eventId: event.id } });
    } catch (rollbackErr) {
      console.error(
        "[stripe-webhook] CRITICAL: ledger rollback failed for event",
        event.id,
        rollbackErr,
      );
      try {
        getPostHogClient().capture({
          distinctId: "system",
          event: "webhook_ledger_rollback_failed",
          properties: {
            stripe_event_id: event.id,
            stripe_event_type: event.type,
            error: rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr),
          },
        });
      } catch {
        // PostHog itself can fail — at this point we've done all we can
        // without paging a human. The handler already logged; Stripe still
        // gets a 500 and will retry. Worst case: the duplicate-protection
        // ledger entry blocks the retry, which is a known support ticket.
      }
    }
    return res.status(500).json({ error: "Webhook handler failed" });
  }

  return res.status(200).json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const stripeSubscriptionId = session.subscription as string;
  if (!stripeSubscriptionId) return;

  const stripe = getStripe();
  const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const brokerId = stripeSub.metadata.brokerId;
  if (!brokerId) return;

  const priceId = stripeSub.items.data[0]?.price.id;
  if (!priceId) return;
  const tier = getTierForPriceId(priceId);
  if (!tier) return;

  const period = getSubPeriod(stripeSub);
  if (!period) return;

  const credits = await getCreditsForTier(tier);

  await prisma.$transaction(async (tx) => {
    // Idempotency: check inside transaction to prevent concurrent duplicate processing
    const existing = await tx.subscription.findUnique({
      where: { brokerId },
    });
    if (
      existing?.stripeSubscriptionId === stripeSubscriptionId &&
      existing?.currentPeriodStart &&
      existing.currentPeriodStart.getTime() === period.start.getTime()
    ) {
      return;
    }

    await tx.subscription.upsert({
      where: { brokerId },
      create: {
        brokerId,
        tier: tier as "BASIC" | "PRO" | "PREMIUM",
        status: "ACTIVE",
        stripeSubscriptionId,
        stripePriceId: priceId,
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      },
      update: {
        tier: tier as "BASIC" | "PRO" | "PREMIUM",
        status: "ACTIVE",
        stripeSubscriptionId,
        stripePriceId: priceId,
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        endedAt: null,
      },
    });
    await tx.broker.update({
      where: { id: brokerId },
      data: {
        subscriptionTier: tier as "BASIC" | "PRO" | "PREMIUM",
        responseCredits: credits,
      },
    });
  });

  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: brokerId,
    event: "subscription_checkout_completed",
    properties: { tier, broker_id: brokerId },
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // Skip first invoice — handled by checkout.session.completed
  if (invoice.billing_reason === "subscription_create") return;

  const stripeSubscriptionId = getInvoiceSubscriptionId(invoice);
  if (!stripeSubscriptionId) return;

  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId },
    include: { broker: { select: { id: true } } },
  });
  if (!subscription) return;

  const stripe = getStripe();
  const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const period = getSubPeriod(stripeSub);
  if (!period) return;

  // If there's a pending downgrade, apply it now and swap the Stripe price
  const priceId = stripeSub.items.data[0]?.price.id;
  let tier = getTierForPriceId(priceId) || subscription.tier;

  if (subscription.pendingTier) {
    tier = subscription.pendingTier;
    const newPriceId = getPriceIdForTier(tier);
    if (newPriceId) {
      const existingItemId = stripeSub.items.data[0]?.id;
      if (existingItemId) {
        await stripe.subscriptions.update(stripeSubscriptionId, {
          items: [{ id: existingItemId, price: newPriceId }],
          proration_behavior: "none",
        });
      }
    }
  }

  const credits = await getCreditsForTier(tier);
  const appliedPriceId = getPriceIdForTier(tier) || priceId;

  await prisma.$transaction(async (tx) => {
    // Idempotency: re-check inside transaction to prevent concurrent duplicate processing
    const current = await tx.subscription.findUnique({
      where: { stripeSubscriptionId },
    });
    if (
      current?.currentPeriodStart &&
      current.currentPeriodStart.getTime() === period.start.getTime()
    ) {
      return;
    }

    await tx.subscription.update({
      where: { stripeSubscriptionId },
      data: {
        status: "ACTIVE",
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        tier: tier as "BASIC" | "PRO" | "PREMIUM",
        stripePriceId: appliedPriceId,
        pendingTier: null,
      },
    });
    await tx.broker.update({
      where: { id: subscription.broker.id },
      data: {
        subscriptionTier: tier as "BASIC" | "PRO" | "PREMIUM",
        responseCredits: credits,
      },
    });
  });

  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: subscription.broker.id,
    event: "subscription_renewed",
    properties: { tier, broker_id: subscription.broker.id },
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const stripeSubscriptionId = getInvoiceSubscriptionId(invoice);
  if (!stripeSubscriptionId) return;

  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId },
    include: { broker: { select: { id: true } } },
  });

  if (!subscription) return;

  // Strip the broker's paid-tier credits as soon as payment fails — the
  // previous behavior left credits intact through Stripe's full grace
  // period (~3 weeks), so past-due brokers kept messaging clients while
  // their subscription was being non-paid. Reset to FREE immediately.
  // Successful retry → handleInvoicePaid re-grants the paid-tier credits.
  const freeCredits = await getCreditsForTier("FREE");

  await prisma.$transaction([
    prisma.subscription.update({
      where: { stripeSubscriptionId },
      data: { status: "PAST_DUE" },
    }),
    prisma.broker.update({
      where: { id: subscription.broker.id },
      data: { responseCredits: freeCredits },
    }),
  ]);

  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: subscription.broker.id,
    event: "subscription_payment_failed",
    properties: { tier: subscription.tier, broker_id: subscription.broker.id },
  });
}

async function handleSubscriptionUpdated(stripeSub: Stripe.Subscription) {
  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: stripeSub.id },
    include: { broker: { select: { id: true } } },
  });
  if (!subscription) return;

  const priceId = stripeSub.items.data[0]?.price.id;
  const tier = getTierForPriceId(priceId);
  const period = getSubPeriod(stripeSub);

  const statusMap: Record<string, string> = {
    active: "ACTIVE",
    past_due: "PAST_DUE",
    canceled: "CANCELLED",
    unpaid: "PAST_DUE",
  };
  const mappedStatus = statusMap[stripeSub.status] || subscription.status;

  await prisma.$transaction(async (tx) => {
    // Re-read inside the transaction so the tier comparison is against the
    // committed-at-this-instant DB state, not the snapshot we read above.
    // Without this, two concurrent subscription.updated deliveries can both
    // see `tier !== subscription.tier` and both apply credits.
    const current = await tx.subscription.findUnique({
      where: { stripeSubscriptionId: stripeSub.id },
      select: { tier: true },
    });
    const tierChanged = !!(tier && current && tier !== current.tier);

    await tx.subscription.update({
      where: { stripeSubscriptionId: stripeSub.id },
      data: {
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        status: mappedStatus as "ACTIVE" | "CANCELLED" | "EXPIRED" | "PAST_DUE",
        ...(tier ? { tier: tier as "BASIC" | "PRO" | "PREMIUM", stripePriceId: priceId } : {}),
        ...(period ? { currentPeriodStart: period.start, currentPeriodEnd: period.end } : {}),
      },
    });

    if (tierChanged && tier) {
      const credits = await getCreditsForTier(tier);
      await tx.broker.update({
        where: { id: subscription.broker.id },
        data: {
          subscriptionTier: tier as "BASIC" | "PRO" | "PREMIUM",
          responseCredits: credits,
        },
      });
    }
  });
}

async function handleSubscriptionDeleted(stripeSub: Stripe.Subscription) {
  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: stripeSub.id },
    include: { broker: { select: { id: true } } },
  });
  if (!subscription) return;
  if (subscription.status === "EXPIRED") return; // idempotent

  const freeCredits = await getCreditsForTier("FREE");

  await prisma.$transaction([
    prisma.subscription.update({
      where: { stripeSubscriptionId: stripeSub.id },
      data: {
        status: "EXPIRED",
        endedAt: new Date(),
        cancelAtPeriodEnd: false,
      },
    }),
    prisma.broker.update({
      where: { id: subscription.broker.id },
      data: {
        subscriptionTier: "FREE",
        responseCredits: freeCredits,
      },
    }),
  ]);

  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: subscription.broker.id,
    event: "subscription_cancelled",
    properties: { previous_tier: subscription.tier, broker_id: subscription.broker.id },
  });
}
