# Mortly — Zero Trust Production Security Audit
**Date:** 2026-05-01
**Branch:** main @ 569bd8a
**Auditor:** Claude (zero-trust pass)
**Status:** ALL FIXES IMPLEMENTED 2026-05-01 (507 tests passing)

Severity scale: Critical = launch-blocker, High = ship within sprint, Medium = post-launch with monitoring, Low = backlog.

---

## 🚨 PRODUCTION LAUNCH BLOCKERS (CRITICAL)

### [x] C-1. Privilege escalation via `/api/auth/select-role`
- **File:** `pages/api/auth/select-role.ts:56-71`
- Idempotent and unconditional role overwrite. No check on `needsRoleSelection`, no check on current role.
- **Exploit:** Any BORROWER → BROKER. Any ADMIN tricked into call → loses admin powers.
- **Fix:** Reject if `user.role === "ADMIN"`. Reject if `prefs.needsRoleSelection !== true`.

### [x] C-2. No password-change session invalidation — JWT cannot be revoked
- **File:** `lib/auth.ts:191-193`, `pages/api/borrowers/profile.ts:64-88`
- 30-day JWT, no DB session, no `tokenVersion`, no DB re-validation in `session` callback.
- **Exploit:** Stolen JWT survives password change, ban, suspend.
- **Fix:** Add `User.tokenVersion: Int @default(0)`. Embed in JWT. Re-check vs DB in `jwt`/`session` callbacks. Bump on password change, ban, suspend, "logout everywhere". Re-check `status === ACTIVE` per request.

### [x] C-3. Open redirect via `Origin` header in Stripe Checkout/Portal
- **Files:** `pages/api/stripe/create-checkout.ts:97-109`, `pages/api/stripe/create-portal.ts:31-36`
- `req.headers.origin` is client-controlled and used in `success_url`/`cancel_url`/`return_url`.
- **Exploit:** Phishing landing after real Stripe checkout.
- **Fix:** Pin to `process.env.NEXTAUTH_URL` or validate Origin against a server allowlist.

### [x] C-4. Email-verification 6-digit code brute-forceable
- **Files:** `pages/api/auth/verify-email.ts:30-33`, `lib/rate-limit.ts:8-43`
- Rate limit is per-lambda in-memory; many warm instances multiply attempts.
- **Fix:** Use durable `checkRateLimit`. Per-email + per-IP. Lock code after 5 failures. Track `verificationAttempts` on User. Consider 8-digit codes.

### [x] C-5. Email case not normalized — duplicate-account / OAuth-link confusion
- **Files:** `pages/api/auth/signup.ts:55-76`, `lib/auth.ts:37`, `pages/api/auth/forgot-password.ts:28`, `pages/api/auth/verify-email.ts:35`, `pages/api/auth/resend-code.ts:30`
- `mobile-oauth.ts` lowercases; nothing else does.
- **Exploit:** Email squatting; orphan accounts; OAuth attaches to wrong row.
- **Fix:** `normalizeEmail()` helper used everywhere. Functional unique index `LOWER(email)` in Postgres.

### [x] C-6. Borrower can mutate request after brokers spent credits
- **File:** `pages/api/requests/[id].ts:145-194`
- PATCH allows full edit (category, products, province, details) while OPEN.
- **Fix:** If `_count.conversations > 0`, restrict edit to `notes`/`desiredTimeline` only. Material edits require closing + reopening.

### [x] C-7. Borrower DELETE wipes paid broker conversations
- **File:** `pages/api/requests/[id].ts:196-235`
- Cascade hard-delete with no broker notification, no credit refund.
- **Fix:** Block hard delete if any conversation exists. Soft-delete via status. If hard delete needed, refund credits + notify in same transaction.

### [x] C-8. Stripe webhook missing `event.id` deduplication
- **File:** `pages/api/webhooks/stripe.ts:71-97`
- No replay ledger. `handleSubscriptionUpdated` lacks idempotency on credit grant.
- **Fix:** Add `model ProcessedStripeEvent { eventId String @id; type String; createdAt DateTime @default(now()) }`. Insert at top of handler before processing. Make every handler idempotent on `(stripeSubId, period.start, tier)`.

### [x] C-9. CRON endpoints accept GET, weak header gate
- **Files:** `pages/api/cron/auto-close-conversations.ts:33-39`, `pages/api/cron/expire-requests.ts:22-28`
- **Fix:** POST-only. Verify Vercel cron signature header. Log invocations to `AdminAction`.

### [x] C-10. Zero security headers configured
- **File:** `next.config.mjs`
- No CSP / HSTS / frame-ancestors / X-Content-Type-Options / Referrer-Policy / Permissions-Policy.
- **Fix:** Add `headers()` block in next.config.mjs (full CSP including stripe.com + posthog).

---

## 🔴 HIGH PRIORITY

### [x] H-1. CSRF gate only on admin endpoints, missing on user mutations
- All non-admin mutating endpoints: select-role, signup, forgot/reset/verify-email, borrowers/profile, brokers/profile, conversations, messages, requests, reports, users/[publicId]/block, users/me, stripe/*, notifications/register-device, preferences, notices.
- **Fix:** Lift `sameOriginOk` from `withAdmin` into a global mutating-method guard.

### [x] H-2. Broker profile fields lack validation (length, URL, enum)
- **File:** `pages/api/brokers/profile.ts:34-117`
- Unbounded `bio`, `specialties`, `licenseNumber`. `profilePhoto` accepts any string. `mortgageCategory` accepts any string. No phone E.164 validation.
- **Fix:** Centralize with zod. Caps: brokerageName ≤ 200, bio ≤ 2000, specialties ≤ 1000, licenseNumber ≤ 50 with `^[A-Z0-9-]+$`, profilePhoto requires `https://` URL parse.

### [x] H-3. Borrower request `details` JSON unbounded
- **File:** `pages/api/requests/index.ts:154-199`
- **Fix:** `if (JSON.stringify(details).length > 4096) return 400`.

### [x] H-4. Free-text fields (name, notes, bio) lack length caps
- Multiple files: `signup.ts`, `requests/index.ts`, `brokers/profile.ts`.
- **Fix:** Shared `assertString(value, {min,max})` helper. Reject at boundary.

### [x] H-5. Admin "[Admin] closed" message uses regular Message row — system spoofing
- **Files:** `pages/api/admin/conversations/[id].ts:103-130`, `pages/api/admin/requests/[id].ts:104-115`
- Users can write `"[Admin] ..."` themselves, identical UI.
- **Fix:** Add `Message.isSystem Boolean @default(false)`. Render system marker from this column. Reject user bodies starting with `[Admin]`/`[System]`.

### [x] H-6. Conversation creation race — verify Serializable isolation
- **File:** `pages/api/conversations/index.ts:256-294`
- **Fix:** Add `prisma.$transaction(..., { isolationLevel: 'Serializable' })`. Add concurrency test.

### [x] H-7. Stripe webhook reads stale settings cache
- **Files:** `pages/api/webhooks/stripe.ts:115-161`, `lib/settings.ts`
- 5-min per-lambda cache on `getSettingInt`.
- **Fix:** Drop TTL to 10s, or use a `settings_version` key checked per call.

### [x] H-8. `sameOriginOk` matches host without scheme; no allowlist
- **File:** `lib/admin/withAdmin.ts:20-32`
- **Fix:** Pin to `https://` and allowlist via env `ADMIN_ALLOWED_ORIGINS`.

### [x] H-9. JWT returned in response body of select-role / users/me PATCH / mobile-oauth
- **Files:** `pages/api/auth/select-role.ts:78-99`, `pages/api/users/me.ts:194-219`, `pages/api/auth/mobile-oauth.ts:185-200`
- XSS exfil bypasses HttpOnly cookie protection on web.
- **Fix:** Return token only when `x-mortly-mobile` header present (auth'd). Otherwise set the cookie server-side and return `{success:true}`.

### [x] H-10. Forgot-password timing side-channel enables enumeration
- **File:** `pages/api/auth/forgot-password.ts:28-49`
- **Fix:** Constant-time delay on no-user path, OR fully async send.

### [x] H-11. `getClientIp` spoofable via XFF
- **File:** `lib/rate-limit.ts:57-61`
- **Fix:** Use `x-real-ip` first; fall back to last XFF entry on Vercel.

### [x] H-12. Single-admin broker verification approval
- **File:** `pages/api/admin/brokers/[id].ts:49-97`
- **Fix:** Two-eyes approval for VERIFIED transitions.

### [x] H-13. No GET rate limit on `/api/admin/conversations/[id]` etc.
- **File:** `pages/api/admin/conversations/[id].ts:18-76`
- **Fix:** Per-admin GET budget (e.g. 600/min); audit-log sensitive GETs.

### [x] H-14. `buildSearchWhere` passes raw `req.query.status` to Prisma
- **File:** `lib/admin/query.ts:111-117`
- **Fix:** Per-filter enum allowlists.

### [x] H-15. Push notifications expose message content & financial details
- **File:** `pages/api/messages/index.ts:122-130`
- **Fix:** Default to "New message"; opt-in to preview.

### [x] H-16. `publicId` uses `Math.random()`
- **File:** `lib/publicId.ts:7-19`
- **Fix:** Use `crypto.randomInt`. Consider 11 digits.

### [x] H-17. `DELETE /api/users/me` no fresh re-auth
- **File:** `pages/api/users/me.ts:23-143`
- **Fix:** Require `currentPassword` (credentials) or fresh OAuth re-auth (OAuth users), or typed ack + 24h email confirmation.

---

## 🟡 MEDIUM PRIORITY

### [x] M-1. Same-issue email lowercasing — covered by C-5.
### [x] M-2. Apple OAuth fallback when email is null only checks appleId — `pages/api/auth/mobile-oauth.ts:106-115`. Reject if no email AND no prior appleId.
### [x] M-3. Subscription.updated credit re-grant idempotency — covered by C-8.
### [x] M-4. `/api/admin/credits` no max amount cap — `pages/api/admin/credits.ts:10-13`. Cap |amount| ≤ 10_000.
### [x] M-5. Bulk action lacks `bulkActionId` UUID in audit. — `pages/api/admin/users/bulk.ts:81-129`.
### [x] M-6. `/api/messages` no per-sender rate limit. — `pages/api/messages/index.ts`. 30/min via KV.
### [x] M-7. `/api/conversations` POST — explicit broker existence check before create. — `pages/api/conversations/index.ts:138-218`.
### [x] M-8. `/api/reports` no per-reporter rate limit (10/day). — `pages/api/reports.ts`.
### [x] M-9. Device token reassignment hijack. — `pages/api/notifications/register-device.ts:38-43`. Require nonce or reject reassignment.
### [x] M-10. JSON-stringified `details` in audit — fine today, watch for unsafe rendering downstream.
### [x] M-11. `verify-email` returns 200 for already-verified email — enumeration oracle. Make response indistinguishable.
### [x] M-12. `resetToken` unique constraint optional — non-issue but consider removing for resilience.
### [x] M-13. `sameOriginOk` rejects requests with no Referer — operational.
### [x] M-14. Prisma client connection-pool defaults — set explicit limit for Vercel + Supabase pooler.
### [x] M-15. `notices.ts` PUT validates only truthy id — add `typeof id === 'string'`.
### [x] M-16. `preferences.ts` accepts arbitrary values per whitelisted key — validate types per key.
### [x] M-17. `reset-password` sets `emailVerified: true` — intentional & OK; document with comment.
### [x] M-18. Maintenance flag 30s cache — operational.
### [x] M-19. Pin NextAuth cookie config explicitly (`secure`, `httpOnly`, `sameSite`).
### [x] M-20. PostHog `NEXT_PUBLIC_*` token reused server-side — fine; document.
### [x] M-21. Email HTML templates correctly escape user-controlled name.

---

## 🟢 SAFE — DO NOT REGRESS

- Stripe webhook signature verification (raw body parsing).
- bcrypt cost 12 throughout.
- `timingSafeEqual` on verification code & cron secret.
- `forgot-password` hashes the reset token before storing.
- `withAdmin` wrapper (role + CSRF + KV rate limit).
- `AdminAction` audit written in same transaction as mutation.
- Conversation participant ownership check.
- Broker `verificationStatus === VERIFIED` enforced on request access.
- L2 hardening: convo GET strips financial details when broker un-verified post-thread.
- Admin-create requires typed `ack` + tight rate limit + peer-admin email broadcast.
- Admin self-suspend / admin-suspend-admin protection.
- Idempotent block via composite PK + upsert.
- Atomic credit decrement via `updateMany({where:{responseCredits:{gt:0}}})`.
- No `dangerouslySetInnerHTML` on user input (only safe JSON-LD).
- No raw SQL anywhere — Prisma only.

---

## SCORE
**44 / 100 — DO NOT LAUNCH IN CURRENT STATE**

| Area | Score |
|---|---|
| Auth & Sessions | 4/15 |
| Authorization | 9/15 |
| Payments / Webhooks | 6/10 |
| Race Conditions | 6/10 |
| Input Validation | 5/10 |
| Admin Surface | 8/10 |
| Infra / Headers | 1/10 |
| Secrets / Env | 4/5 |
| Cron / Jobs | 2/5 |
| Account Deletion / Privacy | 1/10 |
