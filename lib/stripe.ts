import Stripe from "stripe";
import { getSettingInt } from "@/lib/settings";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-02-25.clover",
      typescript: true,
    });
  }
  return _stripe;
}

const TIER_PRICE_MAP: Record<string, string | undefined> = {
  BASIC: process.env.STRIPE_PRICE_BASIC,
  PRO: process.env.STRIPE_PRICE_PRO,
  PREMIUM: process.env.STRIPE_PRICE_PREMIUM,
};

export function getPriceIdForTier(tier: string): string | undefined {
  return TIER_PRICE_MAP[tier];
}

export function getTierForPriceId(priceId: string): string | undefined {
  for (const [tier, id] of Object.entries(TIER_PRICE_MAP)) {
    if (id === priceId) return tier;
  }
  return undefined;
}

const TIER_CREDIT_KEYS: Record<string, string> = {
  FREE: "free_tier_credits",
  BASIC: "basic_tier_credits",
  PRO: "pro_tier_credits",
};

export async function getCreditsForTier(tier: string): Promise<number> {
  if (tier === "PREMIUM") return -1; // unlimited
  const key = TIER_CREDIT_KEYS[tier];
  if (!key) return 0;
  return getSettingInt(key);
}
