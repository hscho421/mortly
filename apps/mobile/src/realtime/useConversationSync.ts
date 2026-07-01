import { useEffect } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Subscribe to the content-free "sync" broadcast for a conversation and run
 * `onSync` on each nudge. Mirrors the web messages screens: Realtime is
 * ONLY a latency hint — no chat content flows over it (the anon client is RLS
 * deny-all). The caller fetches actual messages over the authenticated API on
 * each nudge and should keep a polling fallback for when Realtime is down.
 *
 * `onSync` should be stable (wrap in useCallback) to avoid resubscribing.
 */
export function useConversationSync(conversationId: string | null, onSync: () => void) {
  useEffect(() => {
    if (!conversationId || !isSupabaseConfigured) return;
    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on("broadcast", { event: "sync" }, () => onSync())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, onSync]);
}
