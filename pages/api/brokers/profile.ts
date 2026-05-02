import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import {
  assertString,
  assertOptionalString,
  assertOptionalInt,
  assertOptionalEnum,
  assertPhone,
  assertOptionalPhone,
  assertOptionalHttpsUrl,
} from "@/lib/validate";

const MORTGAGE_CATEGORIES = ["RESIDENTIAL", "COMMERCIAL", "BOTH"] as const;
const LICENSE_RE = /^[A-Z0-9-]{1,50}$/i;

/**
 * Validate the subset of fields the broker can write (server-side authority
 * over every field — the client copy is for UX only). Throws ValidationError
 * on failure; withAuth maps that to 400.
 */
function validateBrokerFields(body: Record<string, unknown>, partial: boolean) {
  const out: Record<string, unknown> = {};

  if (body.brokerageName !== undefined) {
    out.brokerageName = assertString(body.brokerageName, "brokerageName", { max: 200 });
  } else if (!partial) {
    out.brokerageName = assertString(undefined, "brokerageName", { max: 200 });
  }

  if (body.province !== undefined) {
    out.province = assertString(body.province, "province", { max: 100 });
  } else if (!partial) {
    out.province = assertString(undefined, "province", { max: 100 });
  }

  if (body.phone !== undefined) {
    out.phone = partial
      ? assertOptionalPhone(body.phone, "phone")
      : assertPhone(body.phone, "phone");
  } else if (!partial) {
    out.phone = assertPhone(undefined, "phone");
  }

  if (body.licenseNumber !== undefined) {
    const license = assertOptionalString(body.licenseNumber, "licenseNumber", { max: 50 });
    if (license && !LICENSE_RE.test(license)) {
      throw new Error("licenseNumber must be alphanumeric with optional dashes");
    }
    out.licenseNumber = license ?? undefined;
  }

  if (body.bio !== undefined) {
    out.bio = assertOptionalString(body.bio, "bio", { max: 2000 });
  }
  if (body.areasServed !== undefined) {
    out.areasServed = assertOptionalString(body.areasServed, "areasServed", { max: 1000 });
  }
  if (body.specialties !== undefined) {
    out.specialties = assertOptionalString(body.specialties, "specialties", { max: 1000 });
  }
  if (body.yearsExperience !== undefined) {
    out.yearsExperience = assertOptionalInt(body.yearsExperience, "yearsExperience", { min: 0, max: 100 });
  }
  if (body.profilePhoto !== undefined) {
    // Reject `javascript:`, `data:`, `http:` — only `https://` URLs allowed.
    out.profilePhoto = assertOptionalHttpsUrl(body.profilePhoto, "profilePhoto");
  }
  if (body.mortgageCategory !== undefined) {
    out.mortgageCategory = assertOptionalEnum(
      body.mortgageCategory,
      "mortgageCategory",
      MORTGAGE_CATEGORIES,
    );
  }

  return out;
}

export default withAuth(async (req, res, session) => {
  if (req.method === "GET") {
    const broker = await prisma.broker.findUnique({
      where: { userId: session.user.id },
      include: {
        user: {
          select: { id: true, publicId: true, name: true, email: true },
        },
        subscription: true,
      },
    });

    if (!broker) {
      return res.status(404).json({ error: "Broker profile not found" });
    }

    return res.status(200).json(broker);
  }

  if (req.method === "POST") {
    if (session.user.role !== "BROKER") {
      return res.status(403).json({ error: "Only broker users can create a broker profile" });
    }

    const existing = await prisma.broker.findUnique({
      where: { userId: session.user.id },
    });

    if (existing) {
      return res.status(409).json({ error: "Broker profile already exists" });
    }

    const data = validateBrokerFields(req.body ?? {}, false);
    data.userId = session.user.id;

    const broker = await prisma.broker.create({
      data: data as Parameters<typeof prisma.broker.create>[0]["data"],
    });

    return res.status(201).json(broker);
  }

  if (req.method === "PUT") {
    const broker = await prisma.broker.findUnique({
      where: { userId: session.user.id },
    });

    if (!broker) {
      return res.status(404).json({ error: "Broker profile not found" });
    }

    const data = validateBrokerFields(req.body ?? {}, true);

    const updated = await prisma.broker.update({
      where: { userId: session.user.id },
      data,
    });

    return res.status(200).json(updated);
  }

  return res.status(405).json({ error: "Method not allowed" });
});
