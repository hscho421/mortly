import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { generateRequestPublicId } from "@/lib/publicId";
import { getSettingInt } from "@/lib/settings";
import {
  getPremiumAccessConfig,
  nonPremiumVisibilityWhere,
  isExclusiveToPremium,
  premiumWindowEndsAt,
  type PremiumAccessConfig,
} from "@/lib/premiumAccess";
import { validateProductTypes, isValidProvince, isValidTimeline, areValidIncomeTypes } from "@/lib/requestConfig";
import { withAuth } from "@/lib/withAuth";
import { assertOptionalString, assertString, assertOptionalBoundedJson, ValidationError } from "@/lib/validate";

// Sentinel thrown inside the create transaction when the active-request cap
// is hit, so we can roll back and map it to a clean 400 outside the tx.
class ActiveRequestCapError extends Error {
  constructor(public max: number) {
    super("ACTIVE_REQUEST_CAP");
  }
}

export default withAuth(async (req, res, session) => {
  try {
    if (req.method === "GET") {
      const { province, mortgageCategory } = req.query;

      const where: Record<string, unknown> = {};
      let brokerId: string | null = null;
      const now = new Date();
      let premiumConfig: PremiumAccessConfig | null = null;

      if (session.user.role === "BORROWER") {
        where.borrowerId = session.user.id;
      } else if (session.user.role === "BROKER") {
        const broker = await prisma.broker.findUnique({
          where: { userId: session.user.id },
        });
        if (!broker || broker.verificationStatus !== "VERIFIED") {
          return res.status(403).json({ error: "Broker must be verified to view requests" });
        }
        brokerId = broker.id;
        where.status = "OPEN";
        // PREMIUM early-access gate. PREMIUM brokers see every OPEN request,
        // including in-window exclusives; everyone else sees only requests that
        // have released to all (latched, hard-cap-elapsed, or never windowed).
        premiumConfig = await getPremiumAccessConfig();
        if (broker.subscriptionTier !== "PREMIUM") {
          Object.assign(where, nonPremiumVisibilityWhere(premiumConfig, now));
        }
      } else {
        return res.status(403).json({ error: "Forbidden" });
      }

      if (province && typeof province === "string") {
        where.province = province;
      }
      if (mortgageCategory && typeof mortgageCategory === "string") {
        where.mortgageCategory = mortgageCategory;
      }

      // Pagination for broker marketplace view
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const skip = (page - 1) * limit;

      // For brokers: `newCount` = OPEN requests (respecting filters) WITHOUT
      // a BrokerRequestSeen record for this broker. Per-request granularity,
      // so opening one card clears only its dot (not the others).
      const newCountWhere =
        brokerId != null
          ? {
              ...where,
              brokerSeens: { none: { brokerId } },
            }
          : null;

      const [requests, total, newCount] = await Promise.all([
        prisma.borrowerRequest.findMany({
          where,
          include: {
            _count: { select: { conversations: true } },
            // brokerSeens: cheap (composite PK + take:1, indexed). Keeps the
            // "new request" dot indicator efficient. Other relations are
            // intentionally NOT included — the previous take:50 conversations
            // include pulled 1000 rows per page (50 × pageSize 20) just to
            // know whether THIS broker had a conversation with each request.
            ...(brokerId
              ? {
                  brokerSeens: {
                    where: { brokerId },
                    take: 1,
                    select: { seenAt: true },
                  },
                }
              : {}),
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.borrowerRequest.count({ where }),
        newCountWhere
          ? prisma.borrowerRequest.count({
              where: newCountWhere as Prisma.BorrowerRequestWhereInput,
            })
          : Promise.resolve(0),
      ]);

      // Replacement for the dropped nested conversations include: a single
      // scoped query that tells us which of the page's requests already have
      // a conversation involving THIS broker. O(pageSize) rows, indexed by
      // (requestId, brokerId) unique key. Borrower view skips this entirely.
      const myConversationRequestIds = brokerId
        ? new Set(
            (
              await prisma.conversation.findMany({
                where: {
                  brokerId,
                  requestId: { in: requests.map((r) => r.id) },
                },
                select: { requestId: true },
              })
            ).map((c) => c.requestId),
          )
        : null;

      // For brokers, translate the eager-loaded relation into a flat boolean
      // so the frontend doesn't need to know about the join table.
      const enrichedRequests =
        brokerId != null
          ? requests.map((r) => {
              const seens = (r as { brokerSeens?: unknown[] }).brokerSeens ?? [];
              const reqWindow = {
                approvedAt: (r as { approvedAt: Date | null }).approvedAt,
                premiumReleasedAt: (r as { premiumReleasedAt: Date | null }).premiumReleasedAt,
              };
              // Drop the raw window timestamps from the response — the computed
              // isPremiumExclusive + premiumWindowEndsAt below cover every UI
              // need, and exposing approvedAt/premiumReleasedAt would leak the
              // embargo mechanics to brokers. isPremiumExclusive is always false
              // for non-PREMIUM brokers (in-window requests are filtered out).
              const {
                brokerSeens: _omit,
                approvedAt: _omitApprovedAt,
                premiumReleasedAt: _omitReleasedAt,
                ...rest
              } = r as Record<string, unknown>;
              const exclusive =
                premiumConfig != null && isExclusiveToPremium(reqWindow, premiumConfig, now);
              return {
                ...rest,
                isNew: seens.length === 0,
                hasMyConversation: myConversationRequestIds?.has(r.id) ?? false,
                isPremiumExclusive: exclusive,
                premiumWindowEndsAt:
                  exclusive && premiumConfig
                    ? premiumWindowEndsAt(reqWindow, premiumConfig)
                    : null,
              };
            })
          : requests;

      return res.status(200).json({
        data: enrichedRequests,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        ...(brokerId != null ? { newCount } : {}),
      });
    }

    if (req.method === "POST") {
      if (session.user.role !== "BORROWER") {
        return res.status(403).json({ error: "Only borrowers can create requests" });
      }

      const {
        mortgageCategory,
        productTypes,
        province: rawProvince,
        city: rawCity,
        details: rawDetails,
        desiredTimeline: rawTimeline,
        notes: rawNotes,
      } = req.body;

      if (!mortgageCategory || !["RESIDENTIAL", "COMMERCIAL"].includes(mortgageCategory)) {
        return res.status(400).json({ error: "mortgageCategory must be RESIDENTIAL or COMMERCIAL" });
      }

      const province = assertString(rawProvince, "province", { max: 100 });
      // Province must be a real Canadian province/territory — previously the
      // server accepted any free-form string the client never offered.
      if (!isValidProvince(province)) {
        return res.status(400).json({ error: "Invalid province" });
      }
      const city = assertOptionalString(rawCity, "city", { max: 100 });
      const desiredTimeline = assertOptionalString(rawTimeline, "desiredTimeline", { max: 200 });
      // Timeline is optional, but if present must be one of the known options
      // (the client only ever sends these).
      if (desiredTimeline && !isValidTimeline(desiredTimeline)) {
        return res.status(400).json({ error: "Invalid desiredTimeline" });
      }
      const notes = assertOptionalString(rawNotes, "notes", { max: 4000 });
      const details = assertOptionalBoundedJson(rawDetails, "details", 4096);

      if (!Array.isArray(productTypes) || productTypes.length === 0 || productTypes.length > 20) {
        return res.status(400).json({ error: "At least one product type is required" });
      }
      if (!productTypes.every((p: unknown) => typeof p === "string" && p.length <= 100)) {
        return res.status(400).json({ error: "Invalid product type" });
      }

      if (!validateProductTypes(mortgageCategory, productTypes)) {
        return res.status(400).json({ error: "Invalid product type for selected category" });
      }

      // ── Category-specific validation ─────────────────────────
      if (mortgageCategory === "RESIDENTIAL") {
        if (!Array.isArray(details?.purposeOfUse) || details.purposeOfUse.length === 0 ||
            !details.purposeOfUse.every((v: string) => ["OWNER_OCCUPIED", "RENTAL"].includes(v))) {
          return res.status(400).json({ error: "Purpose of use is required for residential requests" });
        }
        // Income types must come from the known set — was previously only
        // checked for non-emptiness, so arbitrary strings passed through.
        if (!areValidIncomeTypes(details?.incomeTypes)) {
          return res.status(400).json({ error: "At least one valid income type is required for residential requests" });
        }
      } else {
        // COMMERCIAL
        if (!details?.businessType) {
          return res.status(400).json({ error: "Business type is required for commercial requests" });
        }
        if (!notes) {
          return res.status(400).json({ error: "Additional details are required for commercial requests" });
        }
      }

      // ── Enforce max active requests ──────────────────────────
      // Count + create run in one Serializable transaction so two near-
      // simultaneous submits (double-click, retries) can't both pass the cap
      // and create N+1 requests — the previous count-then-create had a race
      // window between the two statements.
      const maxRequests = await getSettingInt("max_requests_per_user");
      const publicId = await generateRequestPublicId();

      let request;
      try {
        request = await prisma.$transaction(
          async (tx) => {
            const activeCount = await tx.borrowerRequest.count({
              where: {
                borrowerId: session.user.id,
                status: { in: ["PENDING_APPROVAL", "OPEN", "IN_PROGRESS"] },
              },
            });
            if (activeCount >= maxRequests) {
              throw new ActiveRequestCapError(maxRequests);
            }
            return tx.borrowerRequest.create({
              data: {
                publicId,
                borrowerId: session.user.id,
                mortgageCategory,
                productTypes,
                province,
                city,
                details: (details ?? undefined) as Prisma.InputJsonValue | undefined,
                desiredTimeline,
                notes,
                schemaVersion: 2,
              },
            });
          },
          { isolationLevel: "Serializable" },
        );
      } catch (err) {
        if (err instanceof ActiveRequestCapError) {
          return res.status(400).json({
            error: `You can have at most ${err.max} active requests. Please close or wait for existing requests to expire.`,
            code: "ACTIVE_REQUEST_CAP",
          });
        }
        throw err;
      }

      return res.status(201).json(request);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    // ValidationError travels up to withAuth's catch which maps it to a
    // proper 400. Anything else is genuinely unexpected and gets logged.
    if (error instanceof ValidationError) throw error;
    console.error("Error in /api/requests:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}, { rateLimit: { perMinute: 10, bucket: "requests-create" } });

