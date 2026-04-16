import { ReportStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/withAdmin";

/**
 * GET /api/admin/queue
 *
 * Unified moderation queue — combines pending broker verifications,
 * open/in-review reports, and pending-approval borrower requests into
 * a single response so the admin dashboard (web + mobile) can render
 * the full moderation surface in one round-trip.
 *
 * Contract is STABLE — the mobile client (lib/api.ts :: adminGetQueue)
 * depends on the exact field names below.
 */
export default withAdmin(async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const brokerWhere = { verificationStatus: "PENDING" } as const;
  // Schema note: Prisma ReportStatus enum is { OPEN, REVIEWED, RESOLVED, DISMISSED }.
  // The spec asked for { PENDING, REVIEWING } — we map to the real non-terminal
  // statuses (OPEN = new, REVIEWED = actively under review) so the queue shows
  // everything not yet RESOLVED / DISMISSED.
  const reportWhere = {
    status: { in: [ReportStatus.OPEN, ReportStatus.REVIEWED] },
  };
  const requestWhere = { status: "PENDING_APPROVAL" } as const;

  const [
    rawBrokers,
    rawReports,
    rawRequests,
    brokersCount,
    reportsCount,
    requestsCount,
  ] = await Promise.all([
    prisma.broker.findMany({
      where: brokerWhere,
      include: {
        user: { select: { name: true, email: true, publicId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.report.findMany({
      where: reportWhere,
      include: {
        reporter: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.borrowerRequest.findMany({
      where: requestWhere,
      include: {
        borrower: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.broker.count({ where: brokerWhere }),
    prisma.report.count({ where: reportWhere }),
    prisma.borrowerRequest.count({ where: requestWhere }),
  ]);

  // Batch-resolve CUID targetIds to publicIds (mirrors the pattern in
  // pages/api/admin/reports/index.ts so web and mobile show consistent IDs).
  const cuidReports = rawReports.filter(
    (r: { targetId: string }) => !/^\d{9}$/.test(r.targetId),
  );
  const idsByType: Record<string, string[]> = {};
  for (const r of cuidReports) {
    (idsByType[r.targetType] ??= []).push(r.targetId);
  }

  const publicIdMap = new Map<string, string>();
  const batchQueries: Promise<void>[] = [];

  if (idsByType["BROKER"]?.length) {
    batchQueries.push(
      prisma.broker
        .findMany({
          where: { id: { in: idsByType["BROKER"] } },
          include: { user: { select: { publicId: true } } },
        })
        .then((brokers: { id: string; user: { publicId: string } }[]) => {
          for (const b of brokers) publicIdMap.set(b.id, b.user.publicId);
        }),
      prisma.user
        .findMany({
          where: { id: { in: idsByType["BROKER"] } },
          select: { id: true, publicId: true },
        })
        .then((users: { id: string; publicId: string }[]) => {
          for (const u of users) {
            if (!publicIdMap.has(u.id)) publicIdMap.set(u.id, u.publicId);
          }
        }),
    );
  }
  if (idsByType["USER"]?.length) {
    batchQueries.push(
      prisma.user
        .findMany({
          where: { id: { in: idsByType["USER"] } },
          select: { id: true, publicId: true },
        })
        .then((users: { id: string; publicId: string }[]) => {
          for (const u of users) publicIdMap.set(u.id, u.publicId);
        }),
    );
  }
  if (idsByType["REQUEST"]?.length) {
    batchQueries.push(
      prisma.borrowerRequest
        .findMany({
          where: { id: { in: idsByType["REQUEST"] } },
          select: { id: true, publicId: true },
        })
        .then((reqs: { id: string; publicId: string }[]) => {
          for (const r of reqs) publicIdMap.set(r.id, r.publicId);
        }),
    );
  }
  if (idsByType["CONVERSATION"]?.length) {
    batchQueries.push(
      prisma.conversation
        .findMany({
          where: { id: { in: idsByType["CONVERSATION"] } },
          select: { id: true, publicId: true },
        })
        .then((convos: { id: string; publicId: string }[]) => {
          for (const c of convos) publicIdMap.set(c.id, c.publicId);
        }),
    );
  }

  await Promise.all(batchQueries);

  type BrokerRow = typeof rawBrokers[number];
  type ReportRow = typeof rawReports[number];
  type RequestRow = typeof rawRequests[number];

  const pendingBrokers = rawBrokers.map((b: BrokerRow) => ({
    id: b.id,
    // Broker has no publicId column — surface the owning user's publicId,
    // matching how pages/api/admin/brokers exposes brokers to the client.
    publicId: b.user.publicId,
    brokerageName: b.brokerageName ?? null,
    licenseNumber: b.licenseNumber ?? null,
    province: b.province ?? null,
    createdAt: b.createdAt.toISOString(),
    user: { name: b.user.name ?? null, email: b.user.email },
  }));

  const openReports = rawReports.map((r: ReportRow) => {
    const resolvedTargetId = /^\d{9}$/.test(r.targetId)
      ? r.targetId
      : publicIdMap.get(r.targetId) ?? r.targetId;
    return {
      id: r.id,
      // Report has no publicId column — fall back to id for the stable
      // contract field so mobile can always render something.
      publicId: r.id,
      reason: r.reason,
      targetType: r.targetType,
      targetId: resolvedTargetId,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      reporter: r.reporter
        ? { name: r.reporter.name ?? null, email: r.reporter.email }
        : null,
    };
  });

  const pendingRequests = rawRequests.map((rq: RequestRow) => ({
    id: rq.id,
    publicId: rq.publicId,
    mortgageCategory: rq.mortgageCategory,
    productTypes: rq.productTypes,
    province: rq.province,
    city: rq.city ?? null,
    createdAt: rq.createdAt.toISOString(),
    borrower: { name: rq.borrower.name ?? null, email: rq.borrower.email },
  }));

  res.setHeader(
    "Cache-Control",
    "private, max-age=5, stale-while-revalidate=15",
  );

  return res.status(200).json({
    pendingBrokers,
    openReports,
    pendingRequests,
    counts: {
      pendingBrokers: brokersCount,
      openReports: reportsCount,
      pendingRequests: requestsCount,
      total: brokersCount + reportsCount + requestsCount,
    },
  });
});
