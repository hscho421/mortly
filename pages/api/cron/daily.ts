import { withCron } from "@/lib/cron";
import { runExpireRequests } from "./expire-requests";
import { runAutoCloseConversations } from "./auto-close-conversations";
import { runPurgeExpired } from "./purge-expired";

// Single daily dispatcher for all scheduled maintenance.
//
// Vercel Hobby caps a project at 2 cron jobs (once-daily); declaring the three
// jobs separately in vercel.json either fails the deploy or silently drops one —
// and the dropped one could be `purge-expired`, the PIPEDA retention/anonymization
// job. Running them behind one cron keeps us within the Hobby limit and lets a
// large backlog use the full function budget. The individual routes still exist
// for manual/external triggering and tests.
//
// maxDuration lifts the function past the ~10s Hobby default so the batched
// jobs (expire up to 1000, auto-close up to 50K, purge up to 25K per tick) have
// room to drain; each job is independently caught so one failure can't abort the
// rest, and Stripe-style at-most-once semantics (dedupeKey / idempotent filters)
// make a partial run safe to retry on the next firing.
export const config = { maxDuration: 60 };

export default withCron(async (_req, res) => {
  const results: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  const steps: Array<[string, () => Promise<unknown>]> = [
    ["expireRequests", runExpireRequests],
    ["autoCloseConversations", runAutoCloseConversations],
    ["purgeExpired", runPurgeExpired],
  ];

  for (const [name, run] of steps) {
    try {
      results[name] = await run();
    } catch (err) {
      console.error(`Cron daily step "${name}" failed:`, err);
      errors[name] = err instanceof Error ? err.message : "unknown error";
    }
  }

  const ok = Object.keys(errors).length === 0;
  // 200 when every step succeeded; 207-style partial otherwise so Vercel surfaces
  // the failure in logs while completed steps still commit (they're idempotent).
  return res.status(ok ? 200 : 500).json({ success: ok, results, errors });
});
