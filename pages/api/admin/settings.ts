import prisma from "@/lib/prisma";
import { invalidateSettingsCache, DEFAULTS } from "@/lib/settings";
import { withAdmin } from "@/lib/admin/withAdmin";

// Effective settings = stored rows overlaid on the code defaults, so the admin
// UI shows each setting's current EFFECTIVE value (not a blank input) for keys
// that have never been explicitly saved. Mirrors how getSetting() resolves.
async function effectiveSettings(): Promise<Record<string, string>> {
  const rows = await prisma.systemSetting.findMany();
  const map: Record<string, string> = { ...DEFAULTS };
  for (const s of rows) map[s.key] = s.value;
  return map;
}

export default withAdmin(async (req, res, session) => {
  if (req.method === "GET") {
    return res.status(200).json(await effectiveSettings());
  }

  if (req.method === "PUT") {
    const updates = req.body as Record<string, string>;

    if (!updates || typeof updates !== "object") {
      return res.status(400).json({ error: "Request body must be a key-value object" });
    }

    const ALLOWED_KEYS = new Set([
      "request_expiry_days",
      "max_requests_per_user",
      "maintenance_mode",
      "free_tier_credits",
      "basic_tier_credits",
      "pro_tier_credits",
      "broker_initial_message_limit",
      "premium_early_access_enabled",
      "premium_window_hours",
      "premium_valve_hours",
      "premium_valve_min_responses",
    ]);

    const entries = Object.entries(updates);
    if (entries.length === 0 || entries.length > 20) {
      return res.status(400).json({ error: "Must update between 1 and 20 settings" });
    }

    for (const [key, value] of entries) {
      if (!ALLOWED_KEYS.has(key)) {
        return res.status(400).json({ error: `Unknown setting: ${key}` });
      }
      if (typeof value !== "string" || value.length > 500) {
        return res.status(400).json({ error: `Invalid value for ${key}` });
      }
    }

    // Semantic guards for the PREMIUM early-access numeric settings — a zero or
    // negative window/valve silently breaks the feature (every request would be
    // non-exclusive, or the valve would fire instantly). getSettingInt also
    // throws on non-integers downstream; reject here for a clean 400.
    const premiumMins: Record<string, number> = {
      premium_window_hours: 1,
      premium_valve_hours: 1,
      premium_valve_min_responses: 0,
    };
    for (const [key, min] of Object.entries(premiumMins)) {
      if (key in updates) {
        const raw = updates[key];
        if (!/^\d+$/.test(raw) || parseInt(raw, 10) < min) {
          return res.status(400).json({ error: `${key} must be an integer >= ${min}` });
        }
      }
    }
    // The valve must fire before the hard cap or it can never trigger early.
    if ("premium_window_hours" in updates && "premium_valve_hours" in updates) {
      if (parseInt(updates.premium_valve_hours, 10) >= parseInt(updates.premium_window_hours, 10)) {
        return res
          .status(400)
          .json({ error: "premium_valve_hours must be less than premium_window_hours" });
      }
    }

    // Detect the OFF→ON transition of the PREMIUM early-access toggle BEFORE we
    // write, so we can release the current backlog (see after the write). Only
    // the transition matters — re-saving while already ON must NOT release the
    // active exclusive windows.
    let enablingPremium = false;
    if (updates.premium_early_access_enabled === "true") {
      const current = await prisma.systemSetting.findUnique({
        where: { key: "premium_early_access_enabled" },
      });
      enablingPremium = current?.value !== "true";
    }

    await prisma.$transaction([
      ...entries.map(([key, value]) =>
        prisma.systemSetting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        })
      ),
    ]);

    // Turning the feature ON: release every currently-OPEN request that hasn't
    // been released yet. Requests are stamped with approvedAt on approval even
    // while the feature is off, so without this they'd be retroactively hidden
    // from non-PREMIUM brokers the moment the toggle flips. Only NEW approvals
    // (after this point) should enter an exclusive window.
    if (enablingPremium) {
      await prisma.borrowerRequest.updateMany({
        where: { status: "OPEN", premiumReleasedAt: null },
        data: { premiumReleasedAt: new Date() },
      });
    }

    await prisma.adminAction.create({
      data: {
        adminId: session.user.id,
        action: "UPDATE_SETTINGS",
        targetType: "SYSTEM",
        targetId: "settings",
        details: JSON.stringify(updates),
      },
    });

    await invalidateSettingsCache();

    return res.status(200).json(await effectiveSettings());
  }

  return res.status(405).json({ error: "Method not allowed" });
});
