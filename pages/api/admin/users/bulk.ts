import prisma from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/withAdmin";
import { buildAdminActionCreate, MAX_REASON_LEN, validateText } from "@/lib/admin/audit";

/**
 * POST /api/admin/users/bulk
 *
 * Bulk status change for users. Replaces the per-row `PUT /api/admin/users/[id]`
 * fan-out the People page used to do for bulk suspend/ban/reactivate — which
 * hit the admin mutation rate-limiter at ~30 selected users.
 *
 * Body:
 *   { ids: string[], status: "ACTIVE" | "SUSPENDED" | "BANNED", reason?: string }
 *
 * Response:
 *   {
 *     results: Array<{ id: string; ok: boolean; error?: string }>,
 *     summary: { total: number; succeeded: number; failed: number }
 *   }
 *
 * Behavior:
 *   - Per-row validation: admin accounts can't be suspended/banned; self can't change.
 *   - Each row is its own transaction so one bad row doesn't abort the others.
 *   - Each successful row creates its own `AdminAction` audit entry with
 *     `details.bulk = true` so the audit log can distinguish bulk ops.
 */

const MAX_BULK = 100;
const VALID_STATUSES = ["ACTIVE", "SUSPENDED", "BANNED"] as const;
type ValidStatus = (typeof VALID_STATUSES)[number];

const ACTION_MAP: Record<ValidStatus, string> = {
  SUSPENDED: "SUSPEND_USER",
  BANNED: "BAN_USER",
  ACTIVE: "REACTIVATE_USER",
};

export default withAdmin(async (req, res, session) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { ids, status, reason } = (req.body ?? {}) as {
    ids?: unknown;
    status?: unknown;
    reason?: unknown;
  };

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "ids must be a non-empty array" });
  }
  if (ids.length > MAX_BULK) {
    return res.status(400).json({ error: `Too many ids (max ${MAX_BULK})` });
  }
  if (!ids.every((i): i is string => typeof i === "string" && i.length > 0)) {
    return res.status(400).json({ error: "ids must be non-empty strings" });
  }

  if (typeof status !== "string" || !VALID_STATUSES.includes(status as ValidStatus)) {
    return res.status(400).json({
      error: `status must be one of: ${VALID_STATUSES.join(", ")}`,
    });
  }

  const typedStatus = status as ValidStatus;
  const reasonValidated = validateText(reason, MAX_REASON_LEN, "reason");
  if (reasonValidated && typeof reasonValidated === "object") {
    return res.status(400).json({ error: reasonValidated.error });
  }
  const typedReason = reasonValidated;

  // Load all targets in one query. Missing ids fall through to per-row "Not found".
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, publicId: true, role: true, status: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const id of ids) {
    const user = byId.get(id);
    if (!user) {
      results.push({ id, ok: false, error: "Not found" });
      continue;
    }
    if (user.role === "ADMIN" && typedStatus !== "ACTIVE") {
      results.push({ id, ok: false, error: "Cannot suspend or ban admin accounts" });
      continue;
    }
    if (user.id === session.user.id) {
      results.push({ id, ok: false, error: "Cannot change your own account status" });
      continue;
    }
    if (user.status === typedStatus) {
      // No-op: skip DB write and audit log noise.
      results.push({ id, ok: true });
      continue;
    }

    try {
      await prisma.$transaction([
        prisma.user.update({
          where: { id },
          data: { status: typedStatus },
        }),
        prisma.adminAction.create(
          buildAdminActionCreate(req, session, {
            action: ACTION_MAP[typedStatus],
            targetType: "USER",
            targetId: user.publicId,
            details: {
              previousStatus: user.status,
              newStatus: typedStatus,
              bulk: true,
            },
            reason: typedReason,
          }),
        ),
      ]);
      results.push({ id, ok: true });
    } catch (err) {
      results.push({
        id,
        ok: false,
        error: err instanceof Error ? err.message : "Update failed",
      });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.length - succeeded;

  return res.status(200).json({
    results,
    summary: { total: ids.length, succeeded, failed },
  });
});
