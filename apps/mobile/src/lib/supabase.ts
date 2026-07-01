import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";

/**
 * Anon-only Supabase client — the SAME security model as the web (lib/supabase.ts).
 *
 * Chat `messages`/`conversations` are RLS deny-all to this anon key, so NO
 * message content ever flows over Supabase. Realtime carries only a
 * content-free "sync" broadcast; all real content is fetched over the
 * authenticated Next.js API (participant-checked). Hence: no setAuth, no
 * Supabase session — the NextAuth JWT is used only against /api/*.
 */
const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Normalize to https so Realtime connects over wss://.
const url = rawUrl.replace(/^http:\/\//, "https://");

export const isSupabaseConfigured = Boolean(rawUrl && anonKey);

export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder-anon-key",
  { auth: { persistSession: false, autoRefreshToken: false } },
);
