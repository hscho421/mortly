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

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
