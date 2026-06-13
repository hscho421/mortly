import prisma from "@/lib/prisma";
import { getSettingInt } from "@/lib/settings";
import { withCron } from "@/lib/cron";
import { notifyUser } from "@/lib/notify";

// Bound per-tick work — a backlog drains across cron firings.
const MAX_EXPIRY_PER_RUN = 1000;

export default withCron(async (_req, res) => {
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
    return res.status(200).json({ success: true, expiredCount: 0 });
  }

  const result = await prisma.borrowerRequest.updateMany({
    where: { id: { in: toExpire.map((r) => r.id) }, status: { in: ["OPEN", "PENDING_APPROVAL"] } },
    data: { status: "EXPIRED" },
  });

  // Notice + push per borrower (no email — bulk cron). dedupeKey makes this
  // at-most-once per request even if a cron tick is retried. notifyUser never
  // throws, so a notification failure can't fail the cron run.
  for (const r of toExpire) {
    await notifyUser({
      userId: r.borrowerId,
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
    });
  }

  return res.status(200).json({ success: true, expiredCount: result.count });
});
