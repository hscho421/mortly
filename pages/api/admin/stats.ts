import { kv } from "@vercel/kv";
import prisma from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/withAdmin";

const KV_KEY = "admin:stats:v1";
const TTL_SECONDS = 60;

interface DashboardStats {
  users: number;
  totalBorrowers: number;
  totalBrokers: number;
  pendingVerifications: number;
  verifiedBrokers: number;
  rejectedBrokers: number;
  requestsByStatus: {
    pendingApproval: number;
    open: number;
    inProgress: number;
    closed: number;
    expired: number;
    rejected: number;
    total: number;
  };
  activeRequests: number;
  totalRequests: number;
  activeConversations: number;
  totalConversations: number;
  openReports: number;
  /** Stamp so the UI can show "data is N seconds old" if it cares. */
  computedAt: string;
}

/**
 * Compute the dashboard from scratch — 10 parallel COUNT(*) queries. Expensive
 * at scale (M-S-4 finding), so the result is cached in KV for 60s; multiple
 * admins polling don't all trigger the same scan.
 */
async function computeStats(): Promise<DashboardStats> {
  const [
    users,
    totalBorrowers,
    totalBrokers,
    pendingVerifications,
    verifiedBrokers,
    rejectedBrokers,
    requestStatusGroups,
    openReports,
    activeConversations,
    totalConversations,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "BORROWER" } }),
    prisma.broker.count(),
    prisma.broker.count({ where: { verificationStatus: "PENDING" } }),
    prisma.broker.count({ where: { verificationStatus: "VERIFIED" } }),
    prisma.broker.count({ where: { verificationStatus: "REJECTED" } }),
    prisma.borrowerRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.report.count({ where: { status: "OPEN" } }),
    prisma.conversation.count({ where: { status: "ACTIVE" } }),
    prisma.conversation.count(),
  ]);

  const statusMap: Record<string, number> = {};
  let totalRequests = 0;
  for (const group of requestStatusGroups) {
    statusMap[group.status] = group._count._all;
    totalRequests += group._count._all;
  }

  const requestsByStatus = {
    pendingApproval: statusMap["PENDING_APPROVAL"] || 0,
    open: statusMap["OPEN"] || 0,
    inProgress: statusMap["IN_PROGRESS"] || 0,
    closed: statusMap["CLOSED"] || 0,
    expired: statusMap["EXPIRED"] || 0,
    rejected: statusMap["REJECTED"] || 0,
    total: totalRequests,
  };

  return {
    users,
    totalBorrowers,
    totalBrokers,
    pendingVerifications,
    verifiedBrokers,
    rejectedBrokers,
    requestsByStatus,
    activeRequests: requestsByStatus.open,
    totalRequests,
    activeConversations,
    totalConversations,
    openReports,
    computedAt: new Date().toISOString(),
  };
}

export default withAdmin(async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Try KV first. On a hit we skip 10 parallel COUNTs entirely. On miss
  // (or KV outage) we recompute and re-cache. Cross-instance benefit: 5
  // admins polling against 3 warm lambdas = 1 computation per 60s, not 15.
  let stats: DashboardStats | null = null;
  try {
    stats = await kv.get<DashboardStats>(KV_KEY);
  } catch {
    // Fall through to recompute.
  }

  let cacheStatus: "HIT" | "MISS" | "ERROR" = "HIT";
  if (!stats) {
    try {
      stats = await computeStats();
      cacheStatus = "MISS";
      try {
        await kv.set(KV_KEY, stats, { ex: TTL_SECONDS });
      } catch {
        // Cache write failed; we still serve the fresh value.
      }
    } catch (err) {
      cacheStatus = "ERROR";
      throw err;
    }
  }

  res.setHeader(
    "Cache-Control",
    "private, max-age=30, stale-while-revalidate=60",
  );
  res.setHeader("X-Cache", cacheStatus);
  return res.status(200).json(stats);
});
