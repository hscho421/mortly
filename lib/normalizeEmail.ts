/**
 * Re-export shim. The implementation moved to `@mortly/core` (shared with the
 * mobile app); this keeps the web's existing `@/lib/normalizeEmail` imports
 * working. New code may import from `@mortly/core` directly.
 */
export { normalizeEmail, isValidEmail } from "@mortly/core";
