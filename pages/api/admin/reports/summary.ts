import prisma from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/withAdmin";

/**
 * GET /api/admin/reports/summary
 *
 * Single-round-trip count of reports grouped by status. Replaces the 4
 * separate `GET /api/admin/reports?status=X&limit=1` calls the Reports page
 * used to make just to compute the filter-chip badges.
 *
 * Response shape:
 *   { OPEN: number, REVIEWED: number, RESOLVED: number, DISMISSED: number }
 */
export default withAdmin(async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const grouped = await prisma.report.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  const counts: Record<"OPEN" | "REVIEWED" | "RESOLVED" | "DISMISSED", number> = {
    OPEN: 0,
    REVIEWED: 0,
    RESOLVED: 0,
    DISMISSED: 0,
  };

  for (const row of grouped) {
    if (row.status in counts) {
      counts[row.status as keyof typeof counts] = row._count._all;
    }
  }

  // Short client cache so multiple admin tabs don't refight for the same counts.
  res.setHeader("Cache-Control", "private, max-age=30");
  return res.status(200).json(counts);
});
