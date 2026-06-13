import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * SERVER-ONLY Supabase client using the service-role key. NEVER import this
 * into client code — the service-role key bypasses RLS and must never reach
 * the browser bundle (that's why the key is SUPABASE_SERVICE_ROLE_KEY, not a
 * NEXT_PUBLIC_ var). Used to mint scoped signed upload URLs and to delete
 * objects (avatar uploads / account deletion).
 *
 * Returns null when not configured so callers degrade gracefully (e.g. local
 * dev / CI without the key) instead of throwing at import time — mirrors the
 * lib/supabase.ts approach that keeps the build robust.
 */
export const AVATAR_BUCKET = "avatars";

let _client: SupabaseClient | null | undefined;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (_client !== undefined) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!url || !serviceKey) {
    if (typeof console !== "undefined") {
      console.warn(
        "[supabaseAdmin] NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY missing — avatar storage operations are disabled.",
      );
    }
    _client = null;
    return _client;
  }

  _client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

export const isAvatarStorageConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/** Deterministic object key for a broker's avatar (overwrites in place). */
export function brokerAvatarPath(userId: string): string {
  return `brokers/${userId}.webp`;
}

/** Public URL for a stored avatar object path. */
export function avatarPublicUrl(path: string): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  return `${url}/storage/v1/object/public/${AVATAR_BUCKET}/${path}`;
}
