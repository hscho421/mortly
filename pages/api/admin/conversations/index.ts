import prisma from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/withAdmin";
import { parsePagination, buildSearchWhere, paginatedResponse } from "@/lib/admin/query";

export default withAdmin(async (req, res) => {
  if (req.method === "GET") {
    const { page, limit, skip } = parsePagination(req);

    const where = buildSearchWhere({
      search: req.query.search,
      searchFields: [
        "borrower.name",
        "borrower.email",
        "broker.user.name",
        "broker.user.email",
        "broker.brokerageName",
      ],
      filters: {
        status: req.query.status,
      },
      enums: { status: ["ACTIVE", "CLOSED"] },
    });

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        // Switched from `include` (full record) to `select` (subset) — the
        // previous response shipped ~5KB/row of unused broker/user fields
        // (preferences, passwordHash absent but other columns present),
        // adding ~500KB to a 100-item page.
        select: {
          id: true,
          publicId: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          borrower: {
            select: { id: true, name: true, email: true, status: true },
          },
          broker: {
            select: {
              id: true,
              brokerageName: true,
              user: { select: { id: true, name: true, email: true, status: true } },
            },
          },
          request: {
            select: { id: true, province: true, city: true, status: true, mortgageCategory: true, productTypes: true },
          },
          _count: { select: { messages: true } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { body: true, createdAt: true, sender: { select: { name: true } } },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.conversation.count({ where }),
    ]);

    return paginatedResponse(res, conversations, { page, limit, total });
  }

  return res.status(405).json({ error: "Method not allowed" });
});
