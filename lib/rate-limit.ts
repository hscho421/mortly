import { kv } from "@vercel/kv";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const limiters = new Map<string, Map<string, RateLimitEntry>>();

interface RateLimitConfig {
  interval: number;
  uniqueTokenPerInterval: number;
}

function rateLimit(config: RateLimitConfig) {
  const id = `${config.interval}-${config.uniqueTokenPerInterval}`;
  if (!limiters.has(id)) {
    limiters.set(id, new Map());
  }
  const tokenCache = limiters.get(id)!;

  return {
    check(limit: number, token: string): { success: boolean; remaining: number } {
      const now = Date.now();
      const entry = tokenCache.get(token);

      if (!entry || now > entry.resetAt) {
        if (tokenCache.size >= config.uniqueTokenPerInterval) {
          const oldest = tokenCache.keys().next().value;
          if (oldest) tokenCache.delete(oldest);
        }
        tokenCache.set(token, { count: 1, resetAt: now + config.interval });
        return { success: true, remaining: limit - 1 };
      }

      entry.count++;
      if (entry.count > limit) {
        return { success: false, remaining: 0 };
      }
      return { success: true, remaining: limit - entry.count };
    },
  };
}

// Legacy in-memory limiters kept for auth/verify flows where per-lambda state
// is acceptable (each edge function handles a small, localized request volume).
export const authLimiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500,
});

export const verifyCodeLimiter = rateLimit({
  interval: 10 * 60 * 1000,
  uniqueTokenPerInterval: 500,
});

/**
 * Resolve the client IP for rate-limit keying.
 *
 * On Vercel the leftmost `x-forwarded-for` entry is client-supplied — an
 * attacker can prepend whatever they want to cycle their rate-limit key. The
 * trustworthy origin IP is `x-real-ip` (set by Vercel's edge) and, failing
 * that, the LAST `x-forwarded-for` entry (closest to the platform). We never
 * use the leftmost entry except as a final fallback in non-prod where neither
 * header is present.
 */
export function getClientIp(req: { headers: Record<string, string | string[] | undefined> }): string {
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim().length > 0) {
    return realIp.trim();
  }
  const xff = req.headers["x-forwarded-for"];
  const xffStr = Array.isArray(xff) ? xff[0] : xff;
  if (typeof xffStr === "string" && xffStr.length > 0) {
    const parts = xffStr.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) {
      // Last entry on Vercel/Cloudflare is the platform-attached IP.
      return parts[parts.length - 1];
    }
  }
  return "unknown";
}

// ─────────────────────────────────────────────────────────────────────
// Durable rate limiter — Vercel KV-backed with in-memory dev fallback.
//
// Admin-scoped rate limits MUST survive serverless function instance
// boundaries. The in-memory Map-based limiter above is per-lambda, which
// means effective limits multiply with warm instance count.
//
// Usage:
//   const { success, remaining } = await checkRateLimit({
//     key: `admin-mutate-${adminId}`,
//     limit: 30,
//     windowMs: 60_000,
//   });
//
// Behavior:
//   - If KV_REST_API_URL is set → uses @vercel/kv INCR + PEXPIRE atomically.
//     Counter expires on the window boundary, not sliding.
//   - If KV_REST_API_URL is NOT set → falls back to the in-memory limiter
//     (dev, preview-without-KV). Logs once per boot so the gap is visible.
//   - On KV errors → degrades to the per-lambda in-memory cap (NOT fail-open).
//     A transient KV outage no longer drops every durable limit to unlimited;
//     limits are still enforced (per-instance) so an outage can't be turned into
//     an unthrottled brute-force/flood window. Errors are logged for visibility.
// ─────────────────────────────────────────────────────────────────────

const KV_CONFIGURED = Boolean(process.env.KV_REST_API_URL);

let _warnedMissingKv = false;
function warnOnceIfNoKv() {
  if (!KV_CONFIGURED && !_warnedMissingKv) {
    _warnedMissingKv = true;
    const msg =
      "[rate-limit] KV_REST_API_URL not set — ALL rate limits are per-lambda (in-memory) and multiply with warm instance count. Provision Vercel KV before production launch.";
    // In production this is a security-relevant misconfiguration (brute-force
    // and flood limits are effectively defeated), so escalate to error.
    // eslint-disable-next-line no-console
    if (process.env.NODE_ENV === "production") console.error(msg);
    // eslint-disable-next-line no-console
    else console.warn(msg);
  }
}

export interface RateLimitOptions {
  /** Unique key. Typically `"<action>-<adminId>"`. */
  key: string;
  /** Max events permitted in the window. */
  limit: number;
  /** Window size in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
}

async function checkKv(opts: RateLimitOptions): Promise<RateLimitResult> {
  const storeKey = `rl:${opts.key}`;
  try {
    // Atomic increment; set expiry only on the first increment.
    const count = (await kv.incr(storeKey)) as number;
    if (count === 1) {
      await kv.pexpire(storeKey, opts.windowMs);
    }
    if (count > opts.limit) {
      return { success: false, remaining: 0 };
    }
    return { success: true, remaining: Math.max(0, opts.limit - count) };
  } catch (err) {
    // Do NOT fail open. A KV outage previously returned success:true, which
    // dropped EVERY durable limit (login, signup, message flood, admin) to
    // unlimited at once. Instead degrade to the per-lambda in-memory cap — not
    // as strong as KV (limits multiply with warm instances) but bounded, so an
    // outage can't be turned into an unthrottled brute-force/flood window.
    // eslint-disable-next-line no-console
    console.error("[rate-limit] KV error — degrading to in-memory cap:", err);
    return checkInMemory(opts);
  }
}

// Reuse the legacy synchronous limiter map under the hood for dev fallback.
const devLimiterCache = new Map<string, Map<string, RateLimitEntry>>();

// Hard cap on distinct keys per window-bucket. checkInMemory is now reached on
// EVERY KV error (not just when KV is unconfigured) and is fed high-cardinality
// attacker-controlled keys by the login limiter (login-ip-*, login-email-*).
// Without a cap, spraying distinct emails/IPs during a KV outage would grow the
// map unbounded → lambda OOM. FIFO-evict the oldest key when full (mirrors the
// legacy limiter's guard that this fallback originally dropped).
const DEV_LIMITER_MAX_KEYS = 10_000;

function checkInMemory(opts: RateLimitOptions): RateLimitResult {
  const id = `${opts.windowMs}`;
  if (!devLimiterCache.has(id)) devLimiterCache.set(id, new Map());
  const tokenCache = devLimiterCache.get(id)!;
  const now = Date.now();
  const entry = tokenCache.get(opts.key);
  if (!entry || now > entry.resetAt) {
    // Inserting a NEW key (not refreshing an expired one): evict the oldest if
    // we're at the cap. Map preserves insertion order, so keys().next() is the
    // oldest.
    if (!entry && tokenCache.size >= DEV_LIMITER_MAX_KEYS) {
      const oldest = tokenCache.keys().next().value;
      if (oldest) tokenCache.delete(oldest);
    }
    tokenCache.set(opts.key, { count: 1, resetAt: now + opts.windowMs });
    return { success: true, remaining: opts.limit - 1 };
  }
  entry.count++;
  if (entry.count > opts.limit) return { success: false, remaining: 0 };
  return { success: true, remaining: opts.limit - entry.count };
}

/**
 * Async, durable rate-limit check. Use for admin-scoped limits that must
 * behave consistently across serverless function instances.
 *
 * Set `KV_REST_API_URL` (and the `KV_REST_API_TOKEN` partner) to enable
 * the Vercel KV backend. Without those env vars, an in-memory fallback
 * is used with a boot-time warning.
 */
export async function checkRateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  if (KV_CONFIGURED) return checkKv(opts);
  warnOnceIfNoKv();
  return checkInMemory(opts);
}
