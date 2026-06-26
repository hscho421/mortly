import prisma from "@/lib/prisma";
import { getStripe, getPriceIdForTier } from "@/lib/stripe";
import { isUpgrade } from "@/lib/tiers";
import { withAuth } from "@/lib/withAuth";

// Read-only price disclosure for a plan change, so the UI can show the cost
// BEFORE applying it. Mirrors how create-checkout actually applies the change:
//   - upgrade   → immediate, prorated; the prorated amount lands on the next
//                 invoice (proration_behavior: create_prorations)
//   - downgrade → scheduled at the period boundary, no charge now
// Never mutates the subscription — createPreview only simulates the invoice.
export default withAuth(async (req, res, session) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { tier } = req.body ?? {};
  const newPriceId = typeof tier === "string" ? getPriceIdForTier(tier) : undefined;
  if (!tier || tier === "FREE" || !newPriceId) {
    return res.status(400).json({ error: "Invalid tier" });
  }

  try {
    const broker = await prisma.broker.findUnique({
      where: { userId: session.user.id },
      include: { subscription: true },
    });
    const sub = broker?.subscription;

    // No live subscription to change — the UI routes first-time purchases
    // through Checkout, where Stripe shows the price itself. Nothing to preview.
    if (!broker?.stripeCustomerId || !sub?.stripeSubscriptionId || sub.status !== "ACTIVE") {
      return res.status(400).json({ error: "No active subscription to change" });
    }
    if (sub.tier === tier) {
      return res.status(400).json({ error: "Already on this plan" });
    }

    const upgrading = isUpgrade(sub.tier, tier);

    // Downgrade → scheduled at the period boundary, no proration now.
    if (!upgrading) {
      return res.status(200).json({
        scenario: "downgrade",
        effectiveDate: sub.currentPeriodEnd,
      });
    }

    // If a downgrade is currently SCHEDULED, create-checkout will release that
    // schedule before applying the upgrade, which changes the proration math.
    // Rather than disclose a precise amount that won't match the real charge,
    // skip the exact preview and let the UI fall back to its generic note.
    if (sub.pendingTier) {
      return res.status(200).json({
        scenario: "upgrade",
        nextBillDate: sub.currentPeriodEnd,
      });
    }

    // Upgrade → preview the proration invoice for the exact amount.
    const stripe = getStripe();
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
    const itemId = stripeSub.items.data[0]?.id;
    if (!itemId) {
      return res.status(400).json({ error: "No active subscription to change" });
    }

    const preview = await stripe.invoices.createPreview({
      customer: broker.stripeCustomerId,
      subscription: sub.stripeSubscriptionId,
      subscription_details: {
        items: [{ id: itemId, price: newPriceId }],
        proration_behavior: "create_prorations",
      },
    });

    // Sum ONLY the proration lines (credit for unused old plan + charge for the
    // prorated new plan). preview.total would also include the next period's
    // full recurring charge, which isn't part of "the cost of upgrading now".
    const prorationAmount = preview.lines.data
      .filter(
        (line) =>
          line.parent?.subscription_item_details?.proration ||
          line.parent?.invoice_item_details?.proration,
      )
      .reduce((sum, line) => sum + line.amount, 0);

    return res.status(200).json({
      scenario: "upgrade",
      prorationAmount,
      currency: preview.currency,
      // create_prorations defers the prorated charge to the next renewal.
      nextBillDate: sub.currentPeriodEnd,
    });
  } catch (error) {
    console.error("Error previewing plan change:", error);
    return res.status(500).json({ error: "Failed to preview plan change" });
  }
}, { roles: ["BROKER"] });
