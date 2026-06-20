import type { NextApiRequest, NextApiResponse } from "next";
import { getCreditsForTier } from "@/lib/stripe";

// Public, read-only: the live monthly credit grant per tier, sourced from the
// admin-editable *_tier_credits settings (PREMIUM is -1 = unlimited). The
// pricing/billing UIs read this so the displayed counts can't drift from what
// brokers actually receive. Short CDN cache, same as /api/maintenance.
export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const [FREE, BASIC, PRO, PREMIUM] = await Promise.all([
      getCreditsForTier("FREE"),
      getCreditsForTier("BASIC"),
      getCreditsForTier("PRO"),
      getCreditsForTier("PREMIUM"),
    ]);
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json({ FREE, BASIC, PRO, PREMIUM });
  } catch (error) {
    console.error("Failed to load tier credits:", error);
    return res.status(500).json({ error: "Failed to load tier credits" });
  }
}
