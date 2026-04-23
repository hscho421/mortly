import { hash } from "bcryptjs";
import prisma from "@/lib/prisma";
import { generatePublicId } from "@/lib/publicId";
import { withAdmin } from "@/lib/admin/withAdmin";
import { buildAdminActionCreate } from "@/lib/admin/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { notifyAdminsOfNewAdmin } from "@/lib/email";

/**
 * POST /api/admin/users/create
 *
 * Creates a new ADMIN user. Highest blast-radius action in the system:
 *   - Typed acknowledgment ("ack: 'CREATE_ADMIN'") required in body.
 *   - Per-admin 10/min rate limit on top of the generic 30/min mutation cap.
 *   - Email must be unique; password ≥ 12 chars (up from 8).
 *   - Audit log includes requesting admin's IP + user-agent via
 *     `buildAdminActionCreate`.
 */

const MIN_ADMIN_PASSWORD = 12;
const CREATE_PER_MIN = 10;

export default withAdmin(async (req, res, session) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Tighter per-admin creation cap, layered on top of the generic mutation
  // limiter that withAdmin applies. Durable (KV) so per-lambda counters can't
  // be sidestepped by load balancing.
  const { success } = await checkRateLimit({
    key: `create-admin-${session.user.id}`,
    limit: CREATE_PER_MIN,
    windowMs: 60_000,
  });
  if (!success) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({
      error: "Admin creation rate limit exceeded.",
    });
  }

  const { name, email, password, ack } = (req.body ?? {}) as {
    name?: unknown;
    email?: unknown;
    password?: unknown;
    ack?: unknown;
  };

  if (ack !== "CREATE_ADMIN") {
    return res
      .status(400)
      .json({ error: "Typed acknowledgment required (ack: 'CREATE_ADMIN')." });
  }

  if (typeof name !== "string" || name.trim().length === 0 || name.length > 200) {
    return res.status(400).json({ error: "name must be a non-empty string (≤200)" });
  }
  if (typeof email !== "string" || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "email must be a valid address (≤320)" });
  }
  if (typeof password !== "string" || password.length < MIN_ADMIN_PASSWORD) {
    return res.status(400).json({
      error: `Password must be at least ${MIN_ADMIN_PASSWORD} characters`,
    });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  const passwordHash = await hash(password, 12);
  const publicId = await generatePublicId();

  const [user] = await prisma.$transaction([
    prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "ADMIN",
        publicId,
        emailVerified: true,
      },
      select: {
        id: true,
        publicId: true,
        name: true,
        email: true,
        role: true,
      },
    }),
    prisma.adminAction.create(
      buildAdminActionCreate(req, session, {
        action: "CREATE_ADMIN",
        targetType: "USER",
        targetId: publicId,
        details: { email, name },
      }),
    ),
  ]);

  // Multi-admin visibility: every existing admin receives an email announcing
  // the new admin so an unauthorized mint lights up multiple inboxes rather
  // than sitting silent in the audit log.
  try {
    const peers = await prisma.user.findMany({
      where: { role: "ADMIN", id: { not: session.user.id } },
      select: { email: true },
    });
    await notifyAdminsOfNewAdmin({
      recipients: peers.map((p) => p.email),
      newAdmin: { name, email, publicId },
      createdBy: {
        id: session.user.id,
        name: session.user.name ?? null,
        email: session.user.email ?? "unknown",
      },
    });
  } catch (err) {
    // Broadcast failure must not block the create — it's a notification.
    // eslint-disable-next-line no-console
    console.error("[users/create] admin-created broadcast failed:", err);
  }

  return res.status(201).json(user);
});
