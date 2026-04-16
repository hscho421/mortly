import prisma from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/withAdmin";
import { parsePagination, buildSearchWhere, paginatedResponse } from "@/lib/admin/query";

export default withAdmin(async (req, res) => {
  if (req.method === "GET") {
    const { page, limit, skip } = parsePagination(req);

    const where = buildSearchWhere<Record<string, unknown>>({
      search: req.query.search,
      searchFields: ["province", "city", "borrower.name"],
      filters: {
        status: req.query.status,
        mortgageCategory: req.query.type,
      },
      publicIdField: "publicId",
    });

    const [requests, total] = await Promise.all([
      prisma.borrowerRequest.findMany({
        where,
        include: {
          borrower: {
            select: { id: true, name: true, email: true, status: true },
          },
          _count: {
            select: { conversations: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.borrowerRequest.count({ where }),
    ]);

    return paginatedResponse(res, requests, { page, limit, total });
  }

  return res.status(405).json({ error: "Method not allowed" });
});
