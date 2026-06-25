/**
 * Pre-deploy / CI smoke check for chat confidentiality.
 *
 * Hits the public Supabase PostgREST endpoint for `messages` and `conversations`
 * with ONLY the anon key (the same key shipped in the browser bundle) and fails
 * if any rows come back — which would mean Row Level Security is off and chat is
 * world-readable. Run it against the live project before launch and wire it into
 * CI:  npm run check:rls
 *
 * Exit codes: 0 = secure, 1 = leak detected, 2 = misconfigured/unable to check.
 */
import { summarizeProbe } from "../lib/rls";

const TABLES = ["messages", "conversations"] as const;

async function probe(baseUrl: string, anonKey: string, table: string) {
  const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/${table}?select=id&limit=1`;
  const res = await fetch(url, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { table, status: res.status, body };
}

async function main() {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey) {
    console.error(
      "check:rls — NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.",
    );
    process.exit(2);
  }

  let leaking = false;
  for (const table of TABLES) {
    const result = await probe(baseUrl, anonKey, table);
    const { ok, message } = summarizeProbe(result);
    console[ok ? "log" : "error"](message);
    if (!ok) leaking = true;
  }

  if (leaking) {
    console.error(
      "\nRLS smoke check FAILED — enable Row Level Security (deny-all on anon) for " +
        '"messages" and "conversations" before deploying (see migration ' +
        "20260626000000_codify_chat_rls).",
    );
    process.exit(1);
  }
  console.log("\nRLS smoke check passed — chat tables are not readable with the anon key.");
}

main().catch((err) => {
  console.error("check:rls error:", err);
  process.exit(2);
});
