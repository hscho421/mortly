import { getSettingBool, getSettingInt } from "@/lib/settings";

// Central logic for the PREMIUM early-access window: when a request is approved
// it's visible to PREMIUM brokers only until it "releases" to all brokers —
// whichever comes first of the hard cap (windowHours) or the count valve
// (past valveHours with fewer than minResponses responses). `premiumReleasedAt`
// is the persisted one-way latch (set by the release cron); these helpers also
// apply the hard cap at read time so visibility is correct even before the cron
// runs. When the feature is disabled, nothing is ever exclusive.

const HOUR_MS = 3_600_000;

export interface PremiumAccessConfig {
  enabled: boolean;
  windowHours: number;
  valveHours: number;
  minResponses: number;
}

export async function getPremiumAccessConfig(): Promise<PremiumAccessConfig> {
  const [enabled, windowHours, valveHours, minResponses] = await Promise.all([
    getSettingBool("premium_early_access_enabled"),
    getSettingInt("premium_window_hours"),
    getSettingInt("premium_valve_hours"),
    getSettingInt("premium_valve_min_responses"),
  ]);
  return { enabled, windowHours, valveHours, minResponses };
}

interface RequestWindow {
  approvedAt: Date | null;
  premiumReleasedAt: Date | null;
}

/**
 * Is this request currently visible to PREMIUM brokers ONLY? A non-PREMIUM
 * broker must be blocked from seeing/acting on it while this is true. Doubles
 * as the "show the Exclusive badge" signal in the PREMIUM feed.
 */
export function isExclusiveToPremium(
  req: RequestWindow,
  config: PremiumAccessConfig,
  now: Date,
): boolean {
  if (!config.enabled) return false;
  if (req.premiumReleasedAt) return false; // already released to all
  if (!req.approvedAt) return false; // legacy / not in a window
  const capMs = req.approvedAt.getTime() + config.windowHours * HOUR_MS;
  return now.getTime() < capMs; // still inside the exclusive window
}

/** When the exclusive window ends at the latest (for an optional UI countdown). */
export function premiumWindowEndsAt(
  req: RequestWindow,
  config: PremiumAccessConfig,
): Date | null {
  if (!req.approvedAt) return null;
  return new Date(req.approvedAt.getTime() + config.windowHours * HOUR_MS);
}

/**
 * Prisma `where` fragment restricting a non-PREMIUM broker to non-exclusive
 * requests. The hard-cap clause (`approvedAt < now - window`) is a read-time
 * backstop so the 12h release is exact even if the cron hasn't latched yet.
 */
export function nonPremiumVisibilityWhere(config: PremiumAccessConfig, now: Date) {
  if (!config.enabled) return {};
  const capCutoff = new Date(now.getTime() - config.windowHours * HOUR_MS);
  return {
    OR: [
      { premiumReleasedAt: { not: null } },
      // lte (not lt) so the request becomes visible at EXACTLY the cap boundary,
      // matching isExclusiveToPremium (now < cap) and shouldReleaseNow (>= cap).
      { approvedAt: { lte: capCutoff } },
      { approvedAt: null },
    ],
  };
}

/**
 * Cron decision: should this still-exclusive request be released to all now?
 * Releases at the hard cap, or past the valve with too few responses.
 */
export function shouldReleaseNow(
  req: RequestWindow,
  responseCount: number,
  config: PremiumAccessConfig,
  now: Date,
): boolean {
  if (req.premiumReleasedAt) return false; // already released
  if (!req.approvedAt) return true; // no window → release
  const elapsedH = (now.getTime() - req.approvedAt.getTime()) / HOUR_MS;
  if (elapsedH >= config.windowHours) return true; // hard cap
  if (elapsedH >= config.valveHours && responseCount < config.minResponses) return true; // valve
  return false;
}
