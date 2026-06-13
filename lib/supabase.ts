import { createClient } from "@supabase/supabase-js";

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Defensive normalization. Realtime derives the WebSocket scheme from the
// URL scheme — `http://...` becomes `ws://...`, which Safari blocks as
// mixed content on an https page (the symptom: `WebSocket not available:
// The operation is insecure`). Coerce to https so realtime always uses wss.
function normalizeSupabaseUrl(raw: string): string {
  if (!raw) return "";
  if (raw.startsWith("http://")) {
    if (typeof console !== "undefined") {
      console.warn(
        "[supabase] NEXT_PUBLIC_SUPABASE_URL is http://; coercing to https:// so Realtime uses wss://",
      );
    }
    return "https://" + raw.slice("http://".length);
  }
  return raw;
}

const supabaseUrl = normalizeSupabaseUrl(rawUrl);

if (!supabaseUrl || !supabaseAnonKey) {
  // Loud warning at boot — without this the symptom is a generic browser
  // WebSocket error in Realtime consumers, with no hint that an env var
  // wasn't set on the host.
  if (typeof console !== "undefined") {
    console.warn(
      "[supabase] NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY are missing. Realtime features will be disabled.",
    );
  }
}

/** True when supabase env is wired up and Realtime can be used. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// When the public env vars are absent, fall back to an inert placeholder
// client. `createClient("", "")` throws "supabaseUrl is required" at MODULE
// LOAD, which crashes Next's page-data collection for any page that imports
// this (e.g. /borrower/messages) — failing the whole build on a host that
// hasn't set NEXT_PUBLIC_SUPABASE_* (and NEXT_PUBLIC vars must exist at BUILD
// time). Every consumer guards on `isSupabaseConfigured` before touching
// `supabase`, so the placeholder is constructed but never actually contacted.
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
);

// ── Avatar storage (client-safe helpers) ──────────────────────
export const AVATAR_BUCKET = "avatars";

/**
 * Build the public URL for a stored avatar object path. Client-safe (only
 * reads NEXT_PUBLIC_SUPABASE_URL). `version` busts the CDN/browser cache when
 * a broker replaces their photo (deterministic path = same URL otherwise).
 */
export function avatarPublicUrl(path: string, version?: string | number): string | null {
  if (!supabaseUrl || !path) return null;
  const base = `${supabaseUrl}/storage/v1/object/public/${AVATAR_BUCKET}/${path}`;
  return version != null ? `${base}?v=${version}` : base;
}

/**
 * On-the-fly resized variant via Supabase image transformations (Pro feature).
 * Serving a `size`px square instead of the full image keeps egress tiny for
 * chat icons / cards. Falls back to the plain public URL if not configured.
 */
export function avatarTransformUrl(path: string, size: number): string | null {
  if (!supabaseUrl || !path) return null;
  return `${supabaseUrl}/storage/v1/render/image/public/${AVATAR_BUCKET}/${path}?width=${size}&height=${size}&resize=cover`;
}
