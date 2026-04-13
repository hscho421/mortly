import prisma from "@/lib/prisma";

const DEFAULTS: Record<string, string> = {
  request_expiry_days: "30",
  max_requests_per_user: "5",
  maintenance_mode: "false",
  broker_initial_message_limit: "3",
  free_tier_credits: "0",
  basic_tier_credits: "5",
  pro_tier_credits: "20",
};

// In-memory cache with 5-minute TTL
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { value: string; expiresAt: number }>();

export async function getSetting(key: string): Promise<string> {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const row = await prisma.systemSetting.findUnique({ where: { key } });
  const value = row?.value ?? DEFAULTS[key] ?? "";
  cache.set(key, { value, expiresAt: now + CACHE_TTL_MS });
  return value;
}

export async function getSettingInt(key: string): Promise<number> {
  const val = await getSetting(key);
  return parseInt(val, 10) || 0;
}

export async function getSettingBool(key: string): Promise<boolean> {
  const val = await getSetting(key);
  return val === "true" || val === "1";
}

/** Call after admin updates settings to clear stale cache */
export function invalidateSettingsCache() {
  cache.clear();
}
