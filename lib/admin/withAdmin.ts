import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

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
