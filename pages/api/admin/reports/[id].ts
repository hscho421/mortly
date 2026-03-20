import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }

  const { id } = req.query;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Invalid report ID" });
  }

  try {
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

      const report = await prisma.report.findUnique({
        where: { id },
      });

      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }

      const previousStatus = report.status;

      const updateData: Record<string, unknown> = {};
      if (status) updateData.status = status;
      if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
      if (status === "RESOLVED" || status === "DISMISSED") {
        updateData.resolvedAt = new Date();
      }

      const updated = await prisma.report.update({
        where: { id },
        data: updateData,
      });

      // Log admin action when status changes
      if (status && status !== previousStatus) {
        await prisma.adminAction.create({
          data: {
            adminId: session.user.id,
            action: status === "RESOLVED" ? "RESOLVE_REPORT" : status === "DISMISSED" ? "DISMISS_REPORT" : "UPDATE_REPORT",
            targetType: "REPORT",
            targetId: id,
            details: JSON.stringify({
              previousStatus,
              newStatus: status,
              reportTargetType: report.targetType,
              reportTargetId: report.targetId,
            }),
            reason: adminNotes || null,
          },
        });
      }

      return res.status(200).json(updated);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error in /api/admin/reports/[id]:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
