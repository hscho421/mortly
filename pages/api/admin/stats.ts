import prisma from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/withAdmin";

export default withAdmin(async (req, res) => {
  if (req.method === "GET") {
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
      pendingApprovalList,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "BORROWER" } }),
      prisma.broker.count(),
      prisma.broker.count({ where: { verificationStatus: "PENDING" } }),
      prisma.broker.count({ where: { verificationStatus: "VERIFIED" } }),
      prisma.broker.count({ where: { verificationStatus: "REJECTED" } }),
      prisma.borrowerRequest.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.report.count({ where: { status: "OPEN" } }),
      prisma.conversation.count({ where: { status: "ACTIVE" } }),
      prisma.conversation.count(),
      prisma.borrowerRequest.findMany({
        where: { status: "PENDING_APPROVAL" },
        include: {
          borrower: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    // Build request counts by status from groupBy result
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

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    return res.status(200).json({
      // Users
      users,
      totalBorrowers,
      totalBrokers,
      // Broker verification
      pendingVerifications,
      verifiedBrokers,
      rejectedBrokers,
      // Request pipeline
      requestsByStatus,
      // Backward compat
      activeRequests: requestsByStatus.open,
      totalRequests,
      // Conversations & activity
      activeConversations,
      totalConversations,
      openReports,
      // Pending approval queue
      pendingApprovalList,
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
});
