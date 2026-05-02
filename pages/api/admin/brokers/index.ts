import prisma from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/withAdmin";
import { parsePagination, buildSearchWhere, paginatedResponse } from "@/lib/admin/query";

export default withAdmin(async (req, res) => {
  if (req.method === "GET") {
    const { page, limit, skip } = parsePagination(req);

    const where = buildSearchWhere<Record<string, unknown>>({
      filters: { verificationStatus: req.query.status },
      enums: { verificationStatus: ["PENDING", "VERIFIED", "REJECTED"] },
    });

    const [brokers, total] = await Promise.all([
      prisma.broker.findMany({
        where,
        include: {
          user: {
            select: { name: true, publicId: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.broker.count({ where }),
    ]);

    return paginatedResponse(res, brokers, { page, limit, total });
  }

  return res.status(405).json({ error: "Method not allowed" });
});
