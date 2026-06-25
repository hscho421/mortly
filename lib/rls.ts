// Pure evaluation logic for the anon-key RLS smoke check (scripts/check-rls.ts).
// Kept dependency-free so it can be unit-tested without a network call.

export type RlsProbe = { table: string; status: number; body: unknown };

/**
 * True when an anon-key PostgREST read leaked rows — meaning Row Level Security
 * is OFF (or has a permissive anon policy). A correctly-secured table returns
 * 401/403/404, or 200 with an EMPTY array (RLS filtered every row).
 */
export function isRlsLeaking(status: number, body: unknown): boolean {
  return status === 200 && Array.isArray(body) && body.length > 0;
}

export function summarizeProbe(p: RlsProbe): { ok: boolean; message: string } {
  if (isRlsLeaking(p.status, p.body)) {
    const n = Array.isArray(p.body) ? p.body.length : 0;
    return {
      ok: false,
      message: `LEAK: "${p.table}" returned ${n} row(s) to the anon key (HTTP ${p.status}) — RLS is OFF`,
    };
  }
  return { ok: true, message: `OK: "${p.table}" denied to the anon key (HTTP ${p.status})` };
}
