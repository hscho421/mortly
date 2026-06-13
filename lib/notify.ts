import prisma from "@/lib/prisma";
import { sendPushToUsers, type LocalizedPush } from "@/lib/push";
import { sendLifecycleEmail } from "@/lib/email";

/**
 * One-stop user notification for lifecycle events: in-app AdminNotice
 * (consumed by the Navbar bell via GET /api/notices) + optional Expo push +
 * optional bilingual email.
 *
 * Fire-safe by contract: NEVER throws. Callers are admin handlers, webhooks
 * and crons where a notification failure must not fail the primary action.
 *
 * AdminNotice.adminId is required by the schema — pass the acting admin's id
 * when there is one; system senders (webhooks, crons) fall back to the first
 * ADMIN account, and the notice is skipped if none exists yet.
 */
export async function notifyUser(opts: {
  userId: string;
  adminId?: string;
  subject: string;
  body: string;
  /** Stable key for at-most-once delivery across retries (webhooks/crons). */
  dedupeKey?: string;
  push?: LocalizedPush;
  pushData?: Record<string, string | number | boolean | undefined>;
  email?: {
    subjectKo: string;
    subjectEn: string;
    bodyKo: string;
    bodyEn: string;
    ctaPath?: string;
    ctaLabelKo?: string;
    ctaLabelEn?: string;
  };
}): Promise<void> {
  try {
    let adminId = opts.adminId;
    if (!adminId) {
      const sysAdmin = await prisma.user.findFirst({
        where: { role: "ADMIN" },
        select: { id: true },
      });
      adminId = sysAdmin?.id;
    }

    if (adminId) {
      try {
        await prisma.adminNotice.create({
          data: {
            adminId,
            userId: opts.userId,
            subject: opts.subject,
            body: opts.body,
            dedupeKey: opts.dedupeKey,
          },
        });
      } catch (err) {
        const isDuplicate =
          err &&
          typeof err === "object" &&
          "code" in err &&
          (err as { code?: string }).code === "P2002";
        if (!isDuplicate) throw err;
      }
    }

    if (opts.push) {
      await sendPushToUsers({
        userIds: [opts.userId],
        content: opts.push,
        data: opts.pushData,
      });
    }

    if (opts.email) {
      const user = await prisma.user.findUnique({
        where: { id: opts.userId },
        select: { email: true },
      });
      if (user?.email) {
        await sendLifecycleEmail({ to: user.email, ...opts.email });
      }
    }
  } catch (err) {
    console.error("notifyUser failed:", err);
  }
}
