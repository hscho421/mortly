/**
 * Server-authorized realtime nudges for chat.
 *
 * SECURITY MODEL — read before changing:
 *   Chat reads are NEVER delivered over Supabase Realtime `postgres_changes`
 *   anymore. That path streamed full `messages` rows to any client holding the
 *   public anon key, gated only by Postgres RLS — and RLS was disabled on
 *   `public.messages` / `public.conversations`, so it was a cross-conversation
 *   data breach.
 *
 *   Instead: `public.messages` and `public.conversations` have RLS ENABLED with
 *   no anon SELECT policy (deny-all), so no anon client can read a row. Realtime
 *   now carries only a CONTENT-FREE "sync" broadcast — a nudge that says
 *   "something changed in this conversation." On receipt the client refetches
 *   the thread through the authenticated, participant-gated
 *   `GET /api/conversations/[id]`. No message body, sender, or financial detail
 *   ever travels over the anon-key transport.
 *
 *   The broadcast topic is `chat-<conversationId>` where the id is the
 *   unguessable internal cuid, only ever disclosed to participants. An
 *   eavesdropper who somehow learned a conversation id would learn at most that
 *   "a message happened" — never its contents.
 *
 * The HTTP broadcast endpoint is used (not the realtime websocket) so this works
 * statelessly from serverless handlers. Calls are fire-and-forget: realtime is a
 * latency optimization layered on top of the client's 5s polling fallback, so a
 * broadcast failure must never break the originating request.
 */

const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Computed from env directly (not imported from lib/supabase) so this
// server-only helper never pulls the browser realtime `createClient()` into
// API handlers — that client throws at module load when the URL env is unset.
const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && SUPABASE_ANON_KEY,
);

function broadcastUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  // Mirror lib/supabase.ts: coerce http:// → https:// so we hit the TLS host.
  const base = raw.startsWith("http://")
    ? "https://" + raw.slice("http://".length)
    : raw;
  return `${base.replace(/\/$/, "")}/realtime/v1/api/broadcast`;
}

async function sendBroadcast(topics: string[]): Promise<void> {
  if (!isSupabaseConfigured || topics.length === 0) return;
  try {
    await fetch(broadcastUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        messages: topics.map((topic) => ({
          topic,
          event: "sync",
          // INTENTIONALLY EMPTY — never put chat content here.
          payload: {},
        })),
      }),
    });
  } catch (err) {
    // Best-effort only; the client's polling fallback backstops every update.
    console.error("[realtime] broadcast failed:", err);
  }
}

/** Nudge the participants of one conversation to refetch their thread. */
export async function notifyConversation(conversationId: string): Promise<void> {
  if (!conversationId) return;
  return sendBroadcast([`chat-${conversationId}`]);
}

/** Nudge participants of several conversations at once (bulk close flows). */
export async function notifyConversations(conversationIds: string[]): Promise<void> {
  const unique = Array.from(new Set(conversationIds.filter(Boolean)));
  return sendBroadcast(unique.map((id) => `chat-${id}`));
}
