import type { NextApiRequest, NextApiResponse } from "next";
import { getPremiumAccessConfig } from "@/lib/premiumAccess";

// Public, read-only: the PREMIUM early-access window config the billing + broker
// dashboard UIs need to (a) advertise the perk ONLY while it's actually enabled
// (no misleading copy for an inactive feature) and (b) render the live window
// length. Product info only — no sensitive data. Short CDN cache like
// /api/tier-credits. On error the client falls back to "not advertised".
export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { enabled, windowHours } = await getPremiumAccessConfig();
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json({ enabled, windowHours });
  } catch (error) {
    console.error("Failed to load premium early-access config:", error);
    return res.status(500).json({ error: "Failed to load premium early-access config" });
  }
}
