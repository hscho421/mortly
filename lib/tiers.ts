// Tier ordering, shared by the client (billing UI) and the server
// (checkout / preview / webhook). Kept dependency-free on purpose so it's safe
// to import into the client bundle — do NOT add server-only imports here
// (no Stripe SDK, no prisma, no settings).

export const TIER_RANK: Record<string, number> = {
  FREE: 0,
  BASIC: 1,
  PRO: 2,
  PREMIUM: 3,
};

export function tierRank(tier: string): number {
  return TIER_RANK[tier] ?? 0;
}

/** True when moving from `fromTier` to `toTier` is an upgrade (a higher tier). */
export function isUpgrade(fromTier: string, toTier: string): boolean {
  return tierRank(toTier) > tierRank(fromTier);
}
