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
