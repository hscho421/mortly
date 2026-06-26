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

// Single source of truth for the DISPLAYED plan prices, shared by the marketing
// pricing page and the in-app billing page so the two can't drift apart.
// IMPORTANT: these are display strings only — they MUST match the unit_amount of
// the corresponding STRIPE_PRICE_* price objects (the real charge). Update both
// together when changing a price in Stripe.
export const TIER_PRICING: Record<
  string,
  { price: string; originalPrice: string | null }
> = {
  FREE: { price: "$0", originalPrice: null },
  BASIC: { price: "$29", originalPrice: "$49" },
  PRO: { price: "$69", originalPrice: "$99" },
  PREMIUM: { price: "$129", originalPrice: "$199" },
};

export function tierRank(tier: string): number {
  return TIER_RANK[tier] ?? 0;
}

/** True when moving from `fromTier` to `toTier` is an upgrade (a higher tier). */
export function isUpgrade(fromTier: string, toTier: string): boolean {
  return tierRank(toTier) > tierRank(fromTier);
}

type Translate = (key: string, opts?: Record<string, unknown>) => string;

/**
 * Localized label for a tier's monthly credit grant:
 *   < 0  → unlimited (PREMIUM)
 *   = 0  → none (FREE)
 *   > 0  → "N per month"
 * Uses `{{num}}` (not i18next's reserved `count`) to avoid pluralization rules.
 */
export function creditLabel(t: Translate, value: number): string {
  if (value < 0) return t("pricing.val_unlimited");
  if (value === 0) return t("pricing.val_none");
  return t("pricing.val_perMonth", { num: value });
}
