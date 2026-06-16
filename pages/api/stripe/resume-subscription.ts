import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { withAuth } from "@/lib/withAuth";

// Clears a pending cancellation (cancel_at_period_end) so the subscription
// keeps renewing. Stripe stays the source of truth: we flip the flag in
// Stripe and let the customer.subscription.updated webhook write
// cancelAtPeriodEnd=false back to our DB. The client polls the profile until
// the flag clears — same pattern as the in-place upgrade in create-checkout.
export default withAuth(async (req, res, session) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const broker = await prisma.broker.findUnique({
      where: { userId: session.user.id },
      include: { subscription: true },
    });

    const sub = broker?.subscription;
    if (!sub?.stripeSubscriptionId) {
      return res.status(400).json({ error: "No active subscription" });
    }

    // Only a subscription that's actually set to cancel can be resumed. A
    // scheduled downgrade (pendingTier) is a different flow handled elsewhere.
    if (!sub.cancelAtPeriodEnd) {
      return res.status(400).json({ error: "Subscription is not cancelling" });
    }

    const stripe = getStripe();
    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    return res.status(200).json({ resumed: true });
  } catch (error) {
    console.error("Error resuming subscription:", error);
    return res.status(500).json({ error: "Failed to resume subscription" });
  }
}, { roles: ["BROKER"] });
