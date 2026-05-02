import prisma from "@/lib/prisma";
import { getSettingInt } from "@/lib/settings";
import { withCron } from "@/lib/cron";

export default withCron(async (_req, res) => {
  const expiryDays = await getSettingInt("request_expiry_days");
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - expiryDays);

  const result = await prisma.borrowerRequest.updateMany({
    where: {
      status: { in: ["OPEN", "PENDING_APPROVAL"] },
      createdAt: { lt: cutoff },
    },
    data: { status: "EXPIRED" },
  });

  return res.status(200).json({ success: true, expiredCount: result.count });
});
