import prisma from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/withAdmin";
import { parsePagination, buildSearchWhere, paginatedResponse } from "@/lib/admin/query";

export default withAdmin(async (req, res) => {
  if (req.method === "GET") {
    const { page, limit, skip } = parsePagination(req);

    const where = buildSearchWhere<Record<string, unknown>>({
      search: req.query.search,
      searchFields: ["name", "email"],
      filters: { role: req.query.role, status: req.query.status },
      enums: {
        role: ["BORROWER", "BROKER", "ADMIN"],
        status: ["ACTIVE", "SUSPENDED", "BANNED"],
      },
      publicIdField: "publicId",
    });

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          publicId: true,
          email: true,
          name: true,
          role: true,
          status: true,
          createdAt: true,
          broker: {
            select: {
              id: true,
              verificationStatus: true,
              subscriptionTier: true,
              responseCredits: true,
              brokerageName: true,
            },
          },
          _count: {
            select: {
              borrowerRequests: true,
              conversations: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return paginatedResponse(res, users, { page, limit, total });
  }

  return res.status(405).json({ error: "Method not allowed" });
});
