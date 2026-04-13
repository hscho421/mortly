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

      // Batch-resolve CUID targetIds to publicIds (avoids N+1)
      const cuidReports = rawReports.filter((r: { targetId: string }) => !/^\d{9}$/.test(r.targetId));
      const idsByType: Record<string, string[]> = {};
      for (const r of cuidReports) {
        (idsByType[r.targetType] ??= []).push(r.targetId);
      }

      const publicIdMap = new Map<string, string>();

      const batchQueries: Promise<void>[] = [];
      if (idsByType["BROKER"]?.length) {
        batchQueries.push(
          prisma.broker.findMany({
            where: { id: { in: idsByType["BROKER"] } },
            include: { user: { select: { publicId: true } } },
          }).then((brokers: { id: string; user: { publicId: string } }[]) => {
            for (const b of brokers) publicIdMap.set(b.id, b.user.publicId);
          }),
          prisma.user.findMany({
            where: { id: { in: idsByType["BROKER"] } },
            select: { id: true, publicId: true },
          }).then((users: { id: string; publicId: string }[]) => {
            for (const u of users) {
              if (!publicIdMap.has(u.id)) publicIdMap.set(u.id, u.publicId);
            }
          })
        );
      }
      if (idsByType["REQUEST"]?.length) {
        batchQueries.push(
          prisma.borrowerRequest.findMany({
            where: { id: { in: idsByType["REQUEST"] } },
            select: { id: true, publicId: true },
          }).then((reqs: { id: string; publicId: string }[]) => {
            for (const r of reqs) publicIdMap.set(r.id, r.publicId);
          })
        );
      }
      if (idsByType["CONVERSATION"]?.length) {
        batchQueries.push(
          prisma.conversation.findMany({
            where: { id: { in: idsByType["CONVERSATION"] } },
            select: { id: true, publicId: true },
          }).then((convos: { id: string; publicId: string }[]) => {
            for (const c of convos) publicIdMap.set(c.id, c.publicId);
          })
        );
      }

      await Promise.all(batchQueries);

      const reports = rawReports.map((report: typeof rawReports[number]) => {
        if (/^\d{9}$/.test(report.targetId)) return report;
        const resolved = publicIdMap.get(report.targetId);
        return resolved ? { ...report, targetId: resolved } : report;
      });

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
