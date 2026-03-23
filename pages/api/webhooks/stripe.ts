import type { NextApiRequest, NextApiResponse } from "next";
import type Stripe from "stripe";
import { getStripe, getTierForPriceId, getPriceIdForTier, getCreditsForTier } from "@/lib/stripe";
import prisma from "@/lib/prisma";

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

  // Idempotency: check if this subscription was already processed for this period
  const existing = await prisma.subscription.findUnique({
    where: { brokerId },
  });
  if (
    existing?.stripeSubscriptionId === stripeSubscriptionId &&
    existing?.currentPeriodStart &&
    existing.currentPeriodStart.getTime() === period.start.getTime()
  ) {
    return;
  }

  const credits = await getCreditsForTier(tier);

  await prisma.$transaction([
    prisma.subscription.upsert({
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
    }),
    prisma.broker.update({
      where: { id: brokerId },
      data: {
        subscriptionTier: tier as "BASIC" | "PRO" | "PREMIUM",
        responseCredits: credits,
      },
    }),
  ]);
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

  // Idempotency: skip if we already processed this period
  if (
    subscription.currentPeriodStart &&
    subscription.currentPeriodStart.getTime() === period.start.getTime()
  ) {
    return;
  }

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

  await prisma.$transaction([
    prisma.subscription.update({
      where: { stripeSubscriptionId },
      data: {
        status: "ACTIVE",
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        tier: tier as "BASIC" | "PRO" | "PREMIUM",
        stripePriceId: appliedPriceId,
        pendingTier: null,
      },
    }),
    prisma.broker.update({
      where: { id: subscription.broker.id },
      data: {
        subscriptionTier: tier as "BASIC" | "PRO" | "PREMIUM",
        responseCredits: credits,
      },
    }),
  ]);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const stripeSubscriptionId = getInvoiceSubscriptionId(invoice);
  if (!stripeSubscriptionId) return;

  await prisma.subscription.update({
    where: { stripeSubscriptionId },
    data: { status: "PAST_DUE" },
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

  const tierChanged = tier && tier !== subscription.tier;

  await prisma.$transaction(async (tx) => {
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
}
