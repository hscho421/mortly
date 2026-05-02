/**
 * Centralized constants. Pull magic numbers here so they're searchable, named,
 * and changing one place flips behavior everywhere.
 *
 * Group by domain. Document units in the name (`_MS`, `_DAYS`).
 */

// ── Sessions / auth ─────────────────────────────────────────────
/** Mobile-issued JWT lifetime. Web cookies are pinned in `lib/auth.ts`. */
export const MOBILE_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** Email-verification 6-digit code lifetime. */
export const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;

/** Password-reset link lifetime. */
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

/** How long a verify-email session callback DB lookup is cached for. */
export const SESSION_DB_CACHE_TTL_MS = 5_000;

// ── Pagination ──────────────────────────────────────────────────
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MESSAGES_PAGE_SIZE = 50;
export const ADMIN_LIST_PAGE_SIZE = 50;

// ── Rate limits ─────────────────────────────────────────────────
export const SIGNUP_PER_IP_PER_MIN = 5;
export const FORGOT_PASSWORD_PER_IP_PER_MIN = 3;
export const VERIFY_PER_EMAIL_PER_10MIN = 10;
export const VERIFY_PER_IP_PER_HOUR = 30;
export const VERIFY_MAX_ATTEMPTS_PER_CODE = 5;
export const ADMIN_MUTATIONS_PER_MIN = 30;
export const ADMIN_GETS_PER_MIN = 600;
export const USER_MUTATIONS_PER_MIN = 60;
export const MESSAGES_PER_MIN_PER_USER = 30;
export const REPORTS_PER_USER_PER_DAY = 10;

// ── Business rules ──────────────────────────────────────────────
export const MAX_MESSAGE_LENGTH = 5000;
export const MAX_REQUEST_NOTES_LENGTH = 4000;
export const MAX_REQUEST_DETAILS_BYTES = 4096;
export const BROKER_INITIAL_MESSAGE_LIMIT = 3;
export const MAX_ADMIN_BULK_TARGETS = 100;
export const MAX_ADMIN_CREDIT_DELTA = 10_000;

// ── Cron behavior ───────────────────────────────────────────────
export const CONVERSATION_INACTIVE_HOURS = 72;
export const CONVERSATION_UNSTARTED_DAYS = 7;
export const CRON_BATCH_SIZE = 1000;

// ── External-service redirect/timeouts ──────────────────────────
export const FORGOT_PASSWORD_RESPONSE_TARGET_MS = 350;

// ── Settings cache ──────────────────────────────────────────────
export const SETTINGS_CACHE_TTL_MS = 10_000;
