import type { NextApiRequest, NextApiResponse } from "next";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { isAllowedOrigin } from "@/lib/origin";
import { checkRateLimit } from "@/lib/rate-limit";
import { ValidationError } from "@/lib/validate";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const DEFAULT_MUTATIONS_PER_MIN = 60;
const MOBILE_HEADER = "x-mortly-mobile";

export type AuthSession = Session & {
  user: {
    id: string;
    role: "BORROWER" | "BROKER" | "ADMIN";
    email?: string | null;
    name?: string | null;
    publicId?: string;
  };
};

export type AuthHandler = (
  req: NextApiRequest,
  res: NextApiResponse,
  session: AuthSession,
) => Promise<void | NextApiResponse>;

export interface WithAuthOptions {
  /**
   * If set, only sessions with one of these roles may invoke the handler.
   * Defaults to allowing every signed-in role.
   */
  roles?: ReadonlyArray<"BORROWER" | "BROKER" | "ADMIN">;
  /**
   * Per-user, per-minute rate limit applied to mutating methods. Defaults
   * to 60/min. The bucket key is derived from the session.user.id; the
   * `bucket` field below namespaces it (e.g. `"messages"` ⇒ key
   * `messages-<userId>`). Set to `null` to skip the rate limit.
   */
  rateLimit?: { perMinute: number; bucket: string } | null;
  /**
   * Skip the same-origin CSRF gate. Use only for endpoints that intentionally
   * accept cross-origin browser-issued requests (none today).
   */
  skipCsrf?: boolean;
}

/**
 * Authenticated wrapper for any signed-in user. Centralizes:
 *   1. Session presence + role allowlist.
 *   2. CSRF gate on mutating methods (Origin/Referer must match the server
 *      allowlist OR the `x-mortly-mobile` header must be present).
 *   3. Per-user mutation rate limit.
 *   4. ValidationError → 400 mapping for the validate.ts helpers.
 *   5. Generic 500 catch so handlers can throw without per-file try/catch.
 *
 * Use for every non-admin mutating endpoint. Mirrors `withAdmin` so future
 * cross-cutting hardening (audit logging, anomaly detection) can be added in
 * one place.
 */
export function withAuth(handler: AuthHandler, opts: WithAuthOptions = {}) {
  return async function wrapped(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    try {
      const session = (await getServerSession(req, res, authOptions)) as AuthSession | null;
      if (!session?.user?.id) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      if (opts.roles && !opts.roles.includes(session.user.role)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      if (req.method && MUTATING_METHODS.has(req.method) && !opts.skipCsrf) {
        const isMobile = req.headers[MOBILE_HEADER] === "1";
        if (!isMobile && !isAllowedOrigin(req)) {
          res.status(403).json({ error: "Cross-origin request rejected" });
          return;
        }

        const rl = opts.rateLimit;
        if (rl !== null) {
          const limit = rl?.perMinute ?? DEFAULT_MUTATIONS_PER_MIN;
          const bucket = rl?.bucket ?? "mutate";
          const key = `${bucket}-${session.user.id}`;
          const { success, remaining } = await checkRateLimit({
            key,
            limit,
            windowMs: 60_000,
          });
          if (!success) {
            res.setHeader("Retry-After", "60");
            res.status(429).json({ error: "Too many requests — slow down" });
            return;
          }
          res.setHeader("X-RateLimit-Remaining", String(remaining));
        }
      }

      await handler(req, res, session);
    } catch (error) {
      if (error instanceof ValidationError) {
        if (!res.headersSent) res.status(error.status).json({ error: error.message });
        return;
      }
      console.error("Error in", req.url, error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  };
}

export default withAuth;
