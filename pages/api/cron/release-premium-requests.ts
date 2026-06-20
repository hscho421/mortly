import prisma from "@/lib/prisma";
import { withCron } from "@/lib/cron";
import { getPremiumAccessConfig, shouldReleaseNow } from "@/lib/premiumAccess";

// Bound per-tick work — a backlog drains across cron firings.
const MAX_RELEASE_PER_RUN = 1000;
const HOUR_MS = 3_600_000;

// Releases PREMIUM-exclusive requests to all brokers once they hit the hard cap
// (windowHours) or the count valve (past valveHours with < minResponses intros).
// The feed/detail/intro gates also apply the hard cap at read time, so the exact
// 12h release never depends on this cron's cadence — the cron just persists the
// `premiumReleasedAt` latch and handles the count-based early release.
//
// NOT scheduled in vercel.json: Vercel Hobby caps crons at ~2 jobs / once-daily,
// so this endpoint is intentionally left off the Vercel schedule. The 12h cap is
// read-time-enforced, so the embargo is fully correct without it; only the 6h
// early-release valve is inactive. To enable the valve, either upgrade to Vercel
// Pro and re-add it to vercel.json (hourly), or hit this endpoint from an external
// scheduler (set ALLOW_NONVERCEL_CRON=1 + send `Authorization: Bearer $CRON_SECRET`).
export default withCron(async (_req, res) => {
  const config = await getPremiumAccessConfig();

  // Feature off → nothing is ever exclusive, so there's nothing to release.
  if (!config.enabled) {
    return res.status(200).json({ success: true, releasedCount: 0, skipped: "disabled" });
  }

  const now = new Date();
  // Earliest possible trigger is whichever of valve/cap comes first; scan from
  // there so a misconfigured valve >= window can't strand the hard cap.
  const earliestTriggerH = Math.min(config.valveHours, config.windowHours);
  const scanCutoff = new Date(now.getTime() - earliestTriggerH * HOUR_MS);

  const candidates = await prisma.borrowerRequest.findMany({
    where: {
      status: "OPEN",
      premiumReleasedAt: null,
      approvedAt: { not: null, lte: scanCutoff },
    },
    select: {
      id: true,
      approvedAt: true,
      premiumReleasedAt: true,
      // responseCount = brokers actively engaged. During the window only PREMIUM
      // brokers can open a conversation, so < minResponses means too few premium
      // brokers bit. ACTIVE-only: a closed conversation (borrower declined that
      // broker) shouldn't keep a borrower's request hidden from the wider market.
      _count: { select: { conversations: { where: { status: "ACTIVE" } } } },
    },
    take: MAX_RELEASE_PER_RUN,
  });

  const toRelease = candidates.filter((r) =>
    shouldReleaseNow(
      { approvedAt: r.approvedAt, premiumReleasedAt: r.premiumReleasedAt },
      r._count.conversations,
      config,
      now
    )
  );

  if (toRelease.length === 0) {
    return res.status(200).json({ success: true, releasedCount: 0 });
  }

  // Re-assert premiumReleasedAt: null in the WHERE so a concurrent run can't
  // double-latch (idempotent under cron retries).
  const result = await prisma.borrowerRequest.updateMany({
    where: { id: { in: toRelease.map((r) => r.id) }, premiumReleasedAt: null },
    data: { premiumReleasedAt: now },
  });

  return res.status(200).json({ success: true, releasedCount: result.count });
});
