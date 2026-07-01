/**
 * Single source of truth for email normalization.
 *
 * Postgres `users.email` has a functional unique index on `LOWER(email)` so we
 * MUST canonicalize on every read and write. Mixed-case duplicates would
 * otherwise diverge between credentials signup (case-preserving) and OAuth
 * signin (case-folded by `mobile-oauth.ts`).
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Loose RFC-style email check used by signup / admin user create. Intentionally
 * permissive — full RFC 5322 validation is impractical and we rely on a
 * verification round-trip to prove inbox ownership.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && email.length <= 320 && EMAIL_RE.test(email);
}
