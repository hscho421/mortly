interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const limiters = new Map<string, Map<string, RateLimitEntry>>();

interface RateLimitConfig {
  interval: number;
  uniqueTokenPerInterval: number;
}

function rateLimit(config: RateLimitConfig) {
  const id = `${config.interval}-${config.uniqueTokenPerInterval}`;
  if (!limiters.has(id)) {
    limiters.set(id, new Map());
  }
  const tokenCache = limiters.get(id)!;

  return {
    check(limit: number, token: string): { success: boolean; remaining: number } {
      const now = Date.now();
      const entry = tokenCache.get(token);

      if (!entry || now > entry.resetAt) {
        if (tokenCache.size >= config.uniqueTokenPerInterval) {
          const oldest = tokenCache.keys().next().value;
          if (oldest) tokenCache.delete(oldest);
        }
        tokenCache.set(token, { count: 1, resetAt: now + config.interval });
        return { success: true, remaining: limit - 1 };
      }

      entry.count++;
      if (entry.count > limit) {
        return { success: false, remaining: 0 };
      }
      return { success: true, remaining: limit - entry.count };
    },
  };
}

export const authLimiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500,
});

export const verifyCodeLimiter = rateLimit({
  interval: 10 * 60 * 1000,
  uniqueTokenPerInterval: 500,
});

/**
 * Admin mutation limiter — caps destructive admin actions (status flips, credit
 * adjusts, broker verification toggles) at a sane rate per admin to contain
 * blast radius if an admin token leaks or an admin accidentally runs a loop.
 *
 * 30 mutations / minute / admin. Interactive admins will never hit this;
 * automation abuse will.
 */
export const adminMutationLimiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500,
});

export function getClientIp(req: { headers: Record<string, string | string[] | undefined> }): string {
  const xff = req.headers["x-forwarded-for"];
  const ip = typeof xff === "string" ? xff.split(",")[0]?.trim() : undefined;
  return ip || "unknown";
}