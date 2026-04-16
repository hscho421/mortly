import prisma from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/withAdmin";

export default withAdmin(async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const days = 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  // Use SQL aggregation instead of fetching all rows into memory
  const [userCounts, requestCounts, conversationCounts] = await Promise.all([
    prisma.$queryRaw<{ d: string; count: bigint }[]>`
      SELECT DATE("createdAt") as d, COUNT(*) as count
      FROM users WHERE "createdAt" >= ${since}
      GROUP BY d ORDER BY d`,
    prisma.$queryRaw<{ d: string; count: bigint }[]>`
      SELECT DATE("createdAt") as d, COUNT(*) as count
      FROM borrower_requests WHERE "createdAt" >= ${since}
      GROUP BY d ORDER BY d`,
    prisma.$queryRaw<{ d: string; count: bigint }[]>`
      SELECT DATE("createdAt") as d, COUNT(*) as count
      FROM conversations WHERE "createdAt" >= ${since}
      GROUP BY d ORDER BY d`,
  ]);

  // Build daily buckets
  const buckets: Record<string, { users: number; requests: number; conversations: number }> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const key = d.toISOString().slice(0, 10);
    buckets[key] = { users: 0, requests: 0, conversations: 0 };
  }

  for (const row of userCounts) {
    const key = typeof row.d === "string" ? row.d : new Date(row.d).toISOString().slice(0, 10);
    if (buckets[key]) buckets[key].users = Number(row.count);
  }
  for (const row of requestCounts) {
    const key = typeof row.d === "string" ? row.d : new Date(row.d).toISOString().slice(0, 10);
    if (buckets[key]) buckets[key].requests = Number(row.count);
  }
  for (const row of conversationCounts) {
    const key = typeof row.d === "string" ? row.d : new Date(row.d).toISOString().slice(0, 10);
    if (buckets[key]) buckets[key].conversations = Number(row.count);
  }

  const trend = Object.entries(buckets).map(([date, counts]) => ({
    date,
    ...counts,
  }));

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  return res.status(200).json(trend);
});
