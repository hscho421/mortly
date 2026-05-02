import { kv } from "@vercel/kv";
import prisma from "@/lib/prisma";
import { SETTINGS_CACHE_TTL_MS } from "@/lib/constants";

const DEFAULTS: Record<string, string> = {
  request_expiry_days: "30",
  max_requests_per_user: "5",
  maintenance_mode: "false",
  broker_initial_message_limit: "3",
  free_tier_credits: "0",
  basic_tier_credits: "5",
  pro_tier_credits: "20",
};

interface CacheEntry {
  value: string;
  expiresAt: number;
  /** The settings_version stamp that was current when this entry was cached. */
  versionStamp: number;
}

const cache = new Map<string, CacheEntry>();

const KV_VERSION_KEY = "settings:version";
let lastSeenVersion = 0;
let lastVersionPollAt = 0;
const VERSION_POLL_INTERVAL_MS = 1_000;

/**
 * Cross-instance cache invalidation. The local TTL keeps reads cheap, but a
 * settings change made by an admin would otherwise propagate to other warm
 * lambdas only after their per-instance TTL expired (up to 10s of drift,
 * during which the Stripe webhook could grant the wrong credit count).
 *
 * The fix: every admin settings update bumps a `settings:version` integer
 * in KV. Each `getSetting()` call checks (at most once per second) whether
 * the version has changed; if so, the local cache is wiped before reading.
 *
 * Falls back to local cache only when KV is unavailable — safe degradation.
 */
async function ensureVersionFresh(): Promise<void> {
  const now = Date.now();
  if (now - lastVersionPollAt < VERSION_POLL_INTERVAL_MS) return;
  lastVersionPollAt = now;
  try {
    const v = (await kv.get<number>(KV_VERSION_KEY)) ?? 0;
    if (v !== lastSeenVersion) {
      lastSeenVersion = v;
      cache.clear();
    }
  } catch {
    // KV outage — keep serving the local cache. Better stale than down.
  }
}

export async function getSetting(key: string): Promise<string> {
  await ensureVersionFresh();
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const row = await prisma.systemSetting.findUnique({ where: { key } });
  const value = row?.value ?? DEFAULTS[key] ?? "";
  cache.set(key, {
    value,
    expiresAt: now + SETTINGS_CACHE_TTL_MS,
    versionStamp: lastSeenVersion,
  });
  return value;
}

export async function getSettingInt(key: string): Promise<number> {
  const val = await getSetting(key);
  // Strict parse — `parseInt(val, 10) || 0` previously hid misconfiguration
  // ("foo" → NaN → 0 → broker.responseCredits silently set to 0). Now we
  // throw, so a bad config errors loudly instead of corrupting state.
  const parsed = parseInt(val, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Setting "${key}" is not a valid integer: ${JSON.stringify(val)}`);
  }
  return parsed;
}

export async function getSettingBool(key: string): Promise<boolean> {
  const val = await getSetting(key);
  return val === "true" || val === "1";
}

/**
 * Invalidate the settings cache across ALL instances. Bumps the KV version
 * counter; every other warm lambda picks up the change within 1s on its
 * next `getSetting()` call.
 *
 * Falls back to local-only invalidation if KV is unavailable. The admin UI
 * should retry — but the worst case is one lambda's stale cache.
 */
export async function invalidateSettingsCache(): Promise<void> {
  cache.clear();
  try {
    const next = (await kv.incr(KV_VERSION_KEY)) as number;
    lastSeenVersion = next;
    lastVersionPollAt = Date.now();
  } catch (err) {
    console.error("[settings] KV version bump failed:", err);
  }
}
