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

  try {
    if (req.method === "GET") {
      const { search, status, targetType, page: pageStr, limit: limitStr } = req.query;

      const page = Math.max(1, parseInt(pageStr as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(limitStr as string) || 20));
      const skip = (page - 1) * limit;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {};

      if (status && status !== "ALL") {
        where.status = status;
      }

      if (targetType && targetType !== "ALL") {
        where.targetType = targetType;
      }

      if (search && typeof search === "string" && search.trim()) {
        const s = search.trim();
        where.OR = [
          { reason: { contains: s, mode: "insensitive" } },
          { targetId: { contains: s } },
          { reporter: { name: { contains: s, mode: "insensitive" } } },
        ];
      }

      const [rawReports, total] = await Promise.all([
        prisma.report.findMany({
          where,
          include: {
            reporter: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.report.count({ where }),
      ]);

      // Resolve CUID targetIds to publicIds for display
      const reports = await Promise.all(
        rawReports.map(async (report) => {
          // Already a publicId (9-digit number)
          if (/^\d{9}$/.test(report.targetId)) return report;

          let publicId: string | null = null;
          try {
            if (report.targetType === "BROKER") {
              // Old reports stored broker.id (CUID), try broker lookup first
              const broker = await prisma.broker.findUnique({
                where: { id: report.targetId },
                include: { user: { select: { publicId: true } } },
              });
              if (broker) {
                publicId = broker.user.publicId;
              } else {
                // Might be a userId
                const user = await prisma.user.findUnique({
                  where: { id: report.targetId },
                  select: { publicId: true },
                });
                publicId = user?.publicId ?? null;
              }
            } else if (report.targetType === "REQUEST") {
              const request = await prisma.borrowerRequest.findUnique({
                where: { id: report.targetId },
                select: { publicId: true },
              });
              publicId = request?.publicId ?? null;
            } else if (report.targetType === "CONVERSATION") {
              const convo = await prisma.conversation.findUnique({
                where: { id: report.targetId },
                select: { publicId: true },
              });
              publicId = convo?.publicId ?? null;
            }
          } catch {
            // Target may have been deleted
          }

          return { ...report, targetId: publicId || report.targetId };
        })
      );

      return res.status(200).json({
        data: reports,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error in /api/admin/reports:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
