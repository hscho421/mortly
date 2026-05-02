import prisma from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/withAdmin";
import { parsePagination, buildSearchWhere, paginatedResponse } from "@/lib/admin/query";

export default withAdmin(async (req, res) => {
  if (req.method === "GET") {
    const { page, limit, skip } = parsePagination(req);

    const where = buildSearchWhere({
      search: req.query.search,
      searchFields: ["reason", "reporter.name"],
      filters: {
        status: req.query.status,
        targetType: req.query.targetType,
      },
      enums: {
        status: ["OPEN", "REVIEWED", "RESOLVED", "DISMISSED"],
        targetType: ["BROKER", "REQUEST", "CONVERSATION", "USER"],
      },
      publicIdField: "targetId",
    });

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

    return paginatedResponse(res, reports, { page, limit, total });
  }

  return res.status(405).json({ error: "Method not allowed" });
});
