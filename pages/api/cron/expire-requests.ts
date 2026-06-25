import prisma from "@/lib/prisma";
import { getSettingInt } from "@/lib/settings";
import { withCron } from "@/lib/cron";
import { notifyUser } from "@/lib/notify";

// Bound per-tick work — a backlog drains across cron firings.
const MAX_EXPIRY_PER_RUN = 1000;
// Notify in bounded-concurrency chunks rather than one fully-sequential await
// loop, so 1000 borrowers don't serialize ~3 DB round-trips each into a
// multi-minute run that the function timeout would kill mid-loop.
const NOTIFY_CHUNK = 25;

/**
 * Expire stale borrower requests and notify each borrower. Exported so the
 * daily cron dispatcher (/api/cron/daily) can run it inline alongside the other
 * jobs while the standalone route remains for manual/external triggering.
 */
export async function runExpireRequests(): Promise<{ expiredCount: number }> {
  const expiryDays = await getSettingInt("request_expiry_days");
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - expiryDays);

  // Select first so each borrower can be told their request expired —
  // expiry was previously completely silent.
  const toExpire = await prisma.borrowerRequest.findMany({
    where: {
      status: { in: ["OPEN", "PENDING_APPROVAL"] },
      createdAt: { lt: cutoff },
      // Never expire a request brokers are actively (and paid to be) talking
      // on — those end via borrower close or the auto-close cron instead.
      conversations: { none: { status: "ACTIVE" } },
    },
    select: { id: true, publicId: true, borrowerId: true },
    take: MAX_EXPIRY_PER_RUN,
  });

  if (toExpire.length === 0) {
    return { expiredCount: 0 };
  }

  // Resolve the system-admin sender ONCE (AdminNotice.adminId is required).
  // Previously notifyUser re-ran this findFirst on every iteration.
  const sysAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  const adminId = sysAdmin?.id;

  // Notify BEFORE flipping status. dedupeKey makes each notice at-most-once, so
  // if the function times out partway, the un-flipped rows stay selectable and
  // are retried next run — at worst a duplicate push, never a permanently
  // dropped notification (the old flip-first order lost notices on timeout
  // because the EXPIRED rows no longer matched the OPEN/PENDING selection).
  // notifyUser never throws; allSettled is belt-and-suspenders.
  for (let i = 0; i < toExpire.length; i += NOTIFY_CHUNK) {
    const chunk = toExpire.slice(i, i + NOTIFY_CHUNK);
    await Promise.allSettled(
      chunk.map((r) =>
        notifyUser({
          userId: r.borrowerId,
          adminId,
          subject: "상담 요청이 만료되었습니다 / Your request expired",
          body:
            `${expiryDays}일이 지나 요청이 만료되었습니다. 계속 진행하시려면 새 요청을 작성해 주세요. / ` +
            `Your request expired after ${expiryDays} days. Submit a new request to keep looking.`,
          dedupeKey: `request-expired-${r.id}`,
          push: {
            title: { ko: "상담 요청 만료", en: "Request expired" },
            body: {
              ko: "요청이 만료되었습니다. 새 요청을 작성할 수 있습니다.",
              en: "Your request expired. You can submit a new one anytime.",
            },
          },
          pushData: { type: "request", requestId: r.publicId },
        }),
      ),
    );
  }

  const result = await prisma.borrowerRequest.updateMany({
    where: { id: { in: toExpire.map((r) => r.id) }, status: { in: ["OPEN", "PENDING_APPROVAL"] } },
    data: { status: "EXPIRED" },
  });

  return { expiredCount: result.count };
}

export default withCron(async (_req, res) => {
  const { expiredCount } = await runExpireRequests();
  return res.status(200).json({ success: true, expiredCount });
});
