import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const MUTATIONS_PER_MIN = 30;

/**
 * CSRF gate. For mutating methods we require an `Origin` (or `Referer`)
 * header whose host matches the request host. This blocks cross-origin
 * browser-issued POST/PUT/PATCH/DELETE — the CSRF threat — while permitting
 * same-origin fetches made by the admin UI.
 *
 * Same-host comparison covers sub-path and port differences correctly
 * because `URL(...).host` includes the port. Tooling without an `Origin`
 * header (curl, some CI scripts) is rejected; tooling that sends an
 * explicit `Origin: https://<host>` is allowed.
 */
function sameOriginOk(req: NextApiRequest): boolean {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.headers.host;
  if (!host) return false;
  const source = typeof origin === "string" && origin.length > 0 ? origin : typeof referer === "string" ? referer : "";
  if (!source) return false;
  try {
    return new URL(source).host === host;
  } catch {
    return false;
  }
}

/**
 * Session shape as seen by an admin route handler.
 *
 * Narrowed to `role: "ADMIN"` because `withAdmin` only invokes the handler
 * once that check has passed. The `user` fields mirror the shape populated by
 * the next-auth session callback in `@/lib/auth`.
 */
export type AdminSession = Awaited<ReturnType<typeof getServerSession>> & {
  user: {
    id: string;
    role: "ADMIN";
    email?: string | null;
    name?: string | null;
    publicId?: string;
  };
};

export type AdminHandler = (
  req: NextApiRequest,
  res: NextApiResponse,
  session: AdminSession
) => Promise<void | NextApiResponse>;

/**
 * Higher-order wrapper for admin-only Next.js API routes.
 *
 * Responsibilities:
 *   1. Loads the next-auth session.
 *   2. Returns 401 `{error: "Unauthorized"}` when no session.
 *   3. Returns 403 `{error: "Admin access required"}` when the user isn't an admin.
 *   4. Calls `handler(req, res, session)` — the session is passed so the
 *      handler doesn't have to re-fetch it.
 *   5. Wraps the handler in try/catch. On a thrown error it logs
 *      `"Error in" <req.url> <error>` and returns a generic 500
 *      `{error: "Internal server error"}`. This replaces the per-file
 *      try/catch already duplicated across `pages/api/admin/**`.
 *
 * Usage:
 * ```ts
 * export default withAdmin(async (req, res, session) => {
 *   // session.user.role is narrowed to "ADMIN" here
 *   ...
 * });
 * ```
 */
export function withAdmin(
  handler: AdminHandler
): (req: NextApiRequest, res: NextApiResponse) => Promise<void> {
  return async function wrapped(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    try {
      const session = await getServerSession(req, res, authOptions);

      if (!session) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      // next-auth's session.user type is loose; the project augments it with
      // `role` via the session callback in @/lib/auth. Read it without forcing
      // a broad `any`.
      const role = (session.user as { role?: string } | undefined)?.role;
      if (role !== "ADMIN") {
        res.status(403).json({ error: "Admin access required" });
        return;
      }

      // CSRF + rate limit on destructive verbs. GET is unrestricted
      // (read-heavy admin UIs poll frequently).
      if (req.method && MUTATING_METHODS.has(req.method)) {
        if (!sameOriginOk(req)) {
          res.status(403).json({ error: "Cross-origin request rejected" });
          return;
        }

        const adminId = (session.user as { id?: string } | undefined)?.id ?? "unknown";
        const { success, remaining } = await checkRateLimit({
          key: `admin-mutate-${adminId}`,
          limit: MUTATIONS_PER_MIN,
          windowMs: 60_000,
        });
        if (!success) {
          res.setHeader("Retry-After", "60");
          res.status(429).json({
            error: "Too many admin actions — slow down or contact another admin.",
          });
          return;
        }
        res.setHeader("X-RateLimit-Remaining", String(remaining));
      }

      await handler(req, res, session as AdminSession);
    } catch (error) {
      console.error("Error in", req.url, error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  };
}

export default withAdmin;
