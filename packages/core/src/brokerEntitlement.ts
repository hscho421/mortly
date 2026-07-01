// Shared broker-messaging entitlement gate.
//
// A broker may only send messages to clients when they are VERIFIED, on a paid
// tier, and their subscription is in good standing. This was previously enforced
// ONLY at broker-initiated conversation creation (pages/api/conversations), which
// left /api/messages open: a broker whose payment lapsed (credits reset to 0,
// status PAST_DUE) — or a FREE/unverified broker a borrower pulled into a thread —
// could keep messaging in existing conversations for free. Centralizing the check
// here lets both write paths apply the same rule.
//
// Note: this gates ENTITLEMENT only — it never deducts a credit. Credits are spent
// once, when a conversation is opened; replies inside an existing thread are free
// for a broker in good standing, and that must not change.

export type BrokerEntitlement = {
  verificationStatus: string | null | undefined;
  subscriptionTier: string | null | undefined;
  subscriptionStatus: string | null | undefined;
};

export type BrokerEntitlementError = { code: string; error: string };

// Subscription statuses that mean "no longer entitled to paid features".
// CANCELLED is included (the conversation-create gate historically omitted it);
// a canceled-but-not-yet-deleted subscription must not retain messaging.
const LAPSED_STATUSES = new Set(["PAST_DUE", "EXPIRED", "CANCELLED"]);

/**
 * Returns an error to send (403) when the broker may NOT message, or null when
 * they may. Mirrors the codes used by pages/api/conversations so clients can
 * reuse their existing handling.
 */
export function checkBrokerCanMessage(
  broker: BrokerEntitlement,
): BrokerEntitlementError | null {
  if (broker.verificationStatus !== "VERIFIED") {
    return {
      code: "BROKER_NOT_VERIFIED",
      error: "Broker must be verified to message clients",
    };
  }
  if (broker.subscriptionTier === "FREE" || !broker.subscriptionTier) {
    return {
      code: "UPGRADE_REQUIRED",
      error: "Free plan brokers cannot message clients. Please upgrade your plan.",
    };
  }
  if (broker.subscriptionStatus && LAPSED_STATUSES.has(broker.subscriptionStatus)) {
    return {
      code: "SUBSCRIPTION_PAST_DUE",
      error:
        "Your subscription payment is past due. Please update your billing details to continue.",
    };
  }
  return null;
}
