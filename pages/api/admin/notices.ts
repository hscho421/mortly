import prisma from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/withAdmin";
import {
  buildAdminActionCreate,
  MAX_BODY_LEN,
  validateText,
} from "@/lib/admin/audit";

/**
 * POST /api/admin/notices — send an in-app notice to a user.
 *
 * This is the send path the rest of the notices feature was waiting on: the
 * read API (GET/PUT /api/notices), the Navbar bell, and the command-palette
 * entry all existed with no way to ever create a notice. The bell consumes
 * these rows; lifecycle senders (webhooks/admin decisions) go through
 * lib/notify.ts instead.
 */
export default withAdmin(async (req, res, session) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId, subject, body } = req.body;

  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "userId is required" });
  }

  const subjectValidated = validateText(subject, 200, "subject");
  if (subjectValidated && typeof subjectValidated === "object") {
    return res.status(400).json({ error: subjectValidated.error });
  }
  if (!subjectValidated) {
    return res.status(400).json({ error: "subject is required" });
  }

  const bodyValidated = validateText(body, MAX_BODY_LEN, "body");
  if (bodyValidated && typeof bodyValidated === "object") {
    return res.status(400).json({ error: bodyValidated.error });
  }
  if (!bodyValidated) {
    return res.status(400).json({ error: "body is required" });
  }

  // Accept either the internal id or the user-facing publicId.
  const user = /^\d{9}$/.test(userId)
    ? await prisma.user.findUnique({ where: { publicId: userId }, select: { id: true, publicId: true } })
    : await prisma.user.findUnique({ where: { id: userId }, select: { id: true, publicId: true } });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const [notice] = await prisma.$transaction([
    prisma.adminNotice.create({
      data: {
        adminId: session.user.id,
        userId: user.id,
        subject: subjectValidated,
        body: bodyValidated,
      },
    }),
    prisma.adminAction.create(
      buildAdminActionCreate(req, session, {
        action: "SEND_NOTICE",
        targetType: "USER",
        targetId: user.publicId,
        details: { subject: subjectValidated },
      }),
    ),
  ]);

  return res.status(201).json(notice);
});
