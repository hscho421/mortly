import prisma from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/withAdmin";
import { notifyUser } from "@/lib/notify";

export default withAdmin(async (req, res, session) => {
  const { id } = req.query;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Invalid broker ID" });
  }

  // GET was removed when /admin/brokers/[id] was folded into the unified
  // /admin/users/[id] page: that page's broker panel is fed by the existing
  // GET /api/admin/users/[id] (its broker sub-select), so this route only
  // needs to serve the verification mutation below. The inbox inline
  // approve/reject also PUTs here.
  if (req.method === "PUT") {
    const { verificationStatus, reason } = req.body;

    if (!verificationStatus) {
      return res.status(400).json({ error: "verificationStatus is required" });
    }

    const VALID_STATUSES = ["PENDING", "VERIFIED", "REJECTED"];
    if (!VALID_STATUSES.includes(verificationStatus)) {
      return res.status(400).json({ error: `verificationStatus must be one of: ${VALID_STATUSES.join(", ")}` });
    }

    const broker = await prisma.broker.findUnique({
      where: { id },
      include: { user: { select: { publicId: true, id: true } } },
    });

    if (!broker) {
      return res.status(404).json({ error: "Broker not found" });
    }

    // Two-admin gate for VERIFIED — opt-in via env flag. When enabled,
    // a single admin can only RECOMMEND verification (creates a
    // RECOMMEND_VERIFY_BROKER audit row); the actual VERIFIED flip must
    // be performed by a different admin, blocking a single rogue or
    // compromised admin from minting fake verified brokers at scale.
    // Disabled by default so single-admin deployments aren't blocked.
    const requireDualReview = process.env.BROKER_VERIFY_REQUIRES_TWO_ADMINS === "true";
    if (requireDualReview && verificationStatus === "VERIFIED") {
      const recommendation = await prisma.adminAction.findFirst({
        where: {
          action: "RECOMMEND_VERIFY_BROKER",
          targetType: "BROKER",
          targetId: broker.user.publicId,
          adminId: { not: session.user.id },
        },
        orderBy: { createdAt: "desc" },
      });
      if (!recommendation) {
        // Record THIS admin's recommendation. Another admin can complete the
        // verification by re-PUTing VERIFIED.
        await prisma.adminAction.create({
          data: {
            adminId: session.user.id,
            action: "RECOMMEND_VERIFY_BROKER",
            targetType: "BROKER",
            targetId: broker.user.publicId,
            details: JSON.stringify({
              previousStatus: broker.verificationStatus,
              ...(reason ? { reason } : {}),
            }),
          },
        });
        return res.status(202).json({
          status: "PENDING_SECOND_REVIEW",
          message: "Recommendation recorded. A different admin must complete the verification.",
        });
      }
    }

    const actionMap: Record<string, string> = {
      VERIFIED: "VERIFY_BROKER",
      REJECTED: "REJECT_BROKER",
      PENDING: "RESET_BROKER_VERIFICATION",
    };

    const [updated] = await prisma.$transaction([
      prisma.broker.update({
        where: { id },
        data: { verificationStatus },
      }),
      prisma.adminAction.create({
        data: {
          adminId: session.user.id,
          action: actionMap[verificationStatus] || "UPDATE_BROKER",
          targetType: "BROKER",
          targetId: broker.user.publicId,
          details: JSON.stringify({
            previousStatus: broker.verificationStatus,
            newStatus: verificationStatus,
            ...(reason ? { reason } : {}),
          }),
        },
      }),
    ]);

    // Tell the broker about the decision — verification outcomes were
    // previously silent; brokers had to keep checking their dashboard.
    if (verificationStatus === "VERIFIED" && broker.verificationStatus !== "VERIFIED") {
      await notifyUser({
        userId: broker.user.id,
        adminId: session.user.id,
        subject: "중개인 인증이 완료되었습니다 / You're verified",
        body:
          "중개인 인증이 완료되었습니다. 이제 상담 요청을 보고 응답할 수 있습니다. / " +
          "Your broker verification is complete. You can now browse and respond to requests.",
        push: {
          title: { ko: "인증 완료", en: "Verification complete" },
          body: {
            ko: "이제 상담 요청에 응답할 수 있습니다.",
            en: "You can now respond to consultation requests.",
          },
        },
        pushData: { type: "verification" },
        email: {
          subjectKo: "중개인 인증이 완료되었습니다",
          subjectEn: "You're verified on mortly",
          bodyKo: "인증이 완료되어 이제 상담 요청을 보고 응답할 수 있습니다.",
          bodyEn: "Your verification is complete — you can now browse and respond to requests.",
          ctaPath: "/broker/requests",
          ctaLabelKo: "요청 보기",
          ctaLabelEn: "Browse requests",
        },
      });
    } else if (verificationStatus === "REJECTED" && broker.verificationStatus !== "REJECTED") {
      const reasonKo = reason ? ` 사유: ${reason}` : "";
      const reasonEn = reason ? ` Reason: ${reason}` : "";
      await notifyUser({
        userId: broker.user.id,
        adminId: session.user.id,
        subject: "중개인 인증이 거절되었습니다 / Verification not approved",
        body:
          `중개인 인증이 거절되었습니다.${reasonKo} 문의는 고객센터로 연락해 주세요. / ` +
          `Your broker verification was not approved.${reasonEn} Contact support to review your profile.`,
        email: {
          subjectKo: "중개인 인증이 거절되었습니다",
          subjectEn: "Your verification was not approved",
          bodyKo: `중개인 인증이 거절되었습니다.${reasonKo}`,
          bodyEn: `Your broker verification was not approved.${reasonEn}`,
          ctaPath: "/contact",
          ctaLabelKo: "문의하기",
          ctaLabelEn: "Contact support",
        },
      });
    }

    return res.status(200).json(updated);
  }

  return res.status(405).json({ error: "Method not allowed" });
});
