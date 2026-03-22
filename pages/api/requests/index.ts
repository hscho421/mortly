import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateRequestPublicId } from "@/lib/publicId";
import { getSettingInt } from "@/lib/settings";
import { validateProductTypes } from "@/lib/requestConfig";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    if (req.method === "GET") {
      const { province, mortgageCategory } = req.query;

      const where: Record<string, unknown> = {};

      if (session.user.role === "BORROWER") {
        where.borrowerId = session.user.id;
      } else if (session.user.role === "BROKER") {
        const broker = await prisma.broker.findUnique({
          where: { userId: session.user.id },
        });
        if (!broker || broker.verificationStatus !== "VERIFIED") {
          return res.status(403).json({ error: "Broker must be verified to view requests" });
        }
        where.status = "OPEN";
      } else {
        return res.status(403).json({ error: "Forbidden" });
      }

      if (province && typeof province === "string") {
        where.province = province;
      }
      if (mortgageCategory && typeof mortgageCategory === "string") {
        where.mortgageCategory = mortgageCategory;
      }

      const requests = await prisma.borrowerRequest.findMany({
        where,
        include: {
          _count: {
            select: { introductions: true },
          },
          introductions: {
            select: {
              brokerId: true,
              broker: { select: { userId: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return res.status(200).json(requests);
    }

    if (req.method === "POST") {
      if (session.user.role !== "BORROWER") {
        return res.status(403).json({ error: "Only borrowers can create requests" });
      }

      const {
        mortgageCategory,
        productTypes,
        province,
        city,
        details,
        desiredTimeline,
        notes,
      } = req.body;

      // ── Validate required fields ─────────────────────────────
      if (!mortgageCategory || !["RESIDENTIAL", "COMMERCIAL"].includes(mortgageCategory)) {
        return res.status(400).json({ error: "mortgageCategory must be RESIDENTIAL or COMMERCIAL" });
      }

      if (!province) {
        return res.status(400).json({ error: "Province is required" });
      }

      if (!Array.isArray(productTypes) || productTypes.length === 0) {
        return res.status(400).json({ error: "At least one product type is required" });
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
        if (!Array.isArray(details?.incomeTypes) || details.incomeTypes.length === 0) {
          return res.status(400).json({ error: "At least one income type is required for residential requests" });
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
      const maxRequests = await getSettingInt("max_requests_per_user") || 10;
      const activeCount = await prisma.borrowerRequest.count({
        where: {
          borrowerId: session.user.id,
          status: { in: ["PENDING_APPROVAL", "OPEN", "IN_PROGRESS"] },
        },
      });
      if (activeCount >= maxRequests) {
        return res.status(400).json({
          error: `You can have at most ${maxRequests} active requests. Please close or wait for existing requests to expire.`,
        });
      }

      const publicId = await generateRequestPublicId();
      const request = await prisma.borrowerRequest.create({
        data: {
          publicId,
          borrowerId: session.user.id,
          mortgageCategory,
          productTypes,
          province,
          city: city || null,
          details: details || undefined,
          desiredTimeline: desiredTimeline || null,
          notes: notes || null,
          schemaVersion: 2,
        },
      });

      return res.status(201).json(request);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error in /api/requests:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
