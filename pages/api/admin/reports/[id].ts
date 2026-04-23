import prisma from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/withAdmin";
import {
  buildAdminActionCreate,
  MAX_NOTES_LEN,
  validateText,
} from "@/lib/admin/audit";

export default withAdmin(async (req, res, session) => {
  const { id } = req.query;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Invalid report ID" });
  }

  if (req.method === "GET") {
    const report = await prisma.report.findUnique({
      where: { id },
      include: {
        reporter: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    // Fetch target details based on targetType
    let targetDetails = null;
    if (report.targetType === "BROKER") {
      targetDetails = await prisma.broker.findUnique({
        where: { id: report.targetId },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
    } else if (report.targetType === "REQUEST") {
      targetDetails = await prisma.borrowerRequest.findUnique({
        where: { id: report.targetId },
        include: { borrower: { select: { id: true, name: true, email: true } } },
      });
    } else if (report.targetType === "CONVERSATION") {
      targetDetails = await prisma.conversation.findUnique({
        where: { id: report.targetId },
        include: {
          borrower: { select: { id: true, name: true, email: true } },
          broker: { include: { user: { select: { id: true, name: true, email: true } } } },
          _count: { select: { messages: true } },
        },
      });
    }

    return res.status(200).json({ ...report, targetDetails });
  }

  if (req.method === "PUT") {
    const { status, adminNotes } = req.body;

    if (!status && adminNotes === undefined) {
      return res.status(400).json({ error: "status or adminNotes is required" });
    }

    if (status) {
      // Must match Prisma's ReportStatus enum (see prisma/schema.prisma).
      const VALID_STATUSES = ["OPEN", "REVIEWED", "RESOLVED", "DISMISSED"];
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
      }
    }

    const report = await prisma.report.findUnique({
      where: { id },
    });

    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    const previousStatus = report.status;

    const notesValidated = validateText(adminNotes, MAX_NOTES_LEN, "adminNotes");
    if (notesValidated && typeof notesValidated === "object") {
      return res.status(400).json({ error: notesValidated.error });
    }

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (adminNotes !== undefined) updateData.adminNotes = notesValidated;
    if (status === "RESOLVED" || status === "DISMISSED") {
      updateData.resolvedAt = new Date();
    }

    const updated = await prisma.report.update({
      where: { id },
      data: updateData,
    });

    // Log admin action when status changes
    if (status && status !== previousStatus) {
      await prisma.adminAction.create(
        buildAdminActionCreate(req, session, {
          action:
            status === "RESOLVED"
              ? "RESOLVE_REPORT"
              : status === "DISMISSED"
              ? "DISMISS_REPORT"
              : "UPDATE_REPORT",
          targetType: "REPORT",
          targetId: id,
          details: {
            previousStatus,
            newStatus: status,
            reportTargetType: report.targetType,
            reportTargetId: report.targetId,
          },
          reason: notesValidated,
        }),
      );
    }

    return res.status(200).json(updated);
  }

  return res.status(405).json({ error: "Method not allowed" });
});
