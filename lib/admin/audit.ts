import type { NextApiRequest } from "next";
import type { Prisma } from "@prisma/client";

/**
 * Phase 4 audit helpers. Two goals:
 *
 *   1. Every admin mutation records IP + user-agent in the audit log.
 *   2. Free-text fields admins write (reasons, notes) are length-capped
 *      at the API boundary — surviving callers are trusted, but inputs
 *      are never trusted.
 *
 * The `AdminAction.details` column is a JSON-stringified blob, so meta
 * fits alongside the existing per-call details (e.g. `previousStatus`)
 * without a schema migration.
 */

/** Max length for free-text reasons attached to admin mutations. */
export const MAX_REASON_LEN = 500;
/** Max length for admin notes on reports. */
export const MAX_NOTES_LEN = 2000;
/** Max length for bulk/chat close messages written by admins. */
export const MAX_BODY_LEN = 2000;

export interface RequestMeta {
  ip: string;
  userAgent: string;
}

/**
 * Extract IP + user-agent from a Next API request.
 *
 * IP resolution order: `x-forwarded-for` (first entry, Vercel/CDN convention)
 * → `req.socket.remoteAddress` → `"unknown"`.
 * UA is truncated to 200 chars to cap audit-log blob size.
 */
export function getRequestMeta(req: NextApiRequest): RequestMeta {
  const xff = req.headers["x-forwarded-for"];
  let ip: string | undefined;
  if (typeof xff === "string") {
    ip = xff.split(",")[0]?.trim();
  } else if (Array.isArray(xff)) {
    ip = xff[0]?.split(",")[0]?.trim();
  }
  if (!ip) {
    // Node/Next expose socket.remoteAddress in edge cases.
    ip = (req.socket as { remoteAddress?: string } | undefined)?.remoteAddress ?? undefined;
  }
  const ua = req.headers["user-agent"];
  const userAgent = typeof ua === "string" ? ua.slice(0, 200) : "unknown";
  return { ip: ip || "unknown", userAgent };
}

/**
 * Build a `prisma.adminAction.create` args object that folds request meta
 * (IP + UA) into the JSON-stringified `details` blob. Usable directly inside
 * `prisma.$transaction([...])` calls.
 *
 *   prisma.$transaction([
 *     prisma.user.update(...),
 *     prisma.adminAction.create(buildAdminActionCreate(req, session, {
 *       action: "SUSPEND_USER",
 *       targetType: "USER",
 *       targetId: user.publicId,
 *       details: { previousStatus, newStatus },
 *     })),
 *   ]);
 *
 * The resulting `details` string shape is:
 *   { ...callerDetails, requestIp, userAgent }
 */
export function buildAdminActionCreate(
  req: NextApiRequest,
  session: { user: { id: string } },
  params: {
    action: string;
    targetType: string;
    targetId: string;
    details?: Record<string, unknown>;
    reason?: string | null;
  },
): Prisma.AdminActionCreateArgs {
  const meta = getRequestMeta(req);
  return {
    data: {
      adminId: session.user.id,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      details: JSON.stringify({
        ...(params.details ?? {}),
        requestIp: meta.ip,
        userAgent: meta.userAgent,
      }),
      reason: params.reason ?? null,
    },
  };
}

/**
 * Validate a free-text field that may be `null` / `undefined` / a string.
 *
 * Returns the trimmed string on success, `null` if absent, or
 * `{ error }` on invalid input. Callers branch on the discriminant:
 *
 *   const v = validateText(req.body.reason, MAX_REASON_LEN, "reason");
 *   if (v && typeof v === "object") {
 *     return res.status(400).json({ error: v.error });
 *   }
 *   // v is string | null from here on
 */
export function validateText(
  value: unknown,
  max: number,
  field: string,
): string | null | { error: string } {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return { error: `${field} must be a string` };
  if (value.length > max) return { error: `${field} too long (max ${max})` };
  return value;
}
