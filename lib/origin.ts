import type { NextApiRequest } from "next";

/**
 * Server-side allowlist of accepted Origin / Referer hosts. Anything outside
 * this set gets rejected on mutating endpoints and is NEVER reflected back into
 * Stripe `success_url` / `cancel_url` / `return_url`.
 *
 * Defaults are derived from `NEXTAUTH_URL`. Extra origins (e.g. preview
 * deployments, mobile WebViews) can be allowed via the comma-separated
 * `ADDITIONAL_ALLOWED_ORIGINS` env var.
 */
function buildAllowlist(): Set<string> {
  const out = new Set<string>();
  const primary = process.env.NEXTAUTH_URL;
  if (primary) out.add(normalizeOrigin(primary));
  const extra = process.env.ADDITIONAL_ALLOWED_ORIGINS;
  if (extra) {
    for (const o of extra.split(",")) {
      const trimmed = o.trim();
      if (trimmed) out.add(normalizeOrigin(trimmed));
    }
  }
  // Local dev / preview fallbacks — only added when not in production.
  if (process.env.NODE_ENV !== "production") {
    out.add("http://localhost:3000");
    out.add("http://127.0.0.1:3000");
  }
  return out;
}

function normalizeOrigin(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    return raw;
  }
}

let _allowlist: Set<string> | null = null;
function getAllowlist(): Set<string> {
  if (!_allowlist) _allowlist = buildAllowlist();
  return _allowlist;
}

/**
 * Returns the origin to use for redirect URLs (Stripe checkout / portal).
 * NEVER reads from `req.headers.origin` — that header is client-controlled and
 * was a confirmed open-redirect path before this helper existed.
 */
export function getSafeRedirectOrigin(): string {
  const fallback = process.env.NEXTAUTH_URL;
  if (!fallback) {
    throw new Error("NEXTAUTH_URL must be set for redirect generation");
  }
  return normalizeOrigin(fallback);
}

/**
 * CSRF gate for mutating requests. Returns true when:
 *   - `Origin` (preferred) or `Referer` is set, AND
 *   - parses to one of the allowlisted `<scheme>//<host>` strings, AND
 *   - scheme is `https:` in production.
 *
 * `host`-only matching against `req.headers.host` is intentionally NOT used
 * here — that header is also client-supplied through some proxies.
 */
export function isAllowedOrigin(req: NextApiRequest): boolean {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : null;
  const referer = typeof req.headers.referer === "string" ? req.headers.referer : null;
  const candidate = origin ?? referer;
  if (!candidate) return false;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return false;
  }

  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    return false;
  }

  const normalized = `${parsed.protocol}//${parsed.host}`;
  return getAllowlist().has(normalized);
}

/** Test/seam — clear the cached allowlist. */
export function _resetOriginAllowlist(): void {
  _allowlist = null;
}
