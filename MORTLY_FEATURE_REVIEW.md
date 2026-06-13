# Mortly — Deep Feature Completeness Review

**Date:** 2026-06-13
**Method:** 16 specialized review agents (13 area reviewers + 3 gap-fill + 1 re-run), every Critical/High/Medium finding independently re-verified by an adversarial verification agent against the actual code (124 agents total, ~2,200 tool calls). Severities below are post-calibration; 2 claims were refuted during verification and moved to the appendix.
**Scope:** entire codebase — read-only; no code was changed.

**Totals: 163 unique issues — 1 Critical, 21 High, 70 Medium, 71 Low. 14 launch blockers. 2 raised-and-refuted claims.**

---

## 1. Executive summary

Mortly's core engineering is stronger than most pre-launch codebases: auth is genuinely hardened (bcrypt-12, constant-time compares, KV-backed brute-force caps, server-side session revocation via tokenVersion, OAuth email_verified checks on web and mobile), credit deduction is race-safe with real-DB concurrency tests, the Stripe webhook has an idempotency ledger, IDOR protections on requests/conversations are enforced and tested, account deletion is a true FK-safe hard delete, and the prior Supabase Realtime data-breach was redesigned into a content-free "sync" nudge. `tsc --noEmit` passes clean.

The product around that core, however, is **not launch-ready**, for five structural reasons:

1. **The bilingual promise is broken.** ~385 translation keys used by the borrower dashboard, broker marketplace, chat, request form, and the entire admin console exist in NEITHER `en/common.json` NOR `ko/common.json`. The UI survives on inline fallback literals, so English users see Korean fragments and Korean users see English fragments on the core authed screens — in both locales, on a product whose entire premise is serving Korean-speaking Canadians in their language. API error messages are additionally English-only and rendered verbatim, password-reset emails are always Korean (the locale read is a dead code path), and the EN locale choice is lost on every full-page round-trip.

2. **The acquisition funnel and request lifecycle have dead ends.** The homepage / how-it-works / 404 primary CTAs send logged-out visitors to `/borrower/request/new`, which renders a permanently blank page (the page `return null`s before the shell that owns the login redirect can mount). Once a request gets any broker response, the borrower can neither edit it (client always sends a full payload the server 409s) nor delete it (409 tells them to "close the request instead" — and no close UI exists anywhere). `IN_PROGRESS` is never set by any organic flow, so the 30-day expiry cron kills actively-negotiated requests and the auto-close cascade is mostly inert.

3. **Money correctness has real defects.** A scheduled downgrade bills the renewal cycle at the OLD higher price while granting the NEW lower tier's credits; a payment-failed PREMIUM broker keeps unlimited conversation creation; payment failure silently strips credits with zero notification; stale `pendingTier` can silently downgrade a brand-new subscription; checkout/portal failures show the broker nothing at all; and the post-payment success banner renders raw i18n keys. The pricing page also sells PRO/PREMIUM notification features that do not exist anywhere in the backend, alongside fabricated strikethrough "was" prices.

4. **The notification layer is essentially absent.** Only 3 email types exist (verification code, password reset, admin-to-admin). Borrowers are never told their request was approved or rejected; brokers are never told they were verified, got a new lead, or that their payment failed; cron expiry/auto-close are completely silent; and the in-app notices system (API + bell UI, polling every 30s) has **no production code path that ever creates a notice** — the bell is permanently empty, and it's unreachable on mobile anyway.

5. **Two infrastructure items could break or expose production.** `User.appleId` exists in `schema.prisma` and is queried by both Apple OAuth paths, but **no migration creates the column** — any environment provisioned via `prisma migrate deploy` breaks. And the security of realtime chat still rests on Supabase dashboard state (deny-all RLS + realtime publication membership) that cannot be verified from code — this is the one Critical item and it is a verify-before-launch task, not a code fix.

The admin console is functional for its core moderation loop (approve/reject, verify brokers, suspend/ban with session revocation) but ships **hardcoded fake "automated check" results** on every queue item, claims notices are sent when nothing sends them, has a credit-adjustment API with no UI, a cosmetic-only maintenance mode, and is desktop-only and Korean-only.

Estimated effort to clear the 14 launch blockers: roughly 1–2 focused engineering weeks (most are Small/Medium complexity; the Stripe downgrade rework and i18n backfill are the largest).

---

## 2. Product architecture summary

**Stack:** Next.js ^16.2.9 (Pages Router) + TypeScript + Tailwind 3; Prisma 5.22 on PostgreSQL (Supabase-hosted; `DATABASE_URL`/`DIRECT_URL`); NextAuth 4 (JWT strategy) with Credentials + Google (web) + Apple (configured but no web button; native mobile token exchange via `/api/auth/mobile-oauth`); Supabase JS for realtime chat nudges (content-free `sync` broadcasts + 5s polling fallback); Stripe subscriptions (FREE/BASIC/PRO/PREMIUM + response credits); Resend email; Expo push (mobile app exists separately — `app.json`, `x-mortly-mobile` header paths); next-i18next (defaultLocale **ko**, locales ko/en, `localeDetection: false`, single `common` namespace); @vercel/kv for durable rate limiting; PostHog + Vercel Analytics; Vercel deploy with 3 crons (expire-requests 00:00, auto-close-conversations 12:00, purge-expired 01:30 — 180-day PII anonymization).

**Data model (14 models):** User (role BORROWER/BROKER/ADMIN, tokenVersion revocation, publicId) → BorrowerRequest (publicId, status PENDING_APPROVAL→OPEN→IN_PROGRESS→CLOSED/EXPIRED/REJECTED, details Json schemaVersion 2) → Conversation (unique [requestId, brokerId], per-side lastReadAt + denormalized msg counters) → Message (5000-char cap, isSystem flag). Broker (1:1 User; verificationStatus, subscriptionTier, responseCredits, stripeCustomerId) → Subscription (pendingTier, periods) + ProcessedStripeEvent (webhook idempotency ledger). Plus UserBlock, DeviceToken, BrokerRequestSeen, Report, AdminNotice, AdminAction, SystemSetting.

**Route surface:** 38 pages (15 public/marketing/auth, 7 borrower, 8 broker, 8 admin) and ~45 API routes (8 auth, 18 admin, requests/conversations/messages/brokers/borrowers/users, 3 Stripe + webhook, 3 cron, notices/reports/preferences/maintenance/register-device).

**Auth & guards:** All `/api/*` data routes wrapped in `withAuth`/`withAdmin` (session + role + CSRF origin-check + KV mutation rate limits) — solid. Admin pages SSR-gated via `adminSSR`. Borrower/broker pages are **client-side gated only** (shells redirect in `useEffect`; pages use `getStaticProps`) — no data leak (APIs are gated), but it produces the blank-page funnel bug and UX flashes.

**Intended borrower journey:** signup (credentials + legal-consent version recorded, 6-digit email verification; or Google OAuth → `/select-role`) → `/borrower/dashboard` → 3-step request form (RESIDENTIAL/COMMERCIAL branch, province, financial details, PIPEDA info text) → `PENDING_APPROVAL` banner → admin approves → `OPEN` in broker marketplace → brokers spend a credit to respond with an intro message → borrower compares responders on `/borrower/brokers/[requestId]` (real data — fastest/most-experienced sort) → chats → closes when done. *Reality gaps: blank-page funnel entry; no close UI; no approval/rejection notification; edit/delete dead-end after responses; silent 30-day expiry.*

**Intended broker journey:** signup as BROKER → `/broker/onboarding` (brokerage, province, optional license, phone, category) → `verificationStatus: PENDING` (admin verifies, optional two-admin mode) → browse OPEN requests (server-enforced VERIFIED gate) → request detail (full borrower financials visible pre-spend) → spend 1 credit (PREMIUM unlimited) to open a conversation with intro message → chat → manage plan in `/broker/billing` via Stripe Checkout/Portal. *Reality gaps: browse hard-capped at 20 with no pagination; default "only unresponded" filter is a no-op; no new-lead/verification/payment notifications; REJECTED brokers dead-ended; profile coverage settings never applied to matching.*

**i18n system:** next-i18next, ko default, no locale detection, one `common.json` per locale (1,819 keys each, perfectly mirrored **with each other** — the gap is the ~385 keys referenced in code that exist in neither). Korean rendering itself is solved properly (Pretendard via `html[lang=ko]`, global `break-keep`).

---

## 3. Go / No-Go assessment

### **NO-GO** in current state.

The marketplace loop (submit → approve → respond → chat → pay) works end-to-end on the happy path with hardened security — but the product breaks its bilingual promise on its core screens, its main conversion CTA dead-ends for every logged-out visitor, borrowers hit unrecoverable lifecycle dead-ends after receiving responses, broker billing has money-correctness bugs, and one schema-drift item can break any freshly provisioned environment.

**Top 5 blockers:**

1. **Verify Supabase Realtime hardening live** (the one Critical; 30-minute dashboard/SQL task): confirm RLS is enabled deny-all on `public.messages`/`public.conversations` and both tables are out of the `supabase_realtime` publication. The code-side redesign is correct; the guarantee lives in dashboard state.
2. **`User.appleId` missing from migrations** — `prisma migrate deploy` produces a database the Apple OAuth code crashes on. Generate the migration and reconcile prod history.
3. **Bilingual integrity** — backfill the ~385 missing keys into both catalogs (incl. the 2 raw-key strings shown right after payment), translate API errors via error codes, fix the always-Korean reset email, and add the CI key-coverage test so it can't regress.
4. **Funnel + lifecycle dead ends** — fix the blank `/borrower/request/new` for logged-out visitors (primary CTA target), add the missing close-request UI, scope the edit form once conversations exist, and gate conversation creation on `request.status === OPEN` so brokers can't spend credits on expired/rejected/unapproved requests.
5. **Stripe money correctness** — rework scheduled downgrades (currently billed at old price with new-tier credits), cut PAST_DUE PREMIUM entitlements, notify on payment failure, clear stale `pendingTier`, surface checkout/portal errors, and remove the pricing page's unimplemented features and fabricated anchor prices.

### All 14 launch blockers
| # | Issue | Severity | Effort |
|---|---|---|---|
| 1 | Supabase Realtime RLS/publication state unverifiable from code | Critical (needs manual verification) | Small (verify) |
| 2 | `User.appleId` in schema but in no migration — fresh deploys break | High | Small |
| 3 | Logged-out visitors to `/borrower/request/new` get a blank page (homepage/how-it-works/404 CTAs) | High | Small |
| 4 | Request edit always 409s once conversations exist | High | Medium |
| 5 | No UI to close a request (API exists; delete-409 instructs users to use it) | High | Small |
| 6 | ~385 i18n keys missing from BOTH locale catalogs | High | Medium |
| 7 | Broker conversation creation never checks request.status (credits spent on dead requests) | High | Small |
| 8 | Scheduled downgrade bills old price, grants new tier's credits | High | Medium |
| 9 | Payment failure strips credits with zero notification | High | Medium |
| 10 | Pricing page sells unimplemented PRO/PREMIUM notification features | High | Medium |
| 11 | Admin inbox shows hardcoded fake "automated checks" | High | Medium |
| 12 | Login brute-force strength depends on Vercel KV being provisioned (verify env) | Medium (needs manual verification) | Small (verify) |
| 13 | Billing success banner renders raw i18n keys right after payment | Medium | Small |
| 14 | Billing checkout/portal failures show no user feedback | Medium | Small |

---

## 4. Recommended implementation order

**Phase 0 — config verification, no code (same day):**
Supabase SQL check (`pg_class.relrowsecurity`, `pg_policies`, `pg_publication_tables` for messages/conversations); confirm `KV_REST_API_URL`, `STRIPE_PRICE_BASIC/PRO/PREMIUM`, `CRON_SECRET`, `NEXTAUTH_URL`, `RESEND_API_KEY/FROM` in Vercel prod env; generate the `appleId` migration and `prisma migrate resolve` against prod; decide/execute the first-ADMIN bootstrap path.

**Phase 1 — funnel & money (blockers 3–5, 7–10, 13–14; ~1 week):**
Fix `new.tsx` auth gate + add `callbackUrl` to shell redirects and point logged-out CTAs at signup; add Close Request button; scope edit form when conversations exist (diff-based PATCH); `request.status` allowlist in POST /api/conversations; Stripe downgrade via Subscription Schedule; PAST_DUE entitlement cut + payment-failed email/push; clear `pendingTier` on cancel/re-checkout; billing error banners + the 2 missing keys; strip unimplemented pricing rows and fake anchors/stats (or implement the features).

**Phase 2 — bilingual integrity (blocker 6; ~1 week, parallelizable):**
Backfill all ~385 keys (ko+en) with real translations; CI test extracting `t()` keys vs both catalogs; convert API error prose to error codes translated client-side; reset-email locale from request; `Btn as="a"` → `next/link` (locale-preserving); persist locale choice (NEXT_LOCALE cookie); fix `en-CA`-hardcoded dates; unify system-message localization; remove fake admin checks (blocker 11).

**Phase 3 — notification layer (~1 week):**
Approve/reject borrower notification (email + AdminNotice + push, in user's locale, with rejectionReason); broker verification decision notification; payment-failure notice (Phase 1 overlap); new-lead push for matching brokers; system messages + nudges on cron expiry/auto-close; implement the AdminNotice send path (API + modal) or remove the bell/palette entries; fix mobile notifications dropdown.

**Phase 4 — robustness & polish (ongoing):**
Pagination (broker browse, borrower context, chat history); error states (infinite skeleton, empty-state-vs-error across all data contexts, resend false-success); closed-conversation send guard; IN_PROGRESS transition + expiry exclusion for active negotiations; duplicate-submit idempotency; admin gaps (settings validation, undo flush on unload, ban cascade, credit-adjust UI); PostHog consent banner (Quebec Law 25); privacy page retention/date updates; dead-code removal; missing tests (start with the i18n key-coverage test and users/me deletion suite).

---

## 5. Production readiness concerns (beyond the issue list)

- **CI gates nothing:** no lint, no typecheck, no production build on PR; Playwright e2e only runs with a manual label. The `appleId` drift and the broken broker filter would both have been caught by a build+e2e gate.
- **Env fragility:** unset `STRIPE_PRICE_*` silently disables paid checkout ("Invalid tier"); unset KV silently weakens rate limits; unset `RESEND_API_KEY` makes verification codes unobtainable (incl. locally); `NEXTAUTH_URL` fallback breaks reset links. No fail-fast env validation at boot.
- **No first-admin bootstrap:** `/api/admin/users/create` requires an existing admin; seed mock data is the only path that creates one. Document/script a production bootstrap.
- **SEO/PWA:** default OG image 404s on every page; sitemap leaks `/en`-prefixed auth-only routes with broken `/en/en` hreflang; `/pricing` is auth-gated yet sitemap-advertised and prerenders empty; service worker can serve stale post-deploy HTML.
- **Honesty risks for a trust product:** homepage "live" stats (500+/50+/95%) are static copy inside a LIVE-labeled card; fabricated strikethrough prices; fake admin checks; "consultation completed" stepper on expired requests nobody answered.
- **Maintenance mode is cosmetic** (client-side only; APIs unaffected).
- **Monitoring:** PostHog only; no server-side error tracker (Sentry or similar) for API routes/webhook failures.
- **Repo hygiene:** `coverage/`, `test-results/`, `tsconfig.tsbuildinfo`, `mortly.pptx`, `posthog-setup-report.md` committed; eslint-config-next 14 vs next 16; dead `recharts` dependency.

---


## Critical issues (1)

### 1. Supabase Realtime chat security depends on unverifiable dashboard config (RLS deny-all + publication membership); channels are public broadcast channels

**Severity:** Critical  
**Feature area:** Realtime chat transport  
**User type affected:** All  
**Status:** Needs manual verification  
**Launch blocker:** Yes  
**Implementation complexity:** Small  
**Found by:** messaging

**Files:** lib/realtime.ts, lib/supabase.ts, pages/borrower/messages.tsx, pages/broker/messages.tsx
**Line references:** lib/realtime.ts:1-46, lib/supabase.ts:39, pages/borrower/messages.tsx:195-227, pages/broker/messages.tsx:181-217
**Current behavior:** Code-side the prior breach is fixed: the server sends only content-free 'sync' broadcasts (lib/realtime.ts:58-65, payload intentionally empty) on topic chat-<internal cuid>, and clients refetch through the participant-gated GET /api/conversations/[id]. The code comments assert that RLS is now ENABLED deny-all on public.messages/public.conversations (lib/realtime.ts:11-17), but that lives in the Supabase dashboard, not the repo. Clients subscribe with the public anon key to ordinary (non-private) broadcast channels.
**Expected behavior:** (1) RLS confirmed ENABLED with no anon SELECT policy on public.messages and public.conversations; (2) those tables removed from the supabase_realtime publication (or RLS-gated) so no anon client can self-subscribe to postgres_changes; (3) ideally private channels with Realtime Authorization so only participants can subscribe/broadcast to chat-<id>.
**User impact:** If the dashboard claim is wrong (RLS actually disabled and tables still in the realtime publication), any holder of the public anon key can stream every chat message and conversation row — full cross-user chat breach including financial discussion. Even if RLS is correct, an attacker who learns a conversation id (they appear in URLs ?id=, push payloads) can observe message-timing metadata and spam spoofed 'sync' broadcasts forcing participants' clients into refetch loops.
**Technical cause:** Security model moved from data-over-realtime to nudge-over-realtime, but its guarantees (deny-all RLS, publication contents) are runtime Supabase configuration; channel names use unguessable cuids but channels themselves are public broadcast topics with no authorization.
**Frontend impact:** None if config is correct; channel subscribe code unchanged either way.
**Backend impact:** None code-side; verification is dashboard-side.
**Database impact:** Must verify in Supabase dashboard: ALTER TABLE ... ENABLE ROW LEVEL SECURITY state for messages/conversations, absence of anon policies, and supabase_realtime publication membership.
**Exact recommended fix:** In the Supabase dashboard/SQL editor run: select relname, relrowsecurity from pg_class where relname in ('messages','conversations'); select * from pg_policies where tablename in ('messages','conversations'); select * from pg_publication_tables where pubname='supabase_realtime'. Confirm rowsecurity=true, zero anon policies, and neither table in the publication. Then test from an anonymous supabase-js client that postgres_changes on messages yields nothing. Optionally migrate chat-<id> topics to private channels with Realtime Authorization.
**Suggested test cases:**
- Anon-key client subscribes to postgres_changes on public.messages → receives zero events when a message is sent
- Anon-key client SELECT on messages/conversations via supabase-js → permission denied / empty
- Anon-key client subscribes to broadcast chat-<known id> → receives only empty 'sync' payloads
- Anon-key client broadcasts spoofed 'sync' to chat-<id> → participants refetch but see no incorrect data

> Adversarial verification: **needs-manual-verification** (calibrated severity Critical). Every code-level assertion in the claim is accurate. (1) lib/realtime.ts:58-65 sends only event "sync" with payload {} ("INTENTIONALLY EMPTY" at line 62) — no chat content over realtime. (2) The deny-all RLS guarantee exists ONLY as comments (lib/realtime.ts:11-17): a repo-wide grep of all 9 prisma migrations finds zero ROW LEVEL SECURITY / CREATE POLICY / supabase_realtime publication SQL, and th

---



## High issues (21)

### 1. Inbox detail drawer shows hardcoded fake 'automated checks' that never ran

**Severity:** High  
**Feature area:** Admin inbox / broker verification  
**User type affected:** Admin  
**Status:** Confirmed  
**Launch blocker:** Yes  
**Implementation complexity:** Medium  
**Found by:** admin — also reported by: i18n, ux-states

**Files:** pages/admin/inbox.tsx
**Line references:** pages/admin/inbox.tsx:522-559, pages/admin/inbox.tsx:562-577
**Current behavior:** DetailChecks renders static literals for every queue item: requests always show '신규 신청자 확인 완료', '중복 요청 없음', '콘텐츠 모더레이션 통과' as passed; brokers always show '라이선스 번호 형식 유효' and '이메일 인증 완료' as passed; reports always show '동일 대상 누적 신고 존재'. None are computed from data. RecommendedAction (lines 562-577) also claims '해결 시 조치가 대상에게 안내됩니다' (target is notified on resolve) — no such notification exists anywhere.
**Expected behavior:** Checks should be computed (e.g., real duplicate-request query, license format regex, emailVerified flag, actual count of prior reports against the target) or removed entirely.
**User impact:** Admins are told a fraudulent broker's license format is valid and a borrower request passed moderation when nothing was checked. On a mortgage marketplace this can directly cause verification of fake brokers.
**Technical cause:** Placeholder UI shipped as static JSX literals with hardcoded ok booleans.
**Frontend impact:** Replace DetailChecks with computed checks or delete the section; fix RecommendedAction copy.
**Backend impact:** If kept, /api/admin/queue must return real check data (duplicate counts, emailVerified, prior report counts).
**Database impact:** None (queries only).
**Exact recommended fix:** Short term: delete DetailChecks/RecommendedAction or label them as guidance, not results. Proper fix: compute each check server-side in queue.ts and render real pass/fail.
**Suggested test cases:**
- Broker with unverified email shows a failing email check
- Second report against the same target shows accumulated-report warning with count
- Request from a borrower with 2 other open requests does not show '중복 요청 없음'

> Adversarial verification: **confirmed** (calibrated severity High). Confirmed on all points. (1) DetailChecks at pages/admin/inbox.tsx:522-559 renders hardcoded JSX literals under the header "자동 체크" (line 543): REQ rows always show '신규 신청자 확인 완료', '중복 요청 없음', '콘텐츠 모더레이션 통과' as passed (lines 526-528); BRK rows always show '라이선스 번호 형식 유효' and '이메일 인증 완료' as passed (lines 532-533); REP rows always show '동일 대상 누적 신고 존재 — 검토 필요' (line 538). No check is computed from da

---

### 2. Borrowers receive no notification (email, notice, or push) when their request is approved or rejected

**Severity:** High  
**Feature area:** Request approval flow  
**User type affected:** Borrower  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Medium  
**Found by:** admin — also reported by: notifications

**Files:** pages/api/admin/requests/[id].ts, lib/email.ts, pages/api/notices.ts
**Line references:** pages/api/admin/requests/[id].ts:54-155, lib/email.ts:17-152
**Current behavior:** PUT /api/admin/requests/[id] updates status and writes an AdminAction, nothing else. lib/email.ts exports only sendVerificationCode, notifyAdminsOfNewAdmin, sendPasswordResetEmail — no approval/rejection email. No adminNotice.create exists anywhere in the codebase (grep confirmed), and no push call is made. The borrower only discovers the outcome by manually opening their dashboard (pages/borrower/request/[id].tsx:244 renders rejectionReason or a fallback).
**Expected behavior:** On APPROVE_REQUEST / REJECT_REQUEST the borrower gets at least one channel (email via Resend, AdminNotice row, or Expo push) in their locale, with the rejection reason included.
**User impact:** Borrowers who don't poll their dashboard never learn their request went live (and may miss broker contact windows before the 30-day expiry cron) or was rejected.
**Technical cause:** Notification dispatch was never implemented in the admin status-change handler.
**Frontend impact:** None required (dashboard already displays status + rejectionReason).
**Backend impact:** Add email/notice/push dispatch in pages/api/admin/requests/[id].ts after the transaction, with templates in both ko and en keyed off a user locale preference.
**Database impact:** Optionally store the user's preferred locale; AdminNotice model already exists with a dedupeKey suited for this.
**Exact recommended fix:** Create AdminNotice rows (the read pipeline already works) and send a Resend email on approve/reject, wrapped in try/catch so notification failure doesn't block the status change.
**Suggested test cases:**
- Approve request → borrower has 1 unread notice + 1 email
- Reject with reason → reason appears in notice body in borrower's language
- Email failure does not roll back the status change

> Adversarial verification: **confirmed** (calibrated severity High). Confirmed with file:line evidence. PUT /api/admin/requests/[id] (pages/api/admin/requests/[id].ts:54-155) updates borrowerRequest.status and writes an adminAction (line 144) with no borrower-facing dispatch: the handler imports neither lib/email nor lib/push, and the only side effect beyond the update is for status=CLOSED (system chat message + notifyConversations, lines 97-127), which per lib/rea

---

### 3. Admin notices feature is half-built: rows can never be created, user dropdown permanently empty, palette action dead-ends

**Severity:** High  
**Feature area:** Admin notices  
**User type affected:** All  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Medium  
**Found by:** admin — also reported by: data-layer, notifications

**Files:** pages/api/notices.ts, components/Navbar.tsx, components/admin/CommandPalette.tsx, prisma/schema.prisma
**Line references:** components/admin/CommandPalette.tsx:171-174, components/admin/CommandPalette.tsx:227, pages/api/notices.ts:4-46, prisma/schema.prisma:329-344
**Current behavior:** grep across pages/ and lib/ shows adminNotice is only read (notices.ts findMany), marked read (updateMany), and deleted on account deletion (users/me.ts:165). There is no POST endpoint and no admin UI to send one. The command palette exposes '관리자 공지 발송' which navigates to /admin/users/[id] claiming 'the existing modal lives' there (CommandPalette.tsx:19-21 comment), but pages/admin/users/[id].tsx contains no notice modal. Navbar polls /api/notices every 30s for all non-admin users and renders an always-empty dropdown.
**Expected behavior:** Either a working send-notice API + modal, or removal of the palette action and Navbar bell until built.
**User impact:** Admins believe they can message users and cannot; users poll an endpoint that can never return data (wasted requests at 2/min/user).
**Technical cause:** Send path was never implemented; consumer UI and schema (incl. dedupeKey idempotency) shipped ahead of it.
**Frontend impact:** Add a send-notice modal on user detail (subject/body), or remove the palette entry.
**Backend impact:** Add POST /api/admin/notices (withAdmin, validateText caps, audit row).
**Database impact:** None — AdminNotice model is ready.
**Exact recommended fix:** Implement POST /api/admin/notices + modal on /admin/users/[id]; reuse buildAdminActionCreate for auditing.
**Suggested test cases:**
- Admin sends notice → appears unread in target's Navbar within one poll
- Non-admin cannot POST
- Subject/body length caps enforced
- dedupeKey prevents duplicate delivery

> Adversarial verification: **confirmed** (calibrated severity High). Every factual element of the claim holds up under adversarial inspection.

1. No send path exists. /pages/api/notices.ts handles only GET (adminNotice.findMany, lines 7-19) and PUT (updateMany set read=true, lines 33-36); everything else gets 405 (line 45). An exhaustive grep of pages/, lib/, components/ for adminNotice/admin_notices finds only three app references: notices.ts (read/mark-read), pa

---

### 4. Borrower cannot close a request from any UI despite API support and delete-flow instructions to do so

**Severity:** High  
**Feature area:** Request lifecycle  
**User type affected:** BORROWER  
**Status:** Confirmed  
**Launch blocker:** Yes  
**Implementation complexity:** Small  
**Found by:** borrower-flow

**Files:** /Users/hyunseokcho/Documents/GitHub/mortly/pages/api/requests/[id].ts, /Users/hyunseokcho/Documents/GitHub/mortly/pages/borrower/request/[id].tsx
**Line references:** pages/api/requests/[id].ts:87-141 (PUT status=CLOSED handler), pages/api/requests/[id].ts:258-263 (DELETE 409: 'Close the request instead'), pages/borrower/request/[id].tsx:206-229 (only Edit/Delete buttons rendered)
**Current behavior:** PUT /api/requests/[id] {status:'CLOSED'} exists (closes conversations, posts bilingual system message, notifies realtime) but a repo-wide grep found zero frontend callers (only /api/conversations/[id] close in messages.tsx, which closes a conversation, not the request). The DELETE endpoint rejects deletion with conversations and instructs the user to close instead.
**Expected behavior:** A 'Close request' action on the request detail page (and/or dashboard) for OPEN/IN_PROGRESS requests, especially when conversations exist and delete is blocked.
**User impact:** A borrower whose request received any broker response can neither delete nor close it; it stays 'active', keeps counting against the 5-active-request cap until cron expiry, and the 409 error tells them to do something the UI does not offer.
**Technical cause:** Close endpoint shipped without corresponding UI control.
**Frontend impact:** Add close button + confirm modal on pages/borrower/request/[id].tsx calling PUT with status CLOSED.
**Backend impact:** None — endpoint ready (consider adding a current-status guard, see separate finding).
**Database impact:** None.
**Exact recommended fix:** Render a Close Request button when status is OPEN or IN_PROGRESS; on success call refreshBorrowerData() and update local state.
**Suggested test cases:**
- Borrower closes OPEN request with conversations -> request CLOSED, conversations CLOSED, system message created
- Close button hidden for CLOSED/EXPIRED/REJECTED
- Delete blocked (409) path surfaces guidance with working close CTA

---

### 5. 'Only unresponded' browse filter is a silent no-op — frontend filters on a field the API no longer returns

**Severity:** High  
**Feature area:** Broker lead inbox  
**User type affected:** Broker  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** broker-flow

**Files:** pages/broker/requests/index.tsx, pages/api/requests/index.ts, components/broker/BrokerDataContext.tsx, tests/broker/BrokerRequests.test.tsx
**Line references:** pages/broker/requests/index.tsx:125-134, pages/broker/requests/index.tsx:45, pages/api/requests/index.ts:62-74, pages/api/requests/index.ts:107-118, components/broker/BrokerDataContext.tsx:97, tests/broker/BrokerRequests.test.tsx:184-220
**Current behavior:** The default-on 'Only unresponded' chip filters with `!req.conversations?.some(conv => conv.broker?.userId === brokerUserId)`. The broker GET /api/requests response intentionally dropped the nested conversations include (comment at index.ts:62-65) and instead returns a flat `hasMyConversation` boolean (index.ts:115), which no frontend file consumes (grep confirms only the API references it). `req.conversations` is always undefined, so the predicate is true for every row — the filter shows everything.
**Expected behavior:** With the chip on (default), requests the broker already has a conversation on should be hidden, using the `hasMyConversation` flag the API provides.
**User impact:** Brokers see requests they already paid to respond to mixed into their 'unresponded' inbox; toggling the chip changes nothing. They only discover they already responded after opening the detail page.
**Technical cause:** Backend was refactored from nested `conversations` include to a flat `hasMyConversation` boolean; the frontend filter and the BrokerCachedRequest type were never updated. The component test (BrokerRequests.test.tsx:184-220) stubs the OLD response shape with a conversations array, so it still passes against the stale contract.
**Frontend impact:** Update filteredRequests in pages/broker/requests/index.tsx to use req.hasMyConversation; update BrokerRequest interface (line 45) and BrokerCachedRequest (BrokerDataContext.tsx:97); update the stale test fixture.
**Backend impact:** None — API already returns the correct flag (covered by tests/integration/api/requests/index.test.ts:174-203).
**Database impact:** None.
**Exact recommended fix:** Change the filter to `requests.filter((req) => !req.hasMyConversation)`, add hasMyConversation to the frontend types, delete the dead conversations field, and rewrite the test fixture to the real API shape.
**Suggested test cases:**
- Broker with an existing conversation on request A: A hidden by default, shown when chip off
- Fixture uses hasMyConversation (not conversations[]) and test still passes
- Borrower GET response unaffected

> Adversarial verification: **confirmed** (calibrated severity High). Every factual element of the claim verifies against the code. (1) pages/broker/requests/index.tsx:125-134 filters with !req.conversations?.some(conv => conv.broker?.userId === brokerUserId), and the chip defaults ON (line 81: useState(true)); the stale type field is at line 45. (2) pages/api/requests/index.ts broker GET (lines 55-78) includes only _count and brokerSeens — the comment at lines 60-6

---

### 6. Broker marketplace silently capped at 20 newest requests — pagination metadata returned but no pagination UI

**Severity:** High  
**Feature area:** Broker lead inbox  
**User type affected:** Broker  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** broker-flow

**Files:** pages/broker/requests/index.tsx, pages/api/requests/index.ts
**Line references:** pages/broker/requests/index.tsx:87-101, pages/api/requests/index.ts:39-42, pages/api/requests/index.ts:120-124
**Current behavior:** fetchRequests builds params only from province/mortgageCategory; the API defaults to limit=20 page=1 and returns a `pagination` object ({page, limit, total, totalPages}) that the frontend never reads. There is no next-page control, infinite scroll, or 'showing X of Y' indicator anywhere on the page.
**Expected behavior:** Brokers can page through (or lazily load) all OPEN requests; at minimum the UI indicates more results exist.
**User impact:** Once more than 20 OPEN requests exist, older leads become invisible to every broker — borrowers on page 2+ never receive responses and brokers lose revenue opportunities, with no error or hint.
**Technical cause:** Frontend ignores json.pagination; no page state exists in the component.
**Frontend impact:** Add page state + load-more/next-prev controls driven by json.pagination.totalPages; or raise limit and add infinite scroll.
**Backend impact:** None — endpoint already supports page/limit up to 100.
**Database impact:** None.
**Exact recommended fix:** Consume the pagination object: keep page in state, append `page`/`limit` to the query string, render a 'Load more' button while page < totalPages.
**Suggested test cases:**
- 25 OPEN requests: first 20 render, control loads remaining 5
- Filters reset page to 1
- newCount badge still reflects all unseen, not just current page

> Adversarial verification: **confirmed** (calibrated severity High). Every cited fact holds. pages/broker/requests/index.tsx:87-89 builds query params only from province/mortgageCategory (no page/limit); lines 100-102 read only json.data and json.newCount, discarding json.pagination; no page state or pagination/load-more UI exists anywhere in the 595-line file (the Refresh button at line 227 refetches page 1). pages/api/requests/index.ts:40-42 defaults page=1 limit

---

### 7. User.appleId exists in schema.prisma but in no migration — migrate deploy produces a DB without the column Apple OAuth queries

**Severity:** High  
**Feature area:** Database schema / migrations  
**User type affected:** All  
**Status:** Confirmed  
**Launch blocker:** Yes  
**Implementation complexity:** Small  
**Found by:** data-layer

**Files:** prisma/schema.prisma, prisma/migrations, lib/auth.ts, pages/api/auth/mobile-oauth.ts
**Line references:** prisma/schema.prisma:17, lib/auth.ts:166-170, pages/api/auth/mobile-oauth.ts:135-147
**Current behavior:** schema.prisma declares `appleId String? @unique` (added in commit 9787476 'Added apple oauth'). grep across all 9 migration.sql files finds no appleId column or users_appleId_key index. Any environment provisioned with `prisma migrate deploy` lacks the column while the generated client selects/filters on it.
**Expected behavior:** A migration (e.g. ALTER TABLE users ADD COLUMN "appleId" TEXT; CREATE UNIQUE INDEX) matching the schema, so migrate deploy and the Prisma client agree.
**User impact:** On a migrations-provisioned database, every Apple sign-in (web NextAuth path and mobile /api/auth/mobile-oauth) throws Prisma P2022 (column does not exist) — Apple login is completely broken; `prisma migrate dev` also reports drift and blocks future migrations.
**Technical cause:** Schema was edited for Apple OAuth without running `prisma migrate dev` to generate the companion migration; if production currently works it is because the column was added via `prisma db push` or manual SQL, leaving the migration history out of sync.
**Frontend impact:** Apple login button fails with a 500 for affected environments.
**Backend impact:** All queries touching User.appleId fail; migrate deploy/dev drift errors poison future schema changes.
**Database impact:** users table missing appleId column + unique index on any freshly-migrated database.
**Exact recommended fix:** Generate the missing migration (ALTER TABLE "users" ADD COLUMN "appleId" TEXT; CREATE UNIQUE INDEX "users_appleId_key" ON "users"("appleId")), then run `prisma migrate resolve`/`migrate diff` against production to confirm history and database agree. Add a CI step that runs `prisma migrate diff --from-migrations --to-schema-datamodel` to catch future drift.
**Suggested test cases:**
- Fresh DB + `prisma migrate deploy` + Apple sign-in succeeds
- `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma` reports empty
- Linking an existing email account to Apple sets appleId and enforces uniqueness

> Adversarial verification: **confirmed** (calibrated severity High). Every factual element verified. prisma/schema.prisma:17 declares `appleId String? @unique`, added in commit 9787476 ('Added apple oauth') which touched schema.prisma (+1 line), lib/auth.ts, and pages/api/auth/mobile-oauth.ts but no migration files. Grep across all 9 migration directories finds zero occurrences of appleId: the users table DDL in prisma/migrations/20260413074337_remove_introductions

---

### 8. POST /api/conversations (broker flow) never checks request.status — credits can be spent contacting EXPIRED/CLOSED/REJECTED/PENDING_APPROVAL requests

**Severity:** High  
**Feature area:** Conversations / credits  
**User type affected:** Broker  
**Status:** Confirmed  
**Launch blocker:** Yes  
**Implementation complexity:** Small  
**Found by:** data-layer — also reported by: messaging

**Files:** pages/api/conversations/index.ts
**Line references:** pages/api/conversations/index.ts:153-159, pages/api/conversations/index.ts:230-338
**Current behavior:** The broker branch fetches the request (lines 153-155), checks broker verification/tier/blocks and the intro message, then deducts a credit and creates the conversation — request.status is never read. The borrower branch (161-227) likewise allows starting conversations on any own request regardless of status.
**Expected behavior:** Brokers should only be able to open conversations on OPEN (or IN_PROGRESS) requests; PENDING_APPROVAL requests have not passed admin review and terminal requests should refuse contact (or at least not charge a credit).
**User impact:** A broker who knows or guesses a request publicId can pay a credit to message a borrower on a request that admins rejected, that expired, or that is still awaiting approval — bypassing the admin moderation gate and wasting paid credits on dead requests with no refund.
**Technical cause:** Missing `if (request.status !== "OPEN") return 4xx` guard in the POST handler.
**Frontend impact:** Browse page filters to OPEN, so the UI hides the problem; direct API calls (or stale browse tabs) expose it.
**Backend impact:** Credit deduction + conversation creation proceed for ineligible requests inside the Serializable transaction.
**Database impact:** Conversations attached to terminal/unapproved requests; responseCredits decremented for them.
**Exact recommended fix:** Add a status allowlist check immediately after the request lookup (both broker and borrower branches), returning 409/403 with a translated error; refund/no-charge semantics in the transaction.
**Suggested test cases:**
- Broker POST on EXPIRED request → 4xx, credit unchanged
- Broker POST on PENDING_APPROVAL request → 4xx
- Broker POST on OPEN request → 201, credit -1
- Borrower POST on own CLOSED request → 4xx

> Adversarial verification: **confirmed** (calibrated severity High). The claim is accurate. I attempted to refute it by looking for guards elsewhere and found none — instead I found multiple places proving the missing check contradicts explicit design intent.

1. The cited code behaves exactly as claimed. In pages/api/conversations/index.ts the POST handler fetches the request at lines 153-155, returns 404 if missing (157-159), and `request.status` is never read an

---

### 9. Request lifecycle gap: nothing ever sets IN_PROGRESS automatically, so expire-requests kills actively-negotiated requests and auto-close's cascade is dead in the normal flow

**Severity:** High  
**Feature area:** Request lifecycle / crons  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** data-layer — also reported by: borrower-flow

**Files:** pages/api/conversations/index.ts, pages/api/cron/expire-requests.ts, pages/api/cron/auto-close-conversations.ts, pages/api/admin/requests/[id].ts
**Line references:** pages/api/conversations/index.ts:294-338, pages/api/cron/expire-requests.ts:10-16, pages/api/cron/auto-close-conversations.ts:118-122
**Current behavior:** Conversation creation never updates BorrowerRequest.status; the only writer of IN_PROGRESS is the admin manual status PUT (pages/api/admin/requests/[id].ts:61). expire-requests expires ALL OPEN requests older than 30 days even when brokers have paid for active conversations on them. auto-close-conversations' step 3 cascades requests to CLOSED only `where status: "IN_PROGRESS"`, which essentially never holds.
**Expected behavior:** First conversation on an OPEN request flips it to IN_PROGRESS (matching dashboard copy that treats OPEN/IN_PROGRESS as 'active'), expire-requests skips requests with ACTIVE conversations, and the cascade-close path actually fires.
**User impact:** A borrower mid-negotiation at day 31 sees their request silently flip to EXPIRED (status badge on dashboard/marketplace), brokers lose marketplace visibility of it, and neither side is told; the cron's request cascade is dead code in practice.
**Technical cause:** Status transition OPEN→IN_PROGRESS was designed (cron cascade + UI labels reference it) but the write was never implemented in conversation creation.
**Frontend impact:** borrower/dashboard.tsx:79-97 counts OPEN/IN_PROGRESS as active; EXPIRED requests drop out with no explanation.
**Backend impact:** expire-requests over-expires; auto-close step 3 is unreachable in organic data.
**Database impact:** Requests with active conversations carry status EXPIRED; IN_PROGRESS appears only via manual admin edits.
**Exact recommended fix:** Set request status to IN_PROGRESS inside the conversation-create transaction (when current status is OPEN), and/or exclude requests with ACTIVE conversations from expire-requests' where clause.
**Suggested test cases:**
- Broker opens conversation on OPEN request → request becomes IN_PROGRESS
- expire-requests does not expire a 31-day-old request with an ACTIVE conversation
- auto-close closing the last ACTIVE conversation on an IN_PROGRESS request closes the request

> Adversarial verification: **confirmed** (calibrated severity High). Every factual element of the claim holds. (1) Neither conversation-creation path writes BorrowerRequest.status: the borrower flow (pages/api/conversations/index.ts:202) and the broker credit-deduction transaction (:294-338) only create the Conversation. A grep of all borrowerRequest write sites confirms the sole production writer of IN_PROGRESS is the admin PUT (pages/api/admin/requests/[id].ts:61

---

### 10. Password-reset emails are always Korean: user.preferences.locale is read but never written, and the frontend never sends locale

**Severity:** High  
**Feature area:** Auth / password reset email  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** i18n — also reported by: auth-recovery, gap:Borrower onboarding / first-run experience (checklist says onboarding for BOTH roles; only broker side was reviewed), notifications

**Files:** pages/api/auth/forgot-password.ts, pages/api/auth/signup.ts, lib/legal.ts, pages/forgot-password.tsx, lib/email.ts
**Line references:** pages/api/auth/forgot-password.ts:63-67, pages/api/auth/forgot-password.ts:58, pages/api/auth/signup.ts:89, lib/legal.ts:5-10, pages/forgot-password.tsx:24
**Current behavior:** forgot-password.ts:66 selects email locale via (user.preferences)?.locale === "en". A repo-wide grep shows NO code path ever writes preferences.locale — signup.ts:89 sets preferences to createLegalAcceptanceMetadata() (legalVersion + legalAcceptedAt only). The forgot-password page POSTs only { email } (forgot-password.tsx:24) even though it knows router.locale. Result: the condition is always false and every reset email is Korean. Additionally the reset link (forgot-password.ts:58) is `${NEXTAUTH_URL}/reset-password?token=...` with no /en prefix, so EN users land on the Korean reset page.
**Expected behavior:** Reset email and reset-page link in the requesting user's language.
**User impact:** English-only users receive a fully Korean security email about their password and land on a Korean reset form; sendVerificationCode works correctly by contrast because signup/verify pages pass router.locale in the request body.
**Technical cause:** Dead read of preferences.locale (writer was never implemented); request locale not forwarded; URL not locale-prefixed.
**Frontend impact:** pages/forgot-password.tsx should send locale: router.locale.
**Backend impact:** pages/api/auth/forgot-password.ts should accept body.locale (mirroring resend-code.ts:28,74) and/or persist preferences.locale at signup; prefix resetUrl with /en when applicable.
**Database impact:** Optional: persist locale into User.preferences at signup/locale-switch so all future server-initiated communication can use it.
**Exact recommended fix:** Accept locale in the forgot-password request body (same pattern as resend-code), use it for both the email template and the resetUrl prefix; longer term persist a canonical user locale.
**Suggested test cases:**
- POST /api/auth/forgot-password with locale=en from EN page; assert email subject is 'Reset your mortly password' and link contains /en/reset-password
- Existing ko flow unchanged

> Adversarial verification: **confirmed** (calibrated severity High). The claimed behavior is real and reproducible from the code. (1) pages/api/auth/forgot-password.ts:66 selects email locale via (user.preferences)?.locale === "en" ? "en" : "ko". (2) No client in this repo ever persists preferences.locale: signup (pages/api/auth/signup.ts:89) writes only legal metadata from createLegalAcceptanceMetadata() (lib/legal.ts:5-10); OAuth creation paths (lib/auth.ts:195-2

---

### 11. Subscription payment failure strips broker credits to FREE with zero notification

**Severity:** High  
**Feature area:** Notifications / Billing  
**User type affected:** Broker  
**Status:** Confirmed  
**Launch blocker:** Yes  
**Implementation complexity:** Medium  
**Found by:** notifications

**Files:** /Users/hyunseokcho/Documents/GitHub/mortly/pages/api/webhooks/stripe.ts
**Line references:** pages/api/webhooks/stripe.ts:303-338
**Current behavior:** handleInvoicePaymentFailed sets Subscription.status=PAST_DUE and immediately resets Broker.responseCredits to the FREE allotment. The only side-effect is a PostHog analytics capture (line 332-337) — no email, push, or AdminNotice to the broker.
**Expected behavior:** Broker receives an immediate email (billing notices are conventionally email) and/or push: payment failed, credits suspended, link to the Stripe billing portal to update the card.
**User impact:** A paying broker whose card expires silently loses the ability to contact borrowers mid-pipeline. They discover it only when an intro fails with 'No response credits remaining' / 'Free plan brokers cannot message clients', which looks like a product bug and risks churn/chargebacks.
**Technical cause:** No notification helper is invoked in handleInvoicePaymentFailed; the codebase has no billing email template at all. Stripe's own dashboard dunning emails may or may not be enabled — that is dashboard config not visible in code (verify in Stripe dashboard).
**Frontend impact:** Optionally a PAST_DUE banner on /broker/billing and /broker/dashboard.
**Backend impact:** Add a sendPaymentFailedEmail template in lib/email.ts and call it (plus sendPushToUsers) in handleInvoicePaymentFailed; needs broker user email (include user relation in the subscription lookup).
**Database impact:** None required; optional AdminNotice row with dedupeKey = invoice id.
**Exact recommended fix:** In handleInvoicePaymentFailed, load subscription.broker.user.email, send a bilingual payment-failed email with a billing-portal CTA, send a push, and write an AdminNotice keyed on the invoice id for idempotency across Stripe retries. Also verify Stripe Smart Retries/dunning emails are enabled in the dashboard.
**Suggested test cases:**
- invoice.payment_failed webhook -> email + push sent to broker user, credits reset
- Duplicate webhook delivery -> exactly one notice (ProcessedStripeEvent + dedupeKey)
- Successful retry (invoice.paid) -> optional recovery notification

> Adversarial verification: **confirmed** (calibrated severity High). Verified against the code. handleInvoicePaymentFailed (pages/api/webhooks/stripe.ts:303-338) does exactly what the claim says: sets Subscription.status=PAST_DUE and resets Broker.responseCredits to the FREE allotment in a transaction (lines 321-330), with a PostHog capture as the sole side-effect (lines 332-337). The in-code comment at lines 314-318 confirms the immediate credit strip is intention

---

### 12. Scheduled downgrade bills the renewal cycle at the OLD higher price while granting the NEW lower tier's credits

**Severity:** High  
**Feature area:** Subscriptions — downgrade flow  
**User type affected:** Broker  
**Status:** Confirmed  
**Launch blocker:** Yes  
**Implementation complexity:** Medium  
**Found by:** payments

**Files:** pages/api/webhooks/stripe.ts, pages/api/stripe/create-checkout.ts, public/locales/en/common.json, public/locales/ko/common.json
**Line references:** pages/api/stripe/create-checkout.ts:76-83, pages/api/webhooks/stripe.ts:246-258, pages/api/webhooks/stripe.ts:260-293
**Current behavior:** Downgrade only stores pendingTier in the DB; the Stripe subscription price is left unchanged. At period rollover, Stripe generates and charges the renewal invoice at the OLD (higher) price. Only after that invoice is paid does handleInvoicePaid swap the Stripe price (proration_behavior: 'none') and set tier/credits to the lower pendingTier. Result: for the first cycle after a scheduled downgrade, the broker is charged e.g. PRO $69 but receives BASIC's 5 credits.
**Expected behavior:** The price change should take effect at the period boundary so the broker is charged the new lower price for the cycle in which they receive the lower tier's entitlements. UI copy (broker.planScheduled, broker.pendingDowngrade, pricing.faq1A in both locales) promises exactly this.
**User impact:** Paying brokers who downgrade are overcharged for one full billing cycle (e.g. $40 PRO→BASIC delta) while receiving the cheaper tier's credits. Direct money-wrong behavior with chargeback/refund/trust risk.
**Technical cause:** The pendingTier price swap is applied reactively in the invoice.paid handler AFTER the renewal invoice has already been finalized and charged at the old price, instead of being scheduled in Stripe before the cycle boundary.
**Frontend impact:** Banners (billing.tsx pendingDowngrade banner) state the user keeps the current plan 'until then' — implying the new price starts on that date.
**Backend impact:** handleInvoicePaid needs to stop owning the downgrade; create-checkout should schedule it in Stripe.
**Database impact:** pendingTier column could become unnecessary or remain as a display cache.
**Exact recommended fix:** Use a Stripe Subscription Schedule (current phase ends at current_period_end; next phase uses the new price), or call stripe.subscriptions.update with the new price and proration_behavior:'none' combined with billing_cycle_anchor:'unchanged' at the boundary via Stripe's own scheduling. Keep pendingTier only for UI display, cleared by the subsequent customer.subscription.updated event.
**Suggested test cases:**
- Schedule PRO→BASIC downgrade mid-cycle; assert the next renewal invoice amount equals the BASIC price
- Assert credits granted for the renewal cycle match the tier actually billed
- Cancel a scheduled downgrade before period end and assert the original price persists

> Adversarial verification: **confirmed** (calibrated severity High). I attempted to refute this and could not — every link in the chain checks out.

1) Downgrade only touches the local DB, never Stripe. /Users/hyunseokcho/Documents/GitHub/mortly/pages/api/stripe/create-checkout.ts:76-83 — the downgrade branch runs only `prisma.subscription.update({ data: { pendingTier: tier } })` and returns `{ updated: true, scheduled: true }`. No `stripe.subscriptions.update`, no

---

### 13. Payment-failed PREMIUM brokers retain unlimited conversation creation (tier not reset, credit gate bypassed)

**Severity:** High  
**Feature area:** Payment failure handling / credit spend  
**User type affected:** Broker  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** payments

**Files:** pages/api/webhooks/stripe.ts, pages/api/conversations/index.ts
**Line references:** pages/api/webhooks/stripe.ts:303-330, pages/api/conversations/index.ts:282, pages/api/conversations/index.ts:302-310
**Current behavior:** handleInvoicePaymentFailed sets Subscription.status=PAST_DUE and resets Broker.responseCredits to the free-tier amount, but leaves Broker.subscriptionTier unchanged. In POST /api/conversations, isPremium = subscriptionTier === 'PREMIUM' skips the credit decrement entirely, so a PAST_DUE PREMIUM broker can still create unlimited new conversations for Stripe's entire dunning window (potentially weeks, until customer.subscription.deleted fires). BASIC/PRO past-due brokers are correctly blocked by credits=0.
**Expected behavior:** Per the handler's own comment ('Strip the broker's paid-tier credits as soon as payment fails'), non-paying brokers of ALL tiers should lose the ability to start new paid response flows immediately.
**User impact:** Highest-paying tier is the only one that keeps consuming the core paid feature without paying; revenue leak and unfair to paying brokers competing for the same borrowers.
**Technical cause:** The unlimited entitlement is keyed off Broker.subscriptionTier, which invoice.payment_failed never touches; the credit reset is ineffective for the -1-sentinel tier.
**Frontend impact:** Billing page correctly shows the PAST_DUE banner, but the broker experiences no actual restriction.
**Backend impact:** Either gate conversation creation on Subscription.status, or downgrade subscriptionTier on payment failure (and restore on invoice.paid).
**Database impact:** None (existing columns suffice).
**Exact recommended fix:** In POST /api/conversations, additionally check the broker's subscription status (block when PAST_DUE/EXPIRED), or in handleInvoicePaymentFailed set subscriptionTier to FREE alongside the credit reset and restore it in handleInvoicePaid.
**Suggested test cases:**
- invoice.payment_failed for a PREMIUM broker, then POST /api/conversations → expect 403
- invoice.paid retry succeeds → conversation creation restored
- BASIC past-due broker remains blocked (regression)

> Adversarial verification: **confirmed** (calibrated severity High). Confirmed at every cited line. handleInvoicePaymentFailed (pages/api/webhooks/stripe.ts:321-330) writes only Subscription.status=PAST_DUE and Broker.responseCredits=freeCredits; Broker.subscriptionTier is never touched, despite the hard-cut intent stated in the comment at lines 314-318. In POST /api/conversations, line 282 sets isPremium from subscriptionTier==='PREMIUM' and lines 302-310 skip the

---

### 14. Pricing page sells PRO/PREMIUM notification features that are not implemented anywhere in the backend

**Severity:** High  
**Feature area:** Pricing / Billing claims  
**User type affected:** Broker  
**Status:** Confirmed  
**Launch blocker:** Yes  
**Implementation complexity:** Medium  
**Found by:** public-deploy

**Files:** pages/pricing.tsx, lib/email.ts, lib/push.ts, pages/api/conversations/index.ts, pages/api/messages/index.ts, public/locales/en/common.json, public/locales/ko/common.json
**Line references:** pages/pricing.tsx:74-77, pages/pricing.tsx:90-94, pages/pricing.tsx:106-110, pages/pricing.tsx:116-120, lib/email.ts:17-191, pages/api/conversations/index.ts:242, pages/api/conversations/index.ts:282
**Current behavior:** Pricing tiers/comparison table claim PRO+PREMIUM get 'New request notifications' (ko: '신규 상담요청 이메일 알림기능') and PREMIUM gets 'Real-time message alerts' (ko: '메시지 실시간 이메일 알림'). lib/email.ts contains only three email flows (verification code, notifyAdminsOfNewAdmin, password reset). sendPushToUsers is called only from pages/api/messages/index.ts:142 and pages/api/conversations/index.ts:217,344 (message/inquiry push for ALL users, not tier-gated). subscriptionTier is checked only for credit gating (FREE blocked at conversations/index.ts:242; PREMIUM unlimited at :282). No code path sends new-request notifications to brokers or tier-gated real-time email alerts; crons send nothing either.
**Expected behavior:** Paid plan features listed on the pricing page exist and are gated to the advertised tiers, or the rows are removed from the page.
**User impact:** Brokers pay $69-$129/mo partly for advertised notification features they will never receive — refund/chargeback and misleading-advertising exposure at launch.
**Technical cause:** Frontend marketing copy (tiers[].features in pages/pricing.tsx) was written ahead of backend implementation; there is no shared plan-feature definition between frontend and backend.
**Frontend impact:** Remove or re-label the two feature rows, or keep once backend ships.
**Backend impact:** If keeping the claims: implement broker new-request email/push fan-out on request approval gated to PRO/PREMIUM, and real-time message email alerts gated to PREMIUM.
**Database impact:** None for removal; notification preferences/log table if implementing.
**Exact recommended fix:** Before launch, delete the 'notifications' and 'realtimeAlerts' rows from tiers[] and comparisonRows in pages/pricing.tsx (and the pricing.feat_* locale keys), or implement and tier-gate the features server-side.
**Suggested test cases:**
- Subscribe a test broker to PRO; approve a new matching BorrowerRequest as admin; assert the broker receives the advertised notification (currently: nothing is sent).
- Subscribe to PREMIUM; have a borrower send a chat message; assert a real-time email alert is delivered (currently: only Expo push to mobile devices, identical for all tiers).
- Render /pricing and assert no feature row exists without a corresponding backend capability.

> Adversarial verification: **confirmed** (calibrated severity High). Every load-bearing assertion checks out. pages/pricing.tsx:90-94 (PRO) and :106-110 (PREMIUM) advertise notifications/realtimeAlerts features rendered via comparisonRows at :116-120; the ko strings (public/locales/ko/common.json:1430-1431) explicitly promise EMAIL alerts ("신규 상담요청 이메일 알림기능", "메시지 실시간 이메일 알림"), en strings at en/common.json:1430-1431. lib/email.ts contains only sendVerificationCode 

---

### 15. PostHog analytics initialized for every visitor with no consent banner or opt-out anywhere in the app

**Severity:** High  
**Feature area:** Privacy / PIPEDA / analytics  
**User type affected:** All  
**Status:** Needs manual verification  
**Launch blocker:** No  
**Implementation complexity:** Medium  
**Found by:** public-deploy

**Files:** instrumentation-client.ts, pages/_app.tsx, lib/posthog-server.ts, pages/privacy.tsx
**Line references:** instrumentation-client.ts:3-9, pages/_app.tsx:178 (<Analytics />), lib/posthog-server.ts:6-16
**Current behavior:** posthog.init() runs unconditionally on first load for every visitor (capture_exceptions: true, proxied via /ingest rewrites in next.config.mjs:48-59 which also evades ad-blockers). There is no consent banner, no opt_out call, no consent storage anywhere (grep for consent/CookieConsent across components/ and pages/ returns nothing). Vercel Analytics is also mounted unconditionally (cookieless, lower risk). The privacy page does disclose PostHog + Vercel Analytics (privacy.provider5*, privacy.data4Item2).
**Expected behavior:** For Canadian users (PIPEDA implied-consent baseline; Quebec Law 25 requires opt-in for non-essential cookies/trackers), analytics either starts in cookieless/memory mode until consent, or a consent banner gates posthog.opt_in_capturing().
**User impact:** Visitors — including borrowers entering sensitive financial flows — are tracked (with exception capture) before any consent interaction; regulatory exposure in Quebec specifically.
**Technical cause:** instrumentation-client.ts initializes PostHog at module load with no consent gate; no consent UI was ever built.
**Frontend impact:** Add a small bilingual consent banner; call posthog.opt_out_capturing() by default or init with persistence:'memory' until accepted.
**Backend impact:** None required.
**Database impact:** None (consent can live in localStorage/cookie).
**Exact recommended fix:** Initialize PostHog with opt_out_capturing_by_default (or persistence:'memory'+cookieless) and flip on via a bilingual consent banner; alternatively obtain a documented legal opinion that implied consent + privacy-page disclosure suffices for your launch provinces. Needs verification of actual PostHog cookie behavior under defaults:'2026-01-30' and of your target-province requirements.
**Suggested test cases:**
- Fresh incognito visit to mortly.ca: assert no ph_* cookie/localStorage entry before consent.
- Decline consent: assert no /ingest network requests on navigation.
- Accept consent: events flow; preference persists across reloads.
- Verify exception autocapture also respects the consent state.

> Adversarial verification: **confirmed** (calibrated severity High). Every cited fact holds. instrumentation-client.ts:3-9 calls posthog.init() unconditionally with capture_exceptions:true and no consent gate, no opt_out_capturing_by_default, no persistence:"memory", no cookieless_mode; with Next ^16.2.9 (package.json) this file is framework-auto-loaded on every browser page load, so it runs for all visitors including anonymous ones, and posthog-js default persiste

---

### 16. Logged-out visitors to /borrower/request/new get a blank page — homepage, how-it-works, and 404 CTAs all link there unconditionally

**Severity:** High  
**Feature area:** Request creation entry point  
**User type affected:** Borrower  
**Status:** Confirmed  
**Launch blocker:** Yes  
**Implementation complexity:** Small  
**Found by:** request-form — also reported by: gap:Borrower onboarding / first-run experience (checklist says onboarding for BOTH roles; only broker side was reviewed)

**Files:** pages/borrower/request/new.tsx, pages/index.tsx, pages/how-it-works.tsx, pages/404.tsx, components/borrower/BorrowerShell.tsx
**Line references:** pages/borrower/request/new.tsx:42-51, pages/index.tsx:289-294, pages/how-it-works.tsx:175-177, pages/404.tsx:27-29, components/borrower/BorrowerShell.tsx:80-86
**Current behavior:** new.tsx returns null when !session or role !== BORROWER (line 51) BEFORE rendering BorrowerShell. BorrowerShell owns the /login redirect (its useEffect at BorrowerShell.tsx:80-86), but since it never mounts/re-renders for the unauthenticated state, no redirect fires. There is no middleware.ts and the page uses getStaticProps (no server-side gate). The homepage primary CTA ('Get started free', index.tsx:291), how-it-works CTA, and 404 page all link directly to /borrower/request/new.
**Expected behavior:** Anonymous visitors clicking the main conversion CTA should be redirected to /login or /signup?role=borrower (as pages/for-borrowers.tsx:12 already does conditionally).
**User impact:** Anonymous visitors clicking the homepage's primary call-to-action see an entirely blank white page. Logged-in brokers hitting the 404 page's 'submit request' button also get a blank page.
**Technical cause:** Early `return null` in the page component before the auth-gating shell mounts; gate comment ('Auth gate handled by <BorrowerShell> upstream') is wrong for this code path because the shell unmounts when the parent returns null.
**Frontend impact:** Move the role gate inside BorrowerShell rendering, or add an explicit router.replace('/login') effect in new.tsx, or make marketing CTAs conditional on session like for-borrowers.tsx.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** In new.tsx, render <BorrowerShell> unconditionally (it already redirects), or add useEffect(() => { if (status !== 'loading' && (!session || session.user.role !== 'BORROWER')) router.replace('/login'); }). Also make index.tsx/how-it-works.tsx/404.tsx CTAs session-aware.
**Suggested test cases:**
- Visit /borrower/request/new logged out → expect redirect to /login, not blank page
- Visit as logged-in BROKER → expect redirect, not blank page
- Click homepage 'Get started free' CTA while logged out → reaches signup/login

> Adversarial verification: **confirmed** (calibrated severity High). I attempted to refute this and could not — every element of the claim checks out against the code.

1. The broken gate is real. /Users/hyunseokcho/Documents/GitHub/mortly/pages/borrower/request/new.tsx:50-51 reads `// Auth gate handled by <BorrowerShell> upstream.` followed by `if (!session || session.user.role !== "BORROWER") return null;`. The comment is wrong: BorrowerShell is a CHILD of this p

---

### 17. Edit flow always fails with 409 once a request has any conversation — client sends the full form, server requires notes/timeline-only payload

**Severity:** High  
**Feature area:** Request edit  
**User type affected:** Borrower  
**Status:** Confirmed  
**Launch blocker:** Yes  
**Implementation complexity:** Medium  
**Found by:** request-form — also reported by: borrower-flow

**Files:** pages/api/requests/[id].ts, pages/borrower/request/[id].tsx, components/RequestForm.tsx
**Line references:** pages/api/requests/[id].ts:177-191, pages/borrower/request/[id].tsx:97-114, pages/borrower/request/[id].tsx:149, pages/borrower/request/[id].tsx:207-214, components/RequestForm.tsx:296-341
**Current behavior:** PATCH allows only 'cosmetic' edits (notes, desiredTimeline) when request._count.conversations > 0, detected by checking that mortgageCategory/productTypes/province/city/details are all === undefined. But RequestForm submits the entire CreateRequestInput (every key defined), and [id].tsx handleEdit PATCHes it verbatim. Conversations do NOT change request status from OPEN (verified: nothing in pages/api/conversations/index.ts sets IN_PROGRESS), so isEditable stays true and the Edit button remains visible. Result: every save attempt returns 409 with a hardcoded English error.
**Expected behavior:** Borrower can edit notes/timeline on a request with conversations (the server's stated intent), or the Edit button is hidden/limited once conversations exist.
**User impact:** As soon as one broker spends a credit to contact the borrower, the borrower can no longer edit ANYTHING — clicking the visible Edit button, changing only notes, and saving yields an English-only error ('This request has active conversations — only notes and desired timeline can be updated...') even in the Korean UI.
**Technical cause:** Frontend always sends full payload; backend uses key-presence (undefined) to distinguish cosmetic edits; no diffing.
**Frontend impact:** Either send only changed fields from the edit page, or render a notes/timeline-only edit form when convoCount > 0.
**Backend impact:** Alternatively compare submitted values against stored values and allow no-op fields through.
**Database impact:** None.
**Exact recommended fix:** In pages/borrower/request/[id].tsx handleEdit, diff data against the loaded request and send only changed keys; hide or scope the Edit UI when convoCount > 0; localize the 409 message.
**Suggested test cases:**
- PATCH full unchanged payload for a request with 1 conversation → currently 409 (should succeed or be prevented in UI)
- Edit notes only via UI on a request with a conversation → save succeeds
- Edit productTypes on a request with a conversation → blocked with localized message

> Adversarial verification: **confirmed** (calibrated severity High). I attempted to refute this and could not — every link in the claimed chain holds.

1. Server gate works on key-presence, not diffing. /Users/hyunseokcho/Documents/GitHub/mortly/pages/api/requests/[id].ts:177-191: when request._count.conversations > 0, the PATCH is rejected with a 409 unless mortgageCategory, productTypes, province, city, AND details are all `=== undefined` in req.body. The 409 bod

---

### 18. sessionStorage draft restore loses income data and can submit stale year amounts

**Severity:** High  
**Feature area:** Request form draft persistence  
**User type affected:** Borrower  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** request-form

**Files:** components/RequestForm.tsx
**Line references:** components/RequestForm.tsx:85-108, components/RequestForm.tsx:141-153, components/RequestForm.tsx:208-224, components/RequestForm.tsx:226-245, components/RequestForm.tsx:253-268
**Current behavior:** The draft restores form.details.annualIncome (e.g. {"2026": "100,000"}) from sessionStorage, but incomeYear1/incomeYear2/corpYear1/corpYear2 are initialized ONLY from initialValues (undefined in create mode) → both ''. After a refresh: (1) income inputs render annualIncome[''] = empty, so the user's entered amounts are invisible; (2) isStep2Valid fails (incomeYear1 === ''), forcing re-entry; (3) re-selecting the same year calls changeIncomeYear('', '2026', ...) which sets annualIncome['2026'] = '' — OVERWRITING the restored '100,000'; (4) selecting a different year (e.g. 2025) leaves the orphaned {"2026": "100,000"} in the record, which is submitted and displayed to brokers as a second income year the user never confirmed.
**Expected behavior:** Draft restore reproduces the exact pre-refresh state including selected years and amounts.
**User impact:** Borrowers who refresh mid-form (the exact complaint the feature was built for, per the comment at lines 82-84) silently lose income figures or submit stale/duplicate year data — wrong financial data shown to paying brokers.
**Technical cause:** Derived state (year selectors) lives outside the persisted `form` object and is rehydrated from initialValues instead of the restored draft.
**Frontend impact:** Initialize incomeYear1/2 and corpYear1/2 from the restored form.details (Object.keys of annualIncome/corporateAnnualIncome) when no initialValues, or persist the year-selector state alongside the draft.
**Backend impact:** Optional: server-side validation of annualIncome would catch empty/orphaned entries.
**Database impact:** Stale year keys stored in details JSON.
**Exact recommended fix:** Derive existingYears from the actual initial form state (restored draft OR initialValues), e.g. compute from `form.details` in the same lazy initializer; also prune empty-string year entries before submit.
**Suggested test cases:**
- Fill residential income for 2026, reload page → year select shows 2026 and amount intact
- Reload, pick 2025, fill amount, submit → payload contains only 2025 (no orphaned 2026)
- Same flow for commercial corporate income/expenses

> Adversarial verification: **confirmed** (calibrated severity High). All four claimed behaviors verified in code. (1) components/RequestForm.tsx:86-108 rehydrates `form` (incl. details.annualIncome) from sessionStorage in create mode, but incomeYear1/2 (lines 142-146) and corpYear1/2 (149-153) initialize only from `initialValues` (undefined in create mode) → all "". No effect re-syncs them from the draft; the line-140 comment promising a "default to last 2 years" i

---

### 19. ~385 translation keys missing from BOTH en and ko common.json — authed app surfaces render single-language fallback text in both locales

**Severity:** High  
**Feature area:** i18n / all authed pages  
**User type affected:** All  
**Status:** Confirmed  
**Launch blocker:** Yes  
**Implementation complexity:** Medium  
**Found by:** ux-states — also reported by: borrower-flow, broker-flow, gap:Borrower onboarding / first-run experience (checklist says onboarding for BOTH roles; only broker side was reviewed), gap:File upload / document handling (beyond broker profile photo), gap:Mobile responsiveness of borrower/broker (non-admin) authed surfaces, especially chat, i18n

**Files:** public/locales/en/common.json, public/locales/ko/common.json, pages/borrower/dashboard.tsx, pages/broker/dashboard.tsx, pages/broker/requests/index.tsx, pages/broker/requests/[id].tsx, pages/admin/inbox.tsx, pages/admin/people.tsx, pages/admin/activity.tsx, pages/admin/reports.tsx, pages/admin/system.tsx, pages/admin/users/[id].tsx, pages/admin/brokers/[id].tsx, pages/admin/conversations/[id].tsx, components/admin/AdminShell.tsx, components/admin/CommandPalette.tsx, components/borrower/RequestFormLayout.tsx, components/broker/RequestContextPanel.tsx, components/DeleteAccountSection.tsx, pages/login.tsx
**Line references:** pages/borrower/dashboard.tsx:141-149, pages/broker/dashboard.tsx:184-206, pages/broker/requests/index.tsx:227-229, pages/borrower/dashboard.tsx:487, pages/login.tsx:64-69
**Current behavior:** A script scan of every t("key", fallback) call in pages/ and components/ found 385 keys absent from both locale files. i18next renders the inline fallback for BOTH locales, and fallbacks are mixed-language: Korean fallbacks (e.g. borrower.welcome '안녕하세요,', broker.respond '상담 시작', broker.findRequests '상담 찾기') appear in the English UI, while English fallbacks (e.g. broker.goToRequests 'Browse all', common.refresh 'Refresh', status.title 'Status', broker.responsesSuffix 'responses', auth.tooManyAttempts) appear in the Korean UI.
**Expected behavior:** Every user-facing key exists in both public/locales/en/common.json and public/locales/ko/common.json so each locale renders its own language.
**User impact:** English-locale borrowers/brokers see Korean headlines and CTAs on the dashboard and request pages; Korean users see scattered English labels. The admin app is effectively Korean-only with no EN coverage. Core bilingual product promise is broken on the most-used screens.
**Technical cause:** The redesigned borrower/broker shells and the entire admin Phase 1-7 rewrite introduced new key namespaces (borrower.*, broker.col.*, admin.*) with inline fallbacks but the keys were never added to the locale JSON files.
**Frontend impact:** Add 385 keys; no component changes needed since t() calls are already in place.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Generate the missing key list (the regex scan in this audit reproduces it), add EN+KO values to common.json, and add a CI test that extracts t() keys and asserts presence in both locale files.
**Suggested test cases:**
- Render borrower dashboard with locale=en and assert no Hangul appears in static chrome
- Render broker requests page with locale=ko and assert no English fallback strings ('Refresh', 'Only unresponded')
- CI script: every t() key referenced in pages/components exists in en and ko common.json

> Note: Independently reproduced by 4 reviewers and 2 verifiers (counts 343-385 depending on extraction method; superset is ~385: ~270 admin.*, ~115 user-facing).

> Adversarial verification: **confirmed** (calibrated severity High). Independent scan reproduces the claim exactly: 385 keys used in t() calls across pages/ and components/ are missing from BOTH public/locales/en/common.json and public/locales/ko/common.json (each file has 1819 flattened keys; 383 of the missing keys have inline string fallbacks, 2 would render the raw key). The i18n stack is plain next-i18next (appWithTranslation at pages/_app.tsx:183; pages load 

---

### 20. In-app notifications dropdown unreachable on mobile (dead button)

**Severity:** High  
**Feature area:** Notifications / Navbar  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** ux-states — also reported by: gap:Mobile responsiveness of borrower/broker (non-admin) authed surfaces, especially chat

**Files:** components/Navbar.tsx
**Line references:** components/Navbar.tsx:184, components/Navbar.tsx:219-294, components/Navbar.tsx:455-470
**Current behavior:** The notification bell and its dropdown (lines 219-294) live inside `<div className="hidden items-center gap-1 md:flex">` (line 184), so below the md breakpoint they are display:none. The mobile menu renders a separate 'Notifications' button (455-470) whose onClick does `setMobileOpen(false); setNoticeOpen(!noticeOpen)` — it closes the menu and toggles state for a dropdown that cannot render on mobile. Nothing visible happens.
**Expected behavior:** Tapping Notifications on mobile opens a notice list (sheet/drawer or full-screen list).
**User impact:** Mobile users (the primary device class for a consumer marketplace) can never read AdminNotice messages; unread badge increments with no way to view or clear them.
**Technical cause:** Dropdown markup is colocated inside the desktop-only flex container; the mobile button toggles state with no mobile presentation.
**Frontend impact:** Render a mobile notices sheet (reuse the dropdown list markup) outside the hidden md:flex container, or route to a /notifications view.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Move the dropdown out of the desktop-only container and present it as a full-width sheet under the mobile menu; also consider surfacing the bell inside BorrowerShell/BrokerShell since the marketing Navbar is not mounted on shell pages.
**Suggested test cases:**
- 375px viewport, logged-in borrower with 1 unread notice: tap menu → Notifications → list visible
- Mark-as-read works from mobile

> Adversarial verification: **confirmed** (calibrated severity High). The claim holds at every cited line and I found no mitigating code elsewhere.

1. Desktop-only container: components/Navbar.tsx:184 is `<div className="hidden items-center gap-1 md:flex">`. tailwind.config.ts has no `screens` override, so this is standard Tailwind: display:none below 768px, flex at md+.

2. Dropdown is colocated inside it: the bell button (lines 220-238) and the sole `{noticeOpen 

---

### 21. Shared Btn as="a" renders plain <a> — drops locale prefix (EN users reset to Korean) and forces full page reloads on 19 primary CTAs

**Severity:** High  
**Feature area:** Navigation / i18n routing  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** ux-states — also reported by: broker-flow, gap:Borrower onboarding / first-run experience (checklist says onboarding for BOTH roles; only broker side was reviewed)

**Files:** components/broker/ui/index.tsx, pages/borrower/dashboard.tsx, pages/broker/dashboard.tsx, pages/broker/requests/[id].tsx, pages/broker/requests/index.tsx, pages/borrower/request/new.tsx
**Line references:** components/broker/ui/index.tsx:144-157, pages/borrower/dashboard.tsx:147-149, pages/broker/dashboard.tsx:204-206, pages/broker/requests/[id].tsx:155-157
**Current behavior:** Btn with as="a"/href returns a raw `<a href={href}>` instead of next/link. With i18n defaultLocale 'ko' and localeDetection false (next-i18next.config.js:3-7), an English user on /en/borrower/dashboard clicking '+ New request' (href=/borrower/request/new) hard-navigates to the Korean default-locale page. 19 usages across borrower/broker dashboards, request detail, billing CTAs.
**Expected behavior:** Client-side navigation that preserves the active locale (next/link auto-prefixes locale).
**User impact:** English users are silently switched back to Korean on most in-app buttons; every CTA is a full document reload (lost scroll/state, slower).
**Technical cause:** components/broker/ui/index.tsx:144-157 deliberately renders <a> for the as="a" branch.
**Frontend impact:** Swap the anchor branch to next/link (keeps className contract); no call-site changes.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** In Btn, render `<Link href={href} className={classes}>` for the anchor branch.
**Suggested test cases:**
- With locale=en, click 'New request' on borrower dashboard → URL stays under /en/
- Navigation does not trigger full document reload (router event fired)

> Adversarial verification: **confirmed** (calibrated severity High). Confirmed at every level. (1) components/broker/ui/index.tsx:144-158 — the `as === "a" || href` branch of Btn returns a raw `<a href={href}>` (anchor rendered at 149-157), not next/link; plain anchors bypass the Next client router, causing full page reloads and using the href verbatim. (2) next.config.mjs:9 imports i18n from next-i18next.config.js:3-7 (defaultLocale "ko", localeDetection: false), 

---



## Medium issues (70)

### 1. Credit adjustment has no UI — API exists but the palette action dead-ends

**Severity:** Medium  
**Feature area:** Credits management  
**User type affected:** Admin  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** admin

**Files:** pages/api/admin/credits.ts, components/admin/CommandPalette.tsx, pages/admin/users/[id].tsx, pages/admin/brokers/[id].tsx
**Line references:** components/admin/CommandPalette.tsx:171-174, pages/api/admin/credits.ts:4-70
**Current behavior:** grep shows /api/admin/credits is referenced only by tests. CommandPalette's '크레딧 조정' action routes to /admin/users/[publicId] where no credit modal exists; the broker detail page shows the balance read-only. The API itself is well-guarded (non-zero integer, |amount| ≤ 10,000, negative-balance guard at credits.ts:32-36, audit row with previous/new balance).
**Expected behavior:** A credit-adjust modal (amount + required reason) on broker/user detail pages wired to POST /api/admin/credits.
**User impact:** Admins cannot grant goodwill credits or correct Stripe mishaps without raw API calls — a routine support operation on this product.
**Technical cause:** The legacy modal was removed in the admin rewrite ('two bespoke modals totalling ~500 LOC; those are gone' — users/[id].tsx:33-35) without re-implementing credits.
**Frontend impact:** Add modal to pages/admin/brokers/[id].tsx (and/or users/[id].tsx); palette can keep routing there.
**Backend impact:** None — endpoint ready. Optionally add validateText cap on reason and buildAdminActionCreate meta (currently absent, credits.ts:50-63).
**Database impact:** None.
**Exact recommended fix:** Build the modal; pass reason through; cap reason with MAX_REASON_LEN.
**Suggested test cases:**
- Adjust +5 shows new balance and audit row
- Removing more than balance returns 400 with friendly message
- Reason over 500 chars rejected

> Adversarial verification: **confirmed** (calibrated severity Medium). Every element of the claim holds. (1) /api/admin/credits is referenced only by tests (tests/integration/api/admin/credits.test.ts, tests/integration/api/auth/session-edge.test.ts:31, tests/invariants/marketplace.test.ts:48) — no page or component calls it. (2) CommandPalette.tsx:171-174 routes the '크레딧 조정' action to /admin/users/[publicId], and the file's header comment (lines 18-21) falsely state

---

### 2. System settings page renders two fields the API rejects — saving them 400s the entire batch

**Severity:** Medium  
**Feature area:** System settings  
**User type affected:** Admin  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** admin

**Files:** pages/admin/system.tsx, pages/api/admin/settings.ts, lib/settings.ts
**Line references:** pages/admin/system.tsx:28-37, pages/api/admin/settings.ts:22-43, lib/settings.ts:5-16
**Current behavior:** SETTING_FIELDS includes platform_name and support_email (system.tsx:29-30) but ALLOWED_KEYS in the API (settings.ts:22-30) does not. The handler rejects the whole request on the first unknown key ('Unknown setting: platform_name'), so any save that touches those fields silently discards every other change too. They also always render empty since no DB row or DEFAULTS entry exists. Conversely broker_initial_message_limit (allowed, consumed by pages/api/messages/index.ts:86) and request_retention_days (consumed by pages/api/cron/purge-expired.ts:28, not even allowed by the API) cannot be edited anywhere.
**Expected behavior:** UI fields and the API allowlist match; PIPEDA retention and the broker message limit are editable; or ghost fields are removed.
**User impact:** Admin edits 'Platform name', clicks save, gets an error, and loses all other staged changes. Retention policy is frozen at the 180-day default.
**Technical cause:** UI field list drifted from the API allowlist and lib/settings DEFAULTS.
**Frontend impact:** Remove platform_name/support_email or add them server-side; add the two missing editable keys.
**Backend impact:** Add per-key type validation (integer keys parse as int, maintenance_mode in {true,false}) — currently any ≤500-char string is accepted and getSettingInt (lib/settings.ts:77-87) will later throw inside crons/Stripe webhook paths.
**Database impact:** None.
**Exact recommended fix:** Single source of truth for the settings schema (key, type, validator) shared by UI and API; validate values per key in the PUT handler.
**Suggested test cases:**
- Save with platform_name present → currently 400; after fix, succeeds or field gone
- PUT maintenance_mode='yes' rejected
- PUT request_expiry_days='abc' rejected before it can break the expiry cron

> Adversarial verification: **confirmed** (calibrated severity Medium). Core drift claim confirmed. pages/admin/system.tsx:29-30 renders platform_name and support_email in SETTING_FIELDS, but pages/api/admin/settings.ts:22-30 ALLOWED_KEYS omits them; settings.ts:37-39 returns 400 on the first unknown key before the upsert transaction (line 46), and the UI batches all changed keys into one PUT (system.tsx:114-121), so any save touching a ghost field rejects the entire 

---

### 3. Maintenance mode is client-side cosmetic only — APIs and direct clients are unaffected

**Severity:** Medium  
**Feature area:** Maintenance mode  
**User type affected:** All  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** admin

**Files:** pages/_app.tsx, pages/api/maintenance.ts, lib/settings.ts
**Line references:** pages/_app.tsx:74-115, pages/api/maintenance.ts:4-11
**Current behavior:** MaintenanceGate fetches /api/maintenance in a client useEffect and swaps the UI for non-admins. All API routes keep serving (request creation, chat, Stripe flows); pages render normally until `checked` flips (brief flash of real content); the mobile app and any direct API caller bypass entirely unless they implement their own check. The s-maxage=30 cache means up to ~90s propagation.
**Expected behavior:** If maintenance mode must actually stop traffic, mutating API routes should consult getSettingBool('maintenance_mode') (e.g., in withAuth) and return 503 for non-admins.
**User impact:** During an incident admins cannot actually freeze writes — users mid-session continue creating requests/messages against a system being repaired.
**Technical cause:** Gate implemented only in the React tree.
**Frontend impact:** None (existing gate is fine as the UX layer).
**Backend impact:** Add a maintenance check to withAuth (or a shared middleware) for mutating verbs, excluding ADMIN role and auth endpoints.
**Database impact:** None.
**Exact recommended fix:** Server-side 503 gate on mutations when maintenance_mode=true, role!=ADMIN.
**Suggested test cases:**
- maintenance on: borrower POST /api/requests → 503
- admin POST still works
- login still works

> Adversarial verification: **confirmed** (calibrated severity Medium). Every factual assertion holds. (1) The gate is purely client-side: pages/_app.tsx:74-115 fetches /api/maintenance in a useEffect (lines 81-87) and swaps UI only when `checked && maintenance && !isAdmin && !isAuthRoute && !isApiRoute` (line 97); `checked` starts false (line 79), so real content flashes before the fetch resolves. (2) No server-side enforcement exists anywhere: a repo-wide grep shows

---

### 4. Two-admin broker verification: 202 PENDING_SECOND_REVIEW is rendered as success, and recommendations never expire

**Severity:** Medium  
**Feature area:** Broker verification  
**User type affected:** Admin  
**Status:** Needs manual verification  
**Launch blocker:** No  
**Implementation complexity:** Medium  
**Found by:** admin

**Files:** pages/api/admin/brokers/[id].ts, pages/admin/inbox.tsx, pages/admin/brokers/[id].tsx
**Line references:** pages/api/admin/brokers/[id].ts:84-115, pages/admin/inbox.tsx:110-118, pages/admin/brokers/[id].tsx:117-139
**Current behavior:** With BROKER_VERIFY_REQUIRES_TWO_ADMINS=true (env value not visible from code; only referenced in this one file), a first VERIFIED PUT returns 202 with status PENDING_SECOND_REVIEW. Both callers test only r.ok, so the inbox UndoToast says '승인됨' and brokers/[id].tsx toasts '변경 완료' while the broker remains PENDING and the row reappears. Additionally the gate query (lines 86-94) accepts ANY prior RECOMMEND_VERIFY_BROKER row by another admin with no recency bound and never consumes it — one stale recommendation satisfies all future verifications of that broker, including after a REJECTED→PENDING reset.
**Expected behavior:** Frontend distinguishes 202 and explains second review is needed; recommendations expire (e.g., 7 days) and are consumed or invalidated on verification/reset.
**User impact:** Admins believe verification completed; brokers stay unverified, blocking their request browsing (requests/index.ts:24 requires VERIFIED). The control's dual-review guarantee also weakens over time.
**Technical cause:** Status-code-blind success handling; recommendation lookup lacks createdAt bound and consumption.
**Frontend impact:** Handle 202 explicitly with a distinct toast in inbox.tsx and brokers/[id].tsx.
**Backend impact:** Add createdAt >= now-7d filter and write a consuming marker (or compare against last RESET/REJECT action).
**Database impact:** None (AdminAction reused).
**Exact recommended fix:** As above; also confirm in Vercel whether the env flag is set in production.
**Suggested test cases:**
- Flag on: first VERIFY → UI shows 'second admin required'
- Same admin retries → still 202
- Different admin → VERIFIED
- Recommendation older than TTL ignored

> Adversarial verification: **confirmed** (calibrated severity Medium). All three legs of the claim verified against the code. (1) pages/api/admin/brokers/[id].ts:84-114: with BROKER_VERIFY_REQUIRES_TWO_ADMINS="true", a first VERIFIED PUT creates a RECOMMEND_VERIFY_BROKER AdminAction and returns 202 {status:"PENDING_SECOND_REVIEW"} WITHOUT updating broker.verificationStatus (the update transaction at lines 123-141 is only reached when the gate passes). (2) Both caller

---

### 5. Inbox undo grace period silently drops decisions if the admin navigates away

**Severity:** Medium  
**Feature area:** Admin inbox  
**User type affected:** Admin  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** admin

**Files:** components/admin/UndoToast.tsx, pages/admin/inbox.tsx
**Line references:** components/admin/UndoToast.tsx:23-37, pages/admin/inbox.tsx:143-152, pages/admin/inbox.tsx:308-331
**Current behavior:** Approve/reject only fires the API call after UndoToast's 3s interval invokes onCommit. The useEffect cleanup clears the interval on unmount, so any route change (rail nav, 'E' to open detail, tab close) within the grace window cancels the commit with no error. The row was optimistically hidden, so the admin saw it disappear and assumes it was processed; it reappears on the next poll.
**Expected behavior:** Pending decisions flush on unmount (commit in the cleanup) or block navigation until committed.
**User impact:** Moderation decisions are randomly lost; pending broker verifications/request approvals linger despite the admin processing them.
**Technical cause:** Timer-based deferred commit without an unmount flush or beforeunload handler.
**Frontend impact:** In UndoToast cleanup: if not committed/undone, call onCommit synchronously (fire-and-forget). Optionally use navigator.sendBeacon for tab close.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Flush-on-unmount in UndoToast; keep Esc/undo semantics.
**Suggested test cases:**
- Approve then immediately click People → request still becomes OPEN
- Approve then Esc → request stays PENDING
- Approve and wait 3s → commits once (no double fire)

> Adversarial verification: **confirmed** (calibrated severity Medium). Confirmed at every cited location. UndoToast.tsx:23-37: onCommit is invoked only from the setInterval tick when remaining hits 0 (line 30); the effect cleanup is a bare clearInterval (line 36) with no unmount flush and no beforeunload handler, so unmounting within the 3s grace window drops the commit silently. inbox.tsx:143-152: requestDecision only sets hiddenIds (optimistic hide) + pending; the 

---

### 6. Banning/suspending a borrower does not cascade: their OPEN requests stay in the broker marketplace and conversations stay ACTIVE

**Severity:** Medium  
**Feature area:** User suspend/ban  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Medium  
**Found by:** admin

**Files:** pages/api/admin/users/[id].ts, pages/api/requests/index.ts, pages/api/messages/index.ts
**Line references:** pages/api/admin/users/[id].ts:156-182, pages/api/requests/index.ts:26-27, pages/api/messages/index.ts:60-75
**Current behavior:** Ban/suspend updates user.status and bumps tokenVersion (the target is locked out immediately — verified in lib/auth.ts:312-313). But the broker marketplace query filters only `where.status = 'OPEN'` with no borrower.status condition, so a banned borrower's requests remain listed and contactable; brokers can still spend credits/initiate conversations with someone who can never reply. Existing ACTIVE conversations remain open (only the userBlock check at messages/index.ts:65-75 stops messages, not account status).
**Expected behavior:** On BAN (at minimum): close or hide the user's OPEN/IN_PROGRESS requests and close their ACTIVE conversations, or filter borrower.status in the marketplace query.
**User impact:** Brokers waste paid responseCredits contacting banned users; spam/fraud content an admin tried to remove stays visible.
**Technical cause:** Status change handler performs no cascade and read paths don't join on borrower status.
**Frontend impact:** None.
**Backend impact:** Either add `borrower: { status: 'ACTIVE' }` to the broker request-list where clause, or cascade-close in the ban transaction (mirroring the CLOSED cascade in admin/requests/[id].ts:97-121).
**Database impact:** Bulk status updates inside the existing transaction.
**Exact recommended fix:** Filter marketplace by borrower status (cheap, reversible on reactivate) and close ACTIVE conversations on BAN with a system message.
**Suggested test cases:**
- Ban borrower → their OPEN request no longer appears in broker list
- Reactivate → request visible again
- Broker in existing thread with banned borrower sees it closed/system message

> Adversarial verification: **confirmed** (calibrated severity Medium). All four legs of the claim hold against the code. (1) The ban/suspend handler at pages/api/admin/users/[id].ts:158-182 runs a transaction containing only prisma.user.update (status + tokenVersion increment, :159-172) and prisma.adminAction.create (:173-181) — no cascade to borrowerRequest or conversation; the bulk endpoint pages/api/admin/users/bulk.ts:111 has the same gap. (2) The broker marketpl

---

### 7. Broker users' conversations are fetched by the user-detail API but never rendered by the page

**Severity:** Medium  
**Feature area:** User management  
**User type affected:** Admin  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** admin

**Files:** pages/api/admin/users/[id].ts, pages/admin/users/[id].tsx
**Line references:** pages/api/admin/users/[id].ts:40-66, pages/admin/users/[id].tsx:60-90, pages/admin/users/[id].tsx:277-281
**Current behavior:** The API deliberately includes broker.conversations (comment at users/[id].ts:41-45: 'Surface them here so the admin user-detail page can render conversations for broker users'). The page's UserDetail interface omits broker.conversations and RecentConversationsTable receives user.conversations — the borrower-side relation, which is empty for brokers — so the section silently disappears (it returns null when empty) for every broker.
**Expected behavior:** For BROKER users, render broker.conversations; counts already come from _count.
**User impact:** Admins investigating a reported broker from the user page see no conversation history and may conclude there is none.
**Technical cause:** Frontend type/render not updated when the backend added the relation.
**Frontend impact:** Pass `user.role === 'BROKER' && user.broker ? user.broker.conversations : user.conversations` into RecentConversationsTable and extend the interface.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** As above; tests/admin/users-detail.test.tsx should add a broker-user fixture.
**Suggested test cases:**
- Broker user with 3 conversations shows them
- Borrower unchanged
- Broker with none shows nothing (no crash)

> Adversarial verification: **confirmed** (calibrated severity Medium). Confirmed at every cited location. The API (pages/api/admin/users/[id].ts:42-65) deliberately selects broker.conversations with a comment stating the admin user-detail page should render them. Prisma schema confirms User.conversations (schema.prisma:37) is the borrower-side relation (Conversation.borrowerId -> User, schema.prisma:187) while Broker.conversations (schema.prisma:145) is the broker-si

---

### 8. Login brute-force protection strength depends on Vercel KV being provisioned in production

**Severity:** Medium  
**Feature area:** Authentication / rate limiting  
**User type affected:** All  
**Status:** Needs manual verification  
**Launch blocker:** Yes  
**Implementation complexity:** Small  
**Found by:** auth-core — also reported by: auth-recovery

**Files:** pages/api/auth/[...nextauth].ts, lib/rate-limit.ts
**Line references:** pages/api/auth/[...nextauth].ts:13-50, lib/rate-limit.ts:109-124, lib/rate-limit.ts:205-209
**Current behavior:** The credentials-callback wrapper enforces per-IP (30) and per-email (5) caps per 15min via checkRateLimit. checkRateLimit only uses the durable KV backend when KV_REST_API_URL is set; otherwise it falls back to a per-lambda in-memory Map. The fallback is bounded (does NOT fail open) but limits multiply with the number of warm serverless instances.
**Expected behavior:** In production the per-IP/per-email caps should be globally consistent (one counter per key) so an attacker cannot get N*limit attempts by spreading requests across warm lambdas.
**User impact:** Borrower financial PII sits behind these accounts; weak/inconsistent caps make credential-stuffing and single-victim password-spraying easier. The prior security audit flagged login brute-force as a launch blocker.
**Technical cause:** KV is optional at runtime; warnOnceIfNoKv only logs. Effective limit = configured limit * warm instance count when KV is absent.
**Frontend impact:** None.
**Backend impact:** Must confirm KV_REST_API_URL + KV_REST_API_TOKEN are set in the production Vercel project.
**Database impact:** None.
**Exact recommended fix:** Provision Vercel KV for production and verify KV_REST_API_URL is present; optionally hard-fail boot in production if it is missing rather than only logging.
**Suggested test cases:**
- With KV unset, confirm per-email cap is enforced per lambda (degraded)
- With KV set, confirm 6th attempt for one email within 15min returns 429 regardless of which instance serves it

> Note: Calibrated down from High by the verifier: the in-memory fallback is bounded (does not fail open); the residual risk is limit multiplication across warm lambdas.

> Adversarial verification: **confirmed** (calibrated severity Medium). Every code-level assertion in the claim is accurate. pages/api/auth/[...nextauth].ts:13-15 defines LOGIN_PER_IP=30, LOGIN_PER_EMAIL=5 over a 15-min window, and lines 24-50 enforce them on POST /callback/credentials via checkRateLimit. lib/rate-limit.ts:109 gates the durable backend on Boolean(process.env.KV_REST_API_URL); checkRateLimit (lines 205-209) falls back to checkInMemory (per-lambda Map, 

---

### 9. Borrower and broker pages are protected only by client-side guards (no SSR gate)

**Severity:** Medium  
**Feature area:** Role-based page protection  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Medium  
**Found by:** auth-core — also reported by: borrower-flow

**Files:** components/borrower/BorrowerShell.tsx, components/broker/BrokerShell.tsx, components/borrower/BorrowerDataContext.tsx, components/broker/BrokerDataContext.tsx, pages/borrower/dashboard.tsx, pages/borrower/request/[id].tsx
**Line references:** components/borrower/BorrowerShell.tsx:79-85, components/borrower/BorrowerShell.tsx:104-118, components/broker/BrokerShell.tsx:107-113, components/broker/BrokerShell.tsx:132-143, pages/borrower/dashboard.tsx:645, pages/borrower/request/[id].tsx:44-50
**Current behavior:** Unlike /admin/* (gated by adminSSR server-side, lib/admin/ssrAuth.ts:24-47), every /borrower/* and /broker/* page uses getStaticProps or a getServerSideProps that returns only translations. Auth/role is enforced in a useEffect inside BorrowerShell/BrokerShell and the data contexts, which router.replace('/login') after hydration.
**Expected behavior:** For consistency and defense-in-depth, role-gated pages should reject unauthenticated/wrong-role requests at render time (SSR) like the admin section does.
**User impact:** An anonymous or wrong-role user receives the page HTML shell and a brief loading state before the client redirect. No sensitive data is exposed because all data is fetched from withAuth-protected APIs, but the protection is weaker and flashes UI.
**Technical cause:** Pages intentionally use static generation; the only auth enforcement is client-side in the Shell components and contexts.
**Frontend impact:** Flash of shell/loading before redirect; back-button can briefly re-show.
**Backend impact:** None; APIs are independently protected by withAuth.
**Database impact:** None.
**Exact recommended fix:** Add a shared borrowerSSR()/brokerSSR() mirroring adminSSR() and use it on borrower/broker pages, or add a middleware matcher for /borrower and /broker that checks the session token server-side.
**Suggested test cases:**
- Anon GET /broker/dashboard returns a redirect (or login) without rendering broker chrome
- Borrower GET /broker/dashboard does not render broker UI

> Adversarial verification: **confirmed** (calibrated severity Medium). Confirmed at every cited location. components/borrower/BorrowerShell.tsx:79-85 and components/broker/BrokerShell.tsx:107-113 enforce auth/role only in a client useEffect (router.replace("/login") after hydration), with loading-screen fallbacks at lines 104-118 / 132-143. pages/borrower/dashboard.tsx:645-649 uses getStaticProps with translations only; pages/borrower/request/[id].tsx:44-50 uses getS

---

### 10. Resend-code failures (including email-send 502) shown as success 'New code sent'

**Severity:** Medium  
**Feature area:** Email verification / resend code  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** auth-recovery — also reported by: gap:Borrower onboarding / first-run experience (checklist says onboarding for BOTH roles; only broker side was reviewed), ux-states

**Files:** pages/verify-email.tsx, pages/api/auth/resend-code.ts
**Line references:** pages/verify-email.tsx:94-119, pages/api/auth/resend-code.ts:30-31, pages/api/auth/resend-code.ts:77, pages/api/auth/resend-code.ts:83
**Current behavior:** handleResend only special-cases res.status === 429. Any other non-OK response — 400 (invalid email), 502 (Resend send failure), 500 — falls through to setCountdown(60) + setSuccess(t('auth.codeSent')), showing a green 'New code sent.' banner even though no code was sent.
**Expected behavior:** Check res.ok; on 502/500 show a localized 'failed to send, try again' error; on 400 show an appropriate error; only show success and reset inputs on 200.
**User impact:** A new user whose verification email fails to send (Resend outage/misconfig) is told the code was sent, waits, retries, and can never verify or log in — silent abandonment of the only path into the product for credentials signups.
**Technical cause:** Missing res.ok check in the fetch handler; backend returns 502 {message} on sendVerificationCode failure but the frontend ignores everything except 429.
**Frontend impact:** Add res.ok branch and an error state with localized message in pages/verify-email.tsx handleResend.
**Backend impact:** None required; resend-code.ts already returns distinct 502/400/500 codes.
**Database impact:** None. Note the code/expiry were already rotated in DB before the failed send (resend-code.ts:63-71), so the old emailed code is also invalidated.
**Exact recommended fix:** In handleResend: const data = await res.json(); if (!res.ok) { if (res.status===429) {countdown} else setError(t('auth.resendFailed', ...)); return; } then success path. Add auth.resendFailed key to both locale files.
**Suggested test cases:**
- Mock /api/auth/resend-code returning 502 → page shows error, not 'New code sent'
- Mock 429 with retryAfter → countdown set to retryAfter
- Mock 200 → success banner, inputs cleared, countdown 60

> Adversarial verification: **confirmed** (calibrated severity Medium). The frontend claim holds exactly as cited. In /Users/hyunseokcho/Documents/GitHub/mortly/pages/verify-email.tsx:94-119, handleResend only special-cases `res.status === 429` (lines 106-110); every other response — including 400, 500, and 502 — falls through to `setCountdown(60)`, `setSuccess(t("auth.codeSent"))` ("New code sent." per public/locales/en/common.json:182), and clearing the code inputs 

---

### 11. Unverified user redirected from login must wait 60s with an expired code and gets no auto-resend

**Severity:** Medium  
**Feature area:** Email verification  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** auth-recovery

**Files:** pages/verify-email.tsx, pages/login.tsx, pages/api/auth/signup.ts
**Line references:** pages/verify-email.tsx:17, pages/verify-email.tsx:21-25, pages/login.tsx:50-56, pages/api/auth/signup.ts:75
**Current behavior:** verify-email.tsx initializes countdown to 60 unconditionally. When login throws EMAIL_NOT_VERIFIED the user is redirected here, but their signup code (10-minute TTL, signup.ts:75) is almost certainly expired and no new code is sent. They must wait 60 seconds before the Resend button enables, and any code entry yields 'Code expired'.
**Expected behavior:** When arriving without a fresh send (e.g., from the login redirect), either auto-trigger resend-code on mount or start with countdown 0 so the user can immediately request a code. Server cooldown (verificationCodeSentAt) already protects against abuse.
**User impact:** Returning unverified users hit a dead screen for 60 seconds with a code that cannot work — high drop-off risk at the exact moment a user is trying to re-engage.
**Technical cause:** Client-side countdown is a blanket 60s that assumes the page is always entered immediately after signup; no entry-context signal (e.g., ?from=login) or server cooldown query.
**Frontend impact:** Pass a query flag from login redirect (e.g., /verify-email?email=...&resend=1) and auto-call resend or zero the countdown; rely on the API 429 retryAfter to set the real cooldown.
**Backend impact:** None; resend-code already returns retryAfter on cooldown.
**Database impact:** None.
**Exact recommended fix:** In login.tsx append &resend=1 to the redirect; in verify-email.tsx, if resend=1, call handleResend on mount (it already handles 429 by adopting retryAfter) or initialize countdown to 0.
**Suggested test cases:**
- Login with unverified account → lands on verify-email and a fresh code email is sent (or resend enabled immediately)
- Resend within server cooldown → countdown adopts retryAfter from 429
- Signup → verify-email flow unchanged (60s countdown matches the just-sent code)

> Adversarial verification: **confirmed** (calibrated severity Medium). Every link in the claimed chain checks out, and I found no mitigating guard the reviewer missed.

1. Redirect without resend: lib/auth.ts:122-124 throws EMAIL_NOT_VERIFIED from the credentials authorize() with no code resend, and pages/login.tsx:50-56 redirects to `/verify-email?email=...` without calling /api/auth/resend-code. The URL shape is byte-identical to the post-signup redirect (pages/sig

---

### 12. BorrowerDataContext silently truncates request list at the API's 20-item default page

**Severity:** Medium  
**Feature area:** Dashboard data fetching / pagination  
**User type affected:** BORROWER  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** borrower-flow

**Files:** /Users/hyunseokcho/Documents/GitHub/mortly/components/borrower/BorrowerDataContext.tsx, /Users/hyunseokcho/Documents/GitHub/mortly/pages/api/requests/index.ts
**Line references:** components/borrower/BorrowerDataContext.tsx:87 ('All borrower requests (no pagination — list is small)'), components/borrower/BorrowerDataContext.tsx:149 (fetch('/api/requests') with no params), pages/api/requests/index.ts:40-42 (limit defaults to 20)
**Current behavior:** The context fetches /api/requests without page/limit; the API returns at most 20 (newest first). Dashboard list, totalResponses, activeRequests sidebar badge, and the rejected/pending banners are computed from this truncated slice. Active requests are capped at 5 (settings max_requests_per_user, lib/settings.ts:7) but CLOSED/EXPIRED/REJECTED accumulate past 20 over time.
**Expected behavior:** Fetch all pages, request a higher explicit limit, or paginate the dashboard list.
**User impact:** Long-time users lose visibility of older requests; counters and 'X total request(s)' become wrong; an old REJECTED request older than the newest 20 silently drops its banner.
**Technical cause:** Context assumes unpaginated response; API paginates.
**Frontend impact:** Pass ?limit=100 or implement paging; or read pagination.total for counts.
**Backend impact:** Optionally support limit=all for owner-scoped queries.
**Database impact:** None.
**Exact recommended fix:** Use the pagination envelope: fetch with explicit large limit and use pagination.total for the 'total requests' figure.
**Suggested test cases:**
- Seed 25 requests -> dashboard shows all (or paginates) and totals are correct

---

### 13. ConsultationStepper shows all steps completed for EXPIRED/CLOSED requests with zero broker responses

**Severity:** Medium  
**Feature area:** Request lifecycle communication  
**User type affected:** BORROWER  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** borrower-flow

**Files:** /Users/hyunseokcho/Documents/GitHub/mortly/components/ConsultationStepper.tsx
**Line references:** components/ConsultationStepper.tsx:19-21 (CLOSED/EXPIRED -> ['completed','completed','completed'])
**Current behavior:** A request that expired with no conversations renders steps 1-3 (submitted → broker responded → consultation done) all check-marked, implying a consultation happened.
**Expected behavior:** EXPIRED with no conversations should show step 1 complete and an 'expired' terminal indicator, not a fully completed consultation.
**User impact:** Misleading: borrowers may believe their inquiry was handled when nobody responded.
**Technical cause:** Terminal-status shortcut ignores hasConversation.
**Frontend impact:** Branch on hasConversation for terminal statuses; also note hasActiveConversation parameter is dead (lines 24-31 return identical tuples).
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** For CLOSED/EXPIRED without conversations show ['completed','pending','pending'] plus an expired/closed note; remove redundant branch.
**Suggested test cases:**
- EXPIRED + 0 conversations -> step 2/3 not completed
- CLOSED + closed conversation -> all completed

---

### 14. Rejected requests show a permanent, undismissable banner with no way to clear them

**Severity:** Medium  
**Feature area:** Request lifecycle  
**User type affected:** BORROWER  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Medium  
**Found by:** borrower-flow

**Files:** /Users/hyunseokcho/Documents/GitHub/mortly/pages/borrower/dashboard.tsx, /Users/hyunseokcho/Documents/GitHub/mortly/pages/api/requests/[id].ts
**Line references:** pages/borrower/dashboard.tsx:115,164-189 (first REJECTED request always banners, takes priority over PENDING), pages/api/requests/[id].ts:251-253 (DELETE only for OPEN/PENDING_APPROVAL), pages/borrower/request/[id].tsx:149 (no edit/delete buttons for REJECTED)
**Current behavior:** rejectionReason is correctly surfaced (dashboard banner + detail banner at request/[id].tsx:233-249 — good). But a REJECTED request can't be deleted (API restricts to OPEN/PENDING_APPROVAL), can't be edited/resubmitted, and the red 'Request Not Approved' banner persists indefinitely, also masking the PENDING_APPROVAL banner for a newer request (else-if at dashboard.tsx:190).
**Expected behavior:** Allow dismissing/archiving a rejected request, or allow editing+resubmitting it, and don't let an old rejection suppress the pending-approval notice for a new request.
**User impact:** Permanent alarming red banner; confusing when a new request is pending review but its banner is hidden.
**Technical cause:** No archive/acknowledge mechanism; banner priority is rejected-first via if/else.
**Frontend impact:** Stack or prioritize banners per-request; add dismiss.
**Backend impact:** Permit DELETE (or an acknowledge flag) for REJECTED requests.
**Database impact:** Possibly a dismissedAt field or reuse status.
**Exact recommended fix:** Allow deleting REJECTED/EXPIRED requests (no conversations exist for never-opened rejected ones) and show both banners when applicable.
**Suggested test cases:**
- REJECTED + new PENDING request -> both communicated
- Delete REJECTED request succeeds

---

### 15. Name validation parity gap: /api/borrowers/profile PUT has no max length (users/me PATCH caps at 100)

**Severity:** Medium  
**Feature area:** Profile  
**User type affected:** BORROWER  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** borrower-flow

**Files:** /Users/hyunseokcho/Documents/GitHub/mortly/pages/api/borrowers/profile.ts, /Users/hyunseokcho/Documents/GitHub/mortly/pages/api/users/me.ts, /Users/hyunseokcho/Documents/GitHub/mortly/pages/borrower/profile.tsx
**Line references:** pages/api/borrowers/profile.ts:45-50 (only non-empty string check), pages/api/users/me.ts:205-207 (100-char cap), pages/borrower/profile.tsx:209-216 (client: required only)
**Current behavior:** A borrower can PUT an arbitrarily long name via /api/borrowers/profile; the sibling endpoint enforces 100 chars. Client form has no maxLength either.
**Expected behavior:** Consistent bounded validation (e.g., 100 chars) on both endpoints and a client maxLength.
**User impact:** Oversized names break layouts (sidebar, chat headers) and bloat storage; inconsistent rules between flows.
**Technical cause:** Endpoint predates the validate.ts helpers used elsewhere.
**Frontend impact:** Add maxLength=100.
**Backend impact:** Use assertString(name, {max:100}) in borrowers/profile.ts.
**Database impact:** None.
**Exact recommended fix:** Align both endpoints on shared validator.
**Suggested test cases:**
- PUT 5000-char name -> 400
- 100-char name accepted both endpoints

---

### 16. Onboarding/profile forms read error from data.message but API returns {error} — real validation messages never shown

**Severity:** Medium  
**Feature area:** Broker onboarding/profile  
**User type affected:** Broker  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** broker-flow — also reported by: gap:File upload / document handling (beyond broker profile photo)

**Files:** pages/broker/onboarding.tsx, pages/broker/profile.tsx, lib/withAuth.ts, pages/api/brokers/profile.ts
**Line references:** pages/broker/onboarding.tsx:94-98, pages/broker/profile.tsx:146-151, lib/withAuth.ts:111-114, pages/api/brokers/profile.ts:93,101,109
**Current behavior:** On non-OK responses both forms do `setError(data.message || fallback)`. withAuth maps ValidationError to `res.status(400).json({ error: error.message })` and every handler error path uses the `error` key ({ error: 'Broker profile already exists' }, etc.). data.message is always undefined, so users always see the generic 'something went wrong' fallback.
**Expected behavior:** Specific server validation messages (e.g. 'phone must be in E.164 format (+1...)', 'Broker profile already exists') surface to the user.
**User impact:** A broker who submits an invalid field gets a generic error with no indication of which field to fix; duplicate-profile 409 also reads as a generic failure.
**Technical cause:** Frontend/backend error-shape contract drift: client expects {message}, server emits {error}.
**Frontend impact:** Change both forms to read data.error (or data.error ?? data.message).
**Backend impact:** None, or standardize on one error envelope.
**Database impact:** None.
**Exact recommended fix:** Read `data.error` in onboarding.tsx:96 and profile.tsx:148; note server messages are English-only, so ideally map known errors to i18n keys.
**Suggested test cases:**
- POST invalid phone: form shows the E.164 message
- POST duplicate profile: 409 message displayed
- PUT empty brokerageName: field-level message displayed

> Adversarial verification: **confirmed** (calibrated severity Medium). Every element of the claim verifies against the code, and I found no guard, wrapper, or interceptor that rescues it.

Client side: pages/broker/onboarding.tsx:94-98 does `setError(data.message || t("common.somethingWentWrong"))` (line 96) and pages/broker/profile.tsx:146-151 does `setError(data.message || t("broker.failedToUpdateProfile"))` (line 148). Both call bare `fetch("/api/brokers/profile")

---

### 17. FREE-tier broker sees enabled 'respond' CTA with credit copy on request detail, then receives an untranslated server 403

**Severity:** Medium  
**Feature area:** Broker request detail / credit gating  
**User type affected:** Broker  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** broker-flow — also reported by: ux-states

**Files:** pages/broker/requests/[id].tsx, pages/api/conversations/index.ts, pages/broker/dashboard.tsx
**Line references:** pages/broker/requests/[id].tsx:339-341, pages/broker/requests/[id].tsx:368-411, pages/api/conversations/index.ts:242-244, pages/broker/dashboard.tsx:142-173
**Current behavior:** The no-credits warning card only renders when `(brokerTier === 'BASIC' || brokerTier === 'PRO') && brokerCredits === 0`. A FREE-tier broker (default tier, 0 credits) falls through to the standard CTA showing '1 credit will be used. 0 remaining.' with an enabled button. Clicking POSTs /api/conversations which returns 403 {'error':'Free plan brokers cannot message clients. Please upgrade your plan.'} — displayed raw, English-only. The dashboard correctly shows a FREE-plan upgrade banner, so the two surfaces contradict.
**Expected behavior:** FREE-tier brokers see an upgrade card (mirroring the dashboard banner) instead of an enabled respond CTA with misleading credit copy.
**User impact:** FREE brokers are invited to respond, told a credit will be used, then blocked with an English error; confusing and looks broken to Korean users.
**Technical cause:** Tier condition omits FREE; server gate is correct but its message is not localized.
**Frontend impact:** Add a FREE-tier branch to the CTA card (upgrade prompt linking /broker/billing); localize/match known server error codes.
**Backend impact:** Optionally return an error code (e.g. FREE_PLAN_BLOCKED) for client-side translation.
**Database impact:** None.
**Exact recommended fix:** Change the condition to cover FREE (`brokerTier !== 'PREMIUM' && brokerCredits === 0` plus explicit FREE branch) and render the upgrade card.
**Suggested test cases:**
- FREE tier + 0 credits: upgrade card, no respond button
- BASIC tier + 0 credits: existing warning card
- PREMIUM: unlimited copy + enabled button

> Adversarial verification: **confirmed** (calibrated severity Medium). Every element of the claim holds up against the code, and no guard elsewhere prevents the scenario.

1. The FREE state is reachable on this page. prisma/schema.prisma:139-140 sets `subscriptionTier @default(FREE)` and `responseCredits @default(0)`, so a verified-but-FREE broker is the default state for new brokers. The product explicitly supports verified FREE brokers browsing requests: pages/api/

---

### 18. VERIFIED broker can rewrite license number, brokerage, province and category without verification reset

**Severity:** Medium  
**Feature area:** Broker verification integrity  
**User type affected:** Broker  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Medium  
**Found by:** broker-flow

**Files:** pages/api/brokers/profile.ts
**Line references:** pages/api/brokers/profile.ts:122-138, pages/api/brokers/profile.ts:45-51
**Current behavior:** PUT /api/brokers/profile lets the broker update licenseNumber, brokerageName, province and mortgageCategory at any time; the update never touches verificationStatus and no AdminAction/audit entry is created. A broker verified under license X can replace it with any string matching /^[A-Z0-9-]{1,50}$/i (or clear it to null) and keep the VERIFIED badge.
**Expected behavior:** Material identity fields either lock after verification, or editing them flips verificationStatus back to PENDING / flags admin review.
**User impact:** The 'verified broker' trust signal shown to borrowers can be stale or false; admin verification can be performed once with valid credentials then swapped.
**Technical cause:** Partial-update handler treats all fields uniformly with no post-verification policy.
**Frontend impact:** Surface a notice that material edits trigger re-review; optionally disable license field when VERIFIED.
**Backend impact:** In the PUT branch, if verificationStatus === 'VERIFIED' and licenseNumber/brokerageName/province changed, set verificationStatus = 'PENDING' (or queue admin review) and record an AdminAction.
**Database impact:** None (uses existing columns).
**Exact recommended fix:** Add a material-fields-changed check in the PUT handler that resets verification or notifies admins.
**Suggested test cases:**
- VERIFIED broker PUTs new licenseNumber: status becomes PENDING (or admin notified)
- Cosmetic edit (bio) leaves VERIFIED intact
- REJECTED broker edits do not auto-grant access

> Adversarial verification: **confirmed** (calibrated severity Medium). Confirmed at every cited point, with no compensating guard anywhere in the stack. pages/api/brokers/profile.ts:122-138 (PUT) runs validateBrokerFields(body, true) and prisma.broker.update without ever reading or writing verificationStatus, and creates no AdminAction/audit record. Lines 45-51 allow licenseNumber to be replaced with any /^[A-Z0-9-]{1,50}$/i string or cleared to null (assertOptionalS

---

### 19. Bulk mark-requests-seen marks ALL open requests as seen (including never-rendered ones) and skips the VERIFIED gate

**Severity:** Medium  
**Feature area:** Unseen indicators  
**User type affected:** Broker  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Medium  
**Found by:** broker-flow

**Files:** pages/api/brokers/mark-requests-seen.ts, pages/broker/requests/index.tsx
**Line references:** pages/api/brokers/mark-requests-seen.ts:14-31, pages/api/brokers/mark-requests-seen.ts:44-58, pages/broker/requests/index.tsx:116-123, pages/api/brokers/requests/[id]/mark-seen.ts:24-26
**Current behavior:** On unmount of the browse page the client fires POST /api/brokers/mark-requests-seen, which inserts BrokerRequestSeen rows for EVERY currently-OPEN request the broker hasn't seen — regardless of active province/category filters and regardless of the 20-row page cap, so requests the broker never laid eyes on lose their 'new' dot and drop out of newCount. Unlike the single mark-seen endpoint (which requires verificationStatus === 'VERIFIED', mark-seen.ts:24-26), the bulk endpoint only checks that a broker row exists, so a PENDING/REJECTED broker can also zero their counter.
**Expected behavior:** Only requests actually delivered to the client (current page/filter set) are marked seen, or the client sends the visible request ids; gate matches the single-request endpoint.
**User impact:** New-lead indicators are unreliable: a broker who glances at a filtered Ontario list silently 'sees' all BC/commercial requests too, so the sidebar badge under-reports genuinely new leads.
**Technical cause:** Server derives the seen set from the DB (all OPEN unseen) instead of from what the client displayed; verification check omitted.
**Frontend impact:** Send the ids of rendered requests in the POST body.
**Backend impact:** Accept an ids[] array (validated, capped) and only mark those; add the VERIFIED check for parity.
**Database impact:** None (same table).
**Exact recommended fix:** POST {requestIds: string[]} from the page; server upserts only those rows; require VERIFIED like mark-seen.ts.
**Suggested test cases:**
- Filtered browse (Ontario) then leave: BC request still isNew
- 21+ open requests: page-2 items remain new after viewing page 1
- PENDING broker POST returns 403

> Adversarial verification: **confirmed** (calibrated severity Medium). All three parts of the claim hold up under adversarial reading.

1) Bulk endpoint marks ALL OPEN unseen requests regardless of what was rendered. /Users/hyunseokcho/Documents/GitHub/mortly/pages/api/brokers/mark-requests-seen.ts:24-30 queries borrowerRequest.findMany with where { status: "OPEN", brokerSeens: { none: { brokerId } } } — no province/category/page constraint — then lines 44-51 createM

---

### 20. Broker coverage matching not implemented — profile mortgageCategory/province never applied to browse or counters

**Severity:** Medium  
**Feature area:** Broker lead inbox / matching  
**User type affected:** Broker  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** broker-flow

**Files:** pages/api/requests/index.ts, pages/broker/dashboard.tsx, prisma/schema.prisma
**Line references:** pages/api/requests/index.ts:19-37, pages/broker/dashboard.tsx:308-315, prisma/schema.prisma:131
**Current behavior:** The broker GET branch only filters status='OPEN' plus optional client-supplied province/mortgageCategory query params. Broker.mortgageCategory (RESIDENTIAL/COMMERCIAL/BOTH) and Broker.province are never consulted, so a RESIDENTIAL-only broker's default list, newCount badge, and dashboard 'new requests' widget all include COMMERCIAL requests from every province. Dashboard empty-state copy claims 'No new requests match your coverage right now' implying matching exists.
**Expected behavior:** Default browse/counters scoped to the broker's declared category (BOTH = no filter), with manual filters widening/narrowing on top; or at minimum copy that doesn't claim matching.
**User impact:** Brokers wade through irrelevant leads; the 'new' badge counts requests outside their stated practice; 'matched with brokers' product promise is unmet.
**Technical cause:** Matching was modeled in the schema but never wired into the query layer.
**Frontend impact:** Default the category filter chip to the broker's profile category.
**Backend impact:** In requests/index.ts broker branch, when broker.mortgageCategory !== 'BOTH', add where.mortgageCategory = broker.mortgageCategory (and apply to newCountWhere).
**Database impact:** None — fields/indexes exist.
**Exact recommended fix:** Apply broker.mortgageCategory server-side to both the list and newCount queries; revisit province defaulting as product decision.
**Suggested test cases:**
- RESIDENTIAL broker default list excludes COMMERCIAL requests
- newCount excludes off-category requests
- BOTH broker unchanged

> Adversarial verification: **confirmed** (calibrated severity Medium). Every element of the claim checks out. (1) pages/api/requests/index.ts:19-37: the broker GET branch loads the Broker row but uses only verificationStatus/id; `where` is `{status:"OPEN"}` plus optional client-supplied province/mortgageCategory query params — Broker.mortgageCategory and Broker.province are never consulted. The newCount query (lines 47-53, 80-84) spreads the same unfiltered `where`, 

---

### 21. REJECTED brokers are dead-ended — no re-application or appeal flow

**Severity:** Medium  
**Feature area:** Broker verification  
**User type affected:** Broker  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Medium  
**Found by:** broker-flow

**Files:** pages/broker/dashboard.tsx, pages/api/brokers/profile.ts
**Line references:** pages/broker/dashboard.tsx:130-141, pages/api/brokers/profile.ts:122-138
**Current behavior:** A REJECTED broker sees only a danger banner ('Please contact support to review your broker profile' — key broker.rejectedDesc missing from both locales, so the English fallback shows to Korean users). They can still edit their profile via PUT, but no code path ever returns verificationStatus to PENDING, and no endpoint exists for resubmission — admin must act out-of-band via support email.
**Expected behavior:** Editing the profile after rejection (or an explicit 'resubmit for review' action) re-queues the broker as PENDING for admin review.
**User impact:** Legitimately rejected-then-corrected brokers (e.g. typo'd license) cannot recover in-product; conversion loss and support load.
**Technical cause:** No state transition from REJECTED back to PENDING anywhere in pages/api/brokers/profile.ts or admin endpoints invoked by the broker.
**Frontend impact:** Add a 'resubmit for verification' CTA on dashboard/profile when REJECTED.
**Backend impact:** On PUT when verificationStatus === 'REJECTED' and material fields change (or via explicit action), set status PENDING and notify admins.
**Database impact:** None.
**Exact recommended fix:** Implement REJECTED→PENDING transition on profile resubmission, paired with the verification-reset logic from the related finding.
**Suggested test cases:**
- REJECTED broker updates license and resubmits: status PENDING, appears in admin queue
- Resubmission rate-limited
- VERIFIED broker unaffected

> Adversarial verification: **confirmed** (calibrated severity Medium). The core claim is verified on all key points. (1) Dead-end banner: /Users/hyunseokcho/Documents/GitHub/mortly/pages/broker/dashboard.tsx:130-141 renders a danger ActionBanner for REJECTED brokers with t("broker.rejectedTitle", "Verification rejected") and t("broker.rejectedDesc", "Please contact support to review your broker profile.") and no CTA prop — not even a support link/mailto, just text. (

---

### 22. No borrower-facing public broker profile page exists; profilePhoto is a dead end-to-end field

**Severity:** Medium  
**Feature area:** Broker public profile  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Large  
**Found by:** broker-flow

**Files:** pages/borrower/brokers/[requestId].tsx, pages/api/brokers/profile.ts, components/broker/BrokerDataContext.tsx, prisma/schema.prisma
**Line references:** pages/api/brokers/profile.ts:65-68, components/broker/BrokerDataContext.tsx:39, prisma/schema.prisma:135, pages/borrower/brokers/[requestId].tsx:13-31
**Current behavior:** pages/ contains no public broker profile or directory route (verified by directory listing: top-level pages are marketing/auth only; broker data reaches borrowers solely through conversation payloads and pages/borrower/brokers/[requestId].tsx, which lists only brokers who already started a conversation on that specific request). Broker.profilePhoto is writable via the API (validated https URL) but no UI ever sends it, no upload mechanism exists anywhere (no storage/upload code references it), and nothing renders it.
**Expected behavior:** A borrower-viewable broker profile (photo, bio, specialties, areasServed, experience, verification badge) — the marketplace's trust surface — plus an upload path for profilePhoto.
**User impact:** Borrowers cannot vet a broker beyond the inline card in the comparison list; brokers who fill bio/areasServed get limited exposure; profilePhoto field is unusable.
**Technical cause:** Feature never built; only the schema/API plumbing exists.
**Frontend impact:** New page (e.g. /brokers/[publicId]) rendering safe public fields; photo upload UI in /broker/profile.
**Backend impact:** Public read endpoint exposing only non-PII broker fields (exclude phone/email/stripeCustomerId); upload/signing endpoint for photos.
**Database impact:** None — fields exist.
**Exact recommended fix:** Either build the public profile page + photo upload before launch or remove profilePhoto from the API surface and adjust marketing promises.
**Suggested test cases:**
- Public profile hides phone/email/credits/stripeCustomerId
- Only VERIFIED brokers publicly visible
- Photo upload restricted to https/own storage

> Adversarial verification: **confirmed** (calibrated severity Medium). Every assertion holds. (1) No public broker profile/directory route exists: full pages/ listing shows only marketing/auth top-level pages plus role-gated borrower/broker/admin areas; the only borrower-facing broker view is pages/borrower/brokers/[requestId].tsx, which fetches /api/requests/${requestId} (lines 74-86) and lists only brokers with an existing conversation on that request. (2) profileP

---

### 23. Borrower financial details and free-text notes fully visible to all verified brokers before any credit spend

**Severity:** Medium  
**Feature area:** PII exposure / credit paywall  
**User type affected:** Both  
**Status:** Needs manual verification  
**Launch blocker:** No  
**Implementation complexity:** Medium  
**Found by:** broker-flow

**Files:** pages/api/requests/index.ts, pages/api/requests/[id].ts
**Line references:** pages/api/requests/index.ts:55-78, pages/api/requests/[id].ts:20-84
**Current behavior:** Both broker GETs return the entire BorrowerRequest row — details JSON (year-by-year income, corporate financials), notes free text, city, internal borrowerId cuid — to any VERIFIED broker with zero credits spent. Borrower name/email/phone are correctly never included (no borrower relation selected). However notes are unmoderated free text at read time: if a borrower writes their phone/email/Kakao ID into notes, every broker can contact them off-platform, bypassing the credit paywall entirely. Mitigation depends on admin approval (requests start PENDING_APPROVAL) actually screening notes — an operational process not visible in code.
**Expected behavior:** Either documented admin screening of notes/details for contact info pre-approval, or automated redaction/regex screening of contact patterns before requests go OPEN.
**User impact:** Borrower contact details may leak to all brokers pre-payment; platform revenue (credits) can be bypassed.
**Technical cause:** No masking layer on notes/details for the pre-conversation broker view; reliance on manual approval.
**Frontend impact:** None required.
**Backend impact:** Optional: contact-info pattern detector flagging notes at submission/approval; or truncate/redact notes in the browse list, full notes after conversation start.
**Database impact:** None.
**Exact recommended fix:** Verify the admin approval checklist covers contact-info screening; add a server-side phone/email pattern flag on request creation to assist admins.
**Suggested test cases:**
- Request with phone number in notes is flagged in admin queue
- Broker list/detail never includes borrower name/email/phone relations
- borrowerId not used in any client-visible URL

> Adversarial verification: **confirmed** (calibrated severity Medium). Every factual element of the claim holds up under adversarial review.

1. Full row exposure, zero credit spend — CONFIRMED. pages/api/requests/index.ts:55-78 calls prisma.borrowerRequest.findMany with no `select`, so every scalar field (details JSON, notes, city, province, borrowerId, rejectionReason) is returned for all OPEN requests to any VERIFIED broker (gate at lines 19-27). There is no credi

---

### 24. auto-close-conversations engagement filter is wrong: senderId != "SYSTEM" excludes nothing, and take:10 with no orderBy can misread engaged borrowers

**Severity:** Medium  
**Feature area:** Cron / conversations  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Medium  
**Found by:** data-layer

**Files:** pages/api/cron/auto-close-conversations.ts
**Line references:** pages/api/cron/auto-close-conversations.ts:9, pages/api/cron/auto-close-conversations.ts:40-44, pages/api/cron/auto-close-conversations.ts:99-104, pages/api/cron/auto-close-conversations.ts:57-62
**Current behavior:** System messages are created with isSystem:true and a REAL user senderId (pages/api/requests/[id].ts:122-124 uses the borrower's id; admin routes use the admin's id). The cron filters messages with `senderId: { not: "SYSTEM" } }` — no user has id "SYSTEM", so the filter is a no-op; a borrower-authored system message would count as engagement. The messages include uses take:10 with no orderBy, so on threads >10 messages the borrower's reply may not be in the loaded slice and an engaged conversation can be closed as 'unstarted'. Additionally, when a full page of CRON_BATCH_SIZE rows is entirely filter-ineligible the loop breaks (lines 57-62), starving eligible rows behind it.
**Expected behavior:** Filter on isSystem:false; load deterministically (orderBy createdAt) or query `messages.some({senderId: borrowerId, isSystem: false})` directly in the where clause; paginate with a cursor.
**User impact:** Edge cases: an actively-replying borrower's conversation can be auto-closed at day 7; conversely a system message could keep a dead thread open. At scale a page of ineligible rows halts the sweep.
**Technical cause:** SYSTEM_USER_ID constant predates the isSystem column; pagination lacks cursor/order.
**Frontend impact:** Conversations vanish to CLOSED with no in-thread explanation (no system message is written by this cron).
**Backend impact:** Incorrect close decisions; batch starvation under load.
**Database impact:** Conversation.status flips that don't match the documented rule.
**Exact recommended fix:** Replace the messages include with a where-level `NOT: { messages: { some: { senderId: request.borrowerId, isSystem: false } } }` filter, add orderBy+cursor pagination, and insert a translated isSystem message when closing.
**Suggested test cases:**
- Conversation with 12 broker messages then 1 borrower reply, 8 days old → NOT closed as unstarted
- Conversation whose only borrower-senderId row is isSystem:true → closed as unstarted
- 1500 ineligible + 50 eligible stale conversations → all 50 closed in one run

> Adversarial verification: **confirmed** (calibrated severity Medium). All three legs verify. (1) The `senderId: { not: "SYSTEM" } }` filter (auto-close-conversations.ts:9,41) is provably a no-op: Message.senderId is an FK to User.id (prisma/schema.prisma:204,216) and repo-wide grep shows no message is ever created with senderId "SYSTEM" — all isSystem:true messages use real user ids (pages/api/requests/[id].ts:122-123 borrower; pages/api/admin/requests/[id].ts:108-1

---

### 25. No user notification on request expiry or conversation auto-close; auto-closed threads contain no system message

**Severity:** Medium  
**Feature area:** Cron / notifications  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Medium  
**Found by:** data-layer — also reported by: messaging, notifications

**Files:** pages/api/cron/expire-requests.ts, pages/api/cron/auto-close-conversations.ts
**Line references:** pages/api/cron/expire-requests.ts:10-18, pages/api/cron/auto-close-conversations.ts:64-68
**Current behavior:** expire-requests is a bare updateMany to EXPIRED; auto-close is a bare updateMany to CLOSED. Neither sends email (lib/email.ts), push (lib/push.ts), creates an AdminNotice, nor inserts an isSystem chat message — unlike the manual close paths which do write a system message.
**Expected behavior:** At minimum an isSystem message in auto-closed conversations ('closed due to inactivity') and a push/email when a request expires, matching the notification behavior of manual closes.
**User impact:** Borrowers and brokers find requests/chats silently dead; brokers paid credits for conversations that close after 72 idle hours (e.g. a long weekend) with zero warning.
**Technical cause:** Cron handlers only update status columns.
**Frontend impact:** Messages pages show CLOSED threads with no explanatory bubble; dashboards show EXPIRED with no event.
**Backend impact:** None beyond missing side effects.
**Database impact:** No Message/AdminNotice rows for cron-driven transitions.
**Exact recommended fix:** Insert translated isSystem messages on auto-close and call sendPushToUsers/email on expiry; consider a warning notification 3 days before expiry.
**Suggested test cases:**
- Auto-closed conversation contains an isSystem closure message
- Request expiry triggers push to borrower's devices
- Korean-locale device receives Korean copy

> Adversarial verification: **confirmed** (calibrated severity Medium). Verified all assertions. pages/api/cron/expire-requests.ts:10-16 is a bare prisma.borrowerRequest.updateMany to EXPIRED with no imports of lib/email, lib/push, or lib/realtime. pages/api/cron/auto-close-conversations.ts:65-68 is a bare conversation.updateMany to CLOSED (plus a cascade request-close at lines 119-122); it defines SYSTEM_USER_ID="SYSTEM" (line 9) but only uses it to filter messages (

---

### 26. Admin settings PUT accepts empty/non-numeric values; getSettingInt then throws inside Stripe webhook and crons

**Severity:** Medium  
**Feature area:** System settings  
**User type affected:** Admin  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** data-layer

**Files:** pages/api/admin/settings.ts, lib/settings.ts
**Line references:** pages/api/admin/settings.ts:37-44, lib/settings.ts:77-87
**Current behavior:** PUT validates only `typeof value === "string" && length ≤ 500` — "" or "abc" for free_tier_credits/request_expiry_days is persisted. getSettingInt deliberately throws on NaN, so the next Stripe webhook credit grant or expire-requests run 500s until the value is fixed (DEFAULTS are not consulted because the DB row exists).
**Expected behavior:** Per-key validation at write time: integers ≥ 0 for *_credits/*_days/limits, boolean strings for maintenance_mode.
**User impact:** One admin typo silently breaks subscription credit grants (Stripe retries pile up) and stops request expiry until someone reads logs.
**Technical cause:** Write-side validation missing; read side fails loudly by design.
**Frontend impact:** /admin/system saves invalid values without error.
**Backend impact:** Webhook and cron handlers throw → 500.
**Database impact:** Invalid SystemSetting.value rows.
**Exact recommended fix:** Add a per-key validator map in the PUT handler mirroring lib/settings DEFAULT types; reject 400 on mismatch.
**Suggested test cases:**
- PUT free_tier_credits="" → 400
- PUT maintenance_mode="banana" → 400
- Valid PUT still bumps KV version

> Adversarial verification: **confirmed** (calibrated severity Medium). Every link in the claimed chain holds. (1) Write side: pages/api/admin/settings.ts:37-44 validates only `typeof value === "string" && value.length <= 500`; "" or "abc" for free_tier_credits/request_expiry_days/etc. passes and is upserted at lines 46-54. No per-key validation exists anywhere on the write path — the admin UI (pages/admin/system.tsx:111-121) sends raw draft strings with no client che

---

### 27. No bootstrap path for the first production ADMIN; /api/admin/users/create requires an existing admin and has no UI

**Severity:** Medium  
**Feature area:** Admin provisioning / seed  
**User type affected:** Admin  
**Status:** Needs manual verification  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** data-layer

**Files:** prisma/seed.ts, pages/api/admin/users/create.ts
**Line references:** prisma/seed.ts:679-684, pages/api/admin/users/create.ts:23
**Current behavior:** seed clean mode wipes everything and its comment says to create the first admin 'via /api/admin/users/create or psql' — but that route is wrapped in withAdmin (needs an authenticated ADMIN session), so the only real path is hand-written SQL (which must also satisfy publicId uniqueness and bcrypt hashing). mock/empty seeds refuse to run in production by default. No script or doc in-repo performs the bootstrap.
**Expected behavior:** A documented, safe bootstrap (one-off script reading ADMIN_EMAIL/ADMIN_PASSWORD env, or a guarded seed mode) for the first admin.
**User impact:** Whoever deploys cannot approve requests, verify brokers, or reach /admin without manual psql surgery; marketplace cannot operate (requests stay PENDING_APPROVAL).
**Technical cause:** Chicken-and-egg on withAdmin; no bootstrap script. May already be handled out-of-band (existing prod DB) — verify.
**Frontend impact:** None directly.
**Backend impact:** None directly.
**Database impact:** None.
**Exact recommended fix:** Add `npm run create-admin` script (tsx) that bcrypt-hashes a password from env and inserts the user with a generated publicId; document in README.
**Suggested test cases:**
- Script creates ADMIN with valid publicId/hash on empty DB
- Second run with same email exits cleanly

> Adversarial verification: **confirmed** (calibrated severity Medium). The chicken-and-egg is real and I found no guard the reviewer missed. pages/api/admin/users/create.ts:23 wraps the handler in withAdmin, and lib/admin/withAdmin.ts:77-89 returns 401 without a session and 403 unless session.user.role === "ADMIN" — no bootstrap token or zero-admin carve-out. No alternate path to ADMIN exists: pages/api/auth/signup.ts:51 and pages/api/auth/select-role.ts:29 only acce

---

### 28. Apple-OAuth borrowers created with name null are never prompted for a name on web (needsNameEntry has no web consumer)

**Severity:** Medium  
**Feature area:** Borrower OAuth first-run  
**User type affected:** Borrower  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Medium  
**Found by:** gap:Borrower onboarding / first-run experience (checklist says onboarding for BOTH roles; only broker side was reviewed)

**Files:** /Users/hyunseokcho/Documents/GitHub/mortly/lib/auth.ts, /Users/hyunseokcho/Documents/GitHub/mortly/pages/api/users/me.ts, /Users/hyunseokcho/Documents/GitHub/mortly/components/borrower/BorrowerShell.tsx
**Line references:** lib/auth.ts:216-230, lib/auth.ts:260, lib/auth.ts:333, pages/api/users/me.ts:185-274, components/borrower/BorrowerShell.tsx:120-123
**Current behavior:** Web OAuth signIn creates the user with `name: user.name || null` (auth.ts:221) — Apple frequently returns no name after first grant. session.user.needsNameEntry is computed and exposed (auth.ts:260, 333) but grep shows no page or component in this repo reads it; only the mobile-oriented PATCH /api/users/me clears it. BorrowerShell falls back to the email prefix as display name (BorrowerShell.tsx:122-123) and the borrower can submit requests with name null — brokers receive leads with no borrower name. The web profile page allows fixing it manually but nothing prompts.
**Expected behavior:** Web flow gates a needsNameEntry user through a name-entry step (analogous to select-role) before landing on the dashboard, since name is the only borrower identity field brokers see.
**User impact:** Brokers spend credits to contact anonymous-looking leads ('No name'/email-prefix), reducing lead quality and response rates for the affected borrowers.
**Technical cause:** needsNameEntry flow was built for mobile (mobile-oauth.ts:196) and plumbed into the web session but the web UI step was never built.
**Frontend impact:** Add a name-entry interstitial (could extend select-role.tsx) shown when session.user.needsNameEntry; PATCH /api/users/me already supports it from web (same-origin allowed).
**Backend impact:** None — endpoint exists.
**Database impact:** None.
**Exact recommended fix:** Gate /borrower/* (and /broker/*) on needsNameEntry with a small name form posting to PATCH /api/users/me. Note web signIn (auth.ts:217-230) doesn't set needsNameEntry on create, so also set it there when user.name is falsy, or derive from name==null like mobile-oauth.ts:212 does.
**Suggested test cases:**
- Apple OAuth user with no name on web → prompted for name before dashboard
- Name saved via PATCH /api/users/me → flag cleared, dashboard greeting uses it
- Google user with name → no prompt

---

### 29. No in-platform document/attachment exchange — mortgage document step is forced off-platform, outside the 180-day PII redaction

**Severity:** Medium  
**Feature area:** Chat / document handling  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Large  
**Found by:** gap:File upload / document handling (beyond broker profile photo)

**Files:** pages/api/messages/index.ts, prisma/schema.prisma, pages/borrower/messages.tsx, pages/broker/messages.tsx, components/RequestForm.tsx, pages/api/cron/purge-expired.ts, pages/api/cron/auto-close-conversations.ts, public/locales/en/common.json, public/locales/ko/common.json
**Line references:** pages/api/messages/index.ts:12-30, prisma/schema.prisma:201-221, pages/borrower/messages.tsx:776-792, pages/broker/messages.tsx:677-679, pages/borrower/messages.tsx:741-743, pages/borrower/messages.tsx:769-774, pages/api/cron/purge-expired.ts:27-77, lib/settings.ts:15, public/locales/en/common.json:1850, public/locales/en/common.json:1859
**Current behavior:** Chat accepts only a 1-5000 char text body; there is no attachment column, no file input, no storage integration, and message bodies are rendered as plain un-linkified text. Conversations auto-close on inactivity (auto-close-conversations cron) and closed threads disable the composer (pages/borrower/messages.tsx:769-774). Any income/ID/property document a broker needs must therefore move via email/KakaoTalk/etc. Terms s8l8 (en:1850) simultaneously prohibits soliciting users off-platform, and terms s10p2 / privacy.step3Desc frame off-platform sharing as the user's choice without mentioning documents.
**Expected behavior:** Either an explicit, documented product position ('documents are exchanged outside Mortly; here is guidance and a privacy disclosure saying so') or an in-platform attachment feature with storage, access control, and retention aligned with the existing 180-day redaction.
**User impact:** Borrowers will inevitably transmit highly sensitive financial documents through channels Mortly cannot redact, retain-limit, moderate, or audit — undermining the platform's stated privacy posture and pushing relationship continuation off-platform (also undercutting broker subscription economics per terms s8l8). PIPEDA accountability/openness implications for documents solicited as part of platform-mediated consultations are unaddressed in the privacy page.
**Technical cause:** Message model and API are text-only by design (prisma/schema.prisma:208 body VarChar(5000)); no Supabase Storage or upload endpoint exists anywhere in the repo (verified by exhaustive grep).
**Frontend impact:** Chat composers are single-line text inputs with no attach affordance; document URLs pasted into chat are not clickable (plain text render), adding friction that further encourages switching to email.
**Backend impact:** None broken; gap is absence. purge-expired redaction (pages/api/cron/purge-expired.ts:55-63) covers only in-platform message bodies.
**Database impact:** No attachment/file tables; nothing to retain or purge for documents.
**Exact recommended fix:** Decision-level: (1) add a sentence to privacy/terms explicitly stating Mortly does not transmit or store documents and that document exchange with a broker happens outside the platform at the user's discretion; (2) add an in-chat advisory string discouraging sending document images/SIN in chat; (3) longer term, build attachments on Supabase Storage with signed URLs and include them in the purge-expired redaction.
**Suggested test cases:**
- POST /api/messages with extra attachment-like fields ignores them (no schema drift)
- purge-expired redacts message bodies after retention window (currently untested)
- Privacy page renders document-handling disclosure in both ko and en

---

### 30. Privacy page and chat disclaimer never mention documents or the 180-day message retention/redaction policy

**Severity:** Medium  
**Feature area:** Privacy / legal copy  
**User type affected:** All  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** gap:File upload / document handling (beyond broker profile photo)

**Files:** pages/privacy.tsx, components/ChatDisclaimer.tsx, public/locales/en/common.json, public/locales/ko/common.json, pages/api/cron/purge-expired.ts, lib/settings.ts
**Line references:** public/locales/en/common.json:399-404, public/locales/ko/common.json:399-404, public/locales/en/common.json:1492, public/locales/en/common.json:1859, pages/api/cron/purge-expired.ts:10-26, lib/settings.ts:15, components/ChatDisclaimer.tsx:62-87
**Current behavior:** The chat disclaimer modal (messages.disclaimerBody / brokerDisclaimerBody, en+ko common.json:399-404) is a marketplace-liability notice only — no warning against sharing sensitive documents, SIN, or account numbers in chat. The privacy page's data categories (privacy.data1-4) list messages and timestamps but state no retention period; the only retention language is the vague requestsDesc2 ('We may retain certain records where required...'). Meanwhile the code implements a concrete PIPEDA-motivated policy: financial fields nulled and chat bodies redacted 180 days after terminal status (pages/api/cron/purge-expired.ts header comment cites PIPEDA Principle 5; lib/settings.ts:15 request_retention_days=180). Document exchange — the highest-sensitivity data flow the product induces — is never addressed anywhere in privacy or terms copy.
**Expected behavior:** Privacy page discloses the implemented retention/redaction window (PIPEDA openness principle) and explicitly addresses document handling (i.e., that Mortly provides no document transmission/storage and off-platform exchange is outside its custody). Chat disclaimer or composer area warns against sending sensitive documents/identifiers in chat.
**User impact:** Borrowers sharing income details in chat have no way to know how long their messages persist; the platform's strongest privacy control (the redaction cron) is invisible, and the riskiest behavior it cannot control (document exchange) is unacknowledged. Legal/compliance exposure rather than functional breakage.
**Technical cause:** Copy was written before/independently of the purge-expired retention implementation; no string in either locale mentions the 180-day window or documents (verified by locale-wide search).
**Frontend impact:** Copy additions only (privacy.tsx data3/requests sections, ChatDisclaimer body strings).
**Backend impact:** None — the control already exists.
**Database impact:** None.
**Exact recommended fix:** Add to privacy.data3 (Messages and Safety Data) a sentence stating message bodies are redacted ~180 days after a request closes/expires; add a document-handling paragraph; add one warning line to messages.disclaimerBody in both locales. Have counsel confirm PIPEDA wording.
**Suggested test cases:**
- Privacy page shows retention statement in ko and en
- Chat disclaimer shows sensitive-data warning in ko and en

---

### 31. Broker chat: conversation-list load errors are silently swallowed (error UI only exists inside the open-thread pane)

**Severity:** Medium  
**Feature area:** Broker chat  
**User type affected:** Broker  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** gap:Mobile responsiveness of borrower/broker (non-admin) authed surfaces, especially chat

**Files:** /Users/hyunseokcho/Documents/GitHub/mortly/pages/broker/messages.tsx
**Line references:** pages/broker/messages.tsx:131-142, pages/broker/messages.tsx:375-399, pages/broker/messages.tsx:478-502, pages/broker/messages.tsx:655-666
**Current behavior:** fetchConversations() sets error state on failure (lines 137-138), but the only error rendering (lines 655-666) sits inside the activeConvId branch of the right pane. With no conversation selected — the default state, and the entire mobile 'list' view — the failure renders conversations=[] which triggers the 'no conversations' empty state (375-399), masking the error completely. The borrower page renders its error as a top-level toast instead (pages/borrower/messages.tsx:436-448).
**Expected behavior:** A list-load failure should show an error with retry, distinguishable from the genuine empty state, on all viewports.
**User impact:** A broker whose /api/conversations call fails (network, 500) is told they have no conversations; on mobile there is no path to ever see the error.
**Technical cause:** Error banner JSX is scoped to the active-chat fragment instead of page level.
**Frontend impact:** Hoist the error banner to page level (mirroring the borrower page toast) or render it inside the left list pane.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Render the dismissible error element at the top level of the page (outside both panes), and only show the noConversations empty state when the fetch succeeded.
**Suggested test cases:**
- Mock /api/conversations to 500: at 375px the list view shows an error message, not 'no conversations'
- Error is dismissible and retry/refetch restores the list
- Borrower page parity test passes (it already renders a toast)

---

### 32. iOS Safari keyboard: 14px chat input will auto-zoom the locked 100dvh chat shell

**Severity:** Medium  
**Feature area:** Chat (borrower + broker) mobile input  
**User type affected:** Both  
**Status:** Needs manual verification  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** gap:Mobile responsiveness of borrower/broker (non-admin) authed surfaces, especially chat

**Files:** /Users/hyunseokcho/Documents/GitHub/mortly/styles/globals.css, /Users/hyunseokcho/Documents/GitHub/mortly/pages/borrower/messages.tsx, /Users/hyunseokcho/Documents/GitHub/mortly/pages/broker/messages.tsx, /Users/hyunseokcho/Documents/GitHub/mortly/components/borrower/BorrowerShell.tsx, /Users/hyunseokcho/Documents/GitHub/mortly/components/broker/BrokerShell.tsx
**Line references:** styles/globals.css:156-158, pages/borrower/messages.tsx:776-792, pages/broker/messages.tsx:677-734, components/borrower/BorrowerShell.tsx:126, components/broker/BrokerShell.tsx:151
**Current behavior:** The message composer uses .input-field which is font 'text-sm' (14px, globals.css:156-158). No viewport meta with maximum-scale/user-scalable exists anywhere in pages/ or components/ (grep verified), so Next's default width=device-width viewport applies. iOS Safari auto-zooms the page when focusing an input with font-size <16px. The chat lives inside a flex h-[100dvh] overflow-hidden shell (BorrowerShell.tsx:126, BrokerShell.tsx:151), so the zoom + on-screen keyboard can leave the composer or thread partially off-screen with no way to scroll the outer frame. Note 100dvh itself does not shrink for the iOS keyboard (it does on Android Chrome).
**Expected behavior:** Focusing the composer on a phone keeps the input and recent messages visible without page zoom.
**User impact:** Korean-speaking borrowers/brokers chatting from iPhones (a primary device for this audience) get a zoomed, clipped chat where the send button or last messages may be hidden behind the keyboard.
**Technical cause:** Sub-16px input font triggers iOS focus zoom; fixed-height overflow-hidden app frame cannot compensate; dvh does not track the iOS keyboard.
**Frontend impact:** Set the composer input to 16px on touch/small viewports (e.g. text-base on the chat input, or a media-query override for .input-field), and consider interactive-widget=resizes-content / visualViewport-based padding for the composer.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Bump chat composer font-size to >=16px below md (single class change), then manually verify on iOS Safari and Android Chrome at 360-414px that the composer stays visible with the keyboard open.
**Suggested test cases:**
- iPhone Safari 390px: focus composer — no page zoom occurs, input remains visible above keyboard
- Android Chrome 360px: keyboard open — thread scrolls and composer visible (dvh shrink)
- Send a message with keyboard open: auto-scroll-to-bottom still reaches the newest message

---

### 33. Hardcoded English strings throughout broker chat (request titles, status chip, 'in', 'No messages yet', 'Dismiss', 'now')

**Severity:** Medium  
**Feature area:** Broker chat i18n  
**User type affected:** Broker  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** gap:Mobile responsiveness of borrower/broker (non-admin) authed surfaces, especially chat

**Files:** /Users/hyunseokcho/Documents/GitHub/mortly/pages/broker/messages.tsx, /Users/hyunseokcho/Documents/GitHub/mortly/lib/requestConfig.ts, /Users/hyunseokcho/Documents/GitHub/mortly/pages/borrower/messages.tsx
**Line references:** lib/requestConfig.ts:105-111, pages/broker/messages.tsx:451-452, pages/broker/messages.tsx:461, pages/broker/messages.tsx:544-545, pages/broker/messages.tsx:561, pages/broker/messages.tsx:663, pages/broker/messages.tsx:85, pages/borrower/messages.tsx:543, pages/borrower/messages.tsx:62-74
**Current behavior:** getRequestTitle() returns hardcoded 'Commercial Request'/'Residential Request' (lib/requestConfig.ts:105-111) which renders in the conversation list badge on BOTH chat pages and the broker chat header; broker list rows render '<title> in <province>' with literal English 'in' (451-452, 544-545); the status chip shows the raw enum string {activeConversation.status} = 'ACTIVE'/'CLOSED' (561) instead of t(statusLabel.*) which exists for both locales; 'No messages yet' (461), 'Dismiss' (663) and relative-time 'now' (85) are hardcoded; date dividers/timestamps use toLocaleDateString('en-CA') on both pages so KO users see 'Jun 13, 2026' style dates.
**Expected behavior:** All user-visible chat strings localized via t() with ko defaults, since defaultLocale is ko.
**User impact:** The primary Korean-speaking audience sees scattered English fragments across the core chat surface (most prominent on mobile where the list is the whole screen).
**Technical cause:** Strings written inline instead of using existing keys (statusLabel.ACTIVE/CLOSED, chat.justNow, misc.dismiss all already exist in both locale files).
**Frontend impact:** Replace literals with t() calls; make getRequestTitle take t or return a key.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Localize getRequestTitle (return keys consumed via t()), use t(`statusLabel.${status}`) for the chip, t('misc.dismiss'), t('chat.justNow'), a localized 'in {{province}}' template, and locale-aware date formatting (ko-KR when router.locale==='ko').
**Suggested test cases:**
- Render broker messages list in ko: no Latin-only UI strings except user content
- Status chip shows 진행 중/종료-style localized labels for ACTIVE/CLOSED
- Date dividers render Korean month format under ko locale

---

### 34. Broker billing success messages render raw i18n keys (broker.planUpdating / broker.planUpdatePending)

**Severity:** Medium  
**Feature area:** Broker billing / Stripe subscription upgrade  
**User type affected:** Broker  
**Status:** Confirmed  
**Launch blocker:** Yes  
**Implementation complexity:** Small  
**Found by:** i18n — also reported by: gap:Mobile responsiveness of borrower/broker (non-admin) authed surfaces, especially chat, payments

**Files:** pages/broker/billing.tsx, public/locales/en/common.json, public/locales/ko/common.json
**Line references:** pages/broker/billing.tsx:255, pages/broker/billing.tsx:290
**Current behavior:** After a successful plan upgrade, setSuccessMessage(t("broker.planUpdating", { tier })) and, on webhook timeout, t("broker.planUpdatePending", { tier }) are shown. Both keys are absent from both common.json catalogs, and because the second argument is an options object (not a default string), i18next returns the literal key — the broker sees the text "broker.planUpdating" as the payment confirmation message in both languages.
**Expected behavior:** Localized messages like "플랜을 {{tier}}(으)로 업데이트하는 중…" / "Updating your plan to {{tier}}…" in the user's locale.
**User impact:** Every broker who upgrades a paid plan sees a raw translation key as the confirmation of their payment — looks broken at the exact moment money changed hands and undermines trust in whether the charge succeeded.
**Technical cause:** Keys broker.planUpdating and broker.planUpdatePending were never added to public/locales/{en,ko}/common.json; verified absent via grep. Sibling keys broker.planScheduled and broker.planUpgraded exist (those calls work).
**Frontend impact:** pages/broker/billing.tsx lines 255 and 290.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Add broker.planUpdating and broker.planUpdatePending (with {{tier}} interpolation) to both en and ko common.json.
**Suggested test cases:**
- Upgrade FREE→BASIC via Stripe test mode; assert success banner text is not a dotted key string in ko and en locales
- Simulate webhook delay >15s; assert pending message is localized

> Adversarial verification: **confirmed** (calibrated severity Medium). Claim verified end-to-end. (1) Reachability: pages/api/stripe/create-checkout.ts:83 returns { updated: true, scheduled: !isUpgrade }, so immediate upgrades hit billing.tsx:255 and, on poll timeout, billing.tsx:290. (2) Missing keys: grep across all repo JSON finds no planUpdating/planUpdatePending; public/locales/en/common.json and public/locales/ko/common.json (lines ~515-525) contain siblings pl

---

### 35. Consultation stepper labels are Korean in the EN catalog — EN borrowers see 상담 대기중/진행중/완료

**Severity:** Medium  
**Feature area:** Borrower request detail / consultation tracking  
**User type affected:** Borrower  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** i18n

**Files:** public/locales/en/common.json, components/ConsultationStepper.tsx, pages/borrower/request/[id].tsx
**Line references:** components/ConsultationStepper.tsx:109-122, pages/borrower/request/[id].tsx:272
**Current behavior:** consultation.step1="상담 대기중", step2="상담 진행중", step3="상담완료" have identical Korean values in BOTH en and ko common.json. The step descriptions (step1Desc etc.) ARE translated in en, so the EN request-detail page shows Korean step titles above English descriptions.
**Expected behavior:** EN catalog values like "Awaiting consultation" / "Consultation in progress" / "Consultation complete".
**User impact:** English-locale borrowers see untranslated Korean for the three headline status labels on the core request-tracking page.
**Technical cause:** Korean values were copied into the EN catalog instead of being translated (only 3 keys in the whole EN file contain Hangul — these).
**Frontend impact:** components/ConsultationStepper.tsx renders them on pages/borrower/request/[id].tsx.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Translate consultation.step1/2/3 in public/locales/en/common.json.
**Suggested test cases:**
- Render ConsultationStepper with locale=en; assert step labels contain no Hangul

> Adversarial verification: **confirmed** (calibrated severity Medium). Every element of the claim verifies against the code; I could not refute it.

1. EN catalog has Korean values: /Users/hyunseokcho/Documents/GitHub/mortly/public/locales/en/common.json:1293-1295 contains "step1": "상담 대기중", "step2": "상담 진행중", "step3": "상담완료" — byte-identical to the KO catalog (public/locales/ko/common.json:1293-1295). Meanwhile the sibling keys step1Desc/step2Desc/step3Desc (en/comm

---

### 36. System chat messages use three inconsistent localization strategies; admin-issued closures are English-only to Korean users

**Severity:** Medium  
**Feature area:** Chat / system messages (request close, admin close, cron auto-close)  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Medium  
**Found by:** i18n — also reported by: admin

**Files:** pages/api/requests/[id].ts, pages/api/admin/requests/[id].ts, pages/api/admin/conversations/[id].ts, pages/api/cron/auto-close-conversations.ts, pages/admin/activity.tsx
**Line references:** pages/api/requests/[id].ts:124, pages/api/admin/requests/[id].ts:110, pages/api/admin/conversations/[id].ts:117-119, pages/api/cron/auto-close-conversations.ts:65-68, pages/admin/activity.tsx:554
**Current behavior:** Borrower-initiated request close stores a concatenated bilingual string ("This request has been closed. / 이 요청이 종료되었습니다.") shown to everyone in both languages. Admin request close stores English-only "This request has been closed by an administrator." Admin conversation close stores English-only "This conversation has been closed by an administrator." + a free-text reason the (Korean-speaking) admin typed, mixing languages. The auto-close cron writes no message at all — conversations just flip to CLOSED silently, despite the admin UI promising "양 당사자에게 관리자 종료 메시지가 전달됩니다" (pages/admin/activity.tsx:554).
**Expected behavior:** System messages stored as a machine-readable type/key (+params) and localized at render time per viewer, or at minimum consistently bilingual.
**User impact:** Korean borrowers/brokers (the default audience) receive English-only moderation notices; EN users see half-Korean strings; silently auto-closed conversations give no explanation in any language.
**Technical cause:** Message.body stores final human text at write time; no per-viewer rendering layer for system messages (isSystem flag exists but only drives styling, per pages/api/messages/index.ts:25-29 comments).
**Frontend impact:** Chat renderers (pages/borrower/messages.tsx, pages/broker/messages.tsx) would need to map system-message types to t() keys.
**Backend impact:** Three write sites to converge on a structured format.
**Database impact:** Optionally add a systemType/params column or encode a key in body for isSystem rows.
**Exact recommended fix:** Store a stable identifier (e.g. body="@system:requestClosed" or a new column) and translate in the UI per viewer locale; backfill is unnecessary if the renderer falls back to raw body for legacy rows.
**Suggested test cases:**
- Admin closes a conversation; Korean borrower's chat shows Korean notice
- Borrower closes request; both parties see their own language only
- Cron auto-close inserts a localized system message (or product explicitly decides silence is OK)

> Adversarial verification: **confirmed** (calibrated severity Medium). Every cited fact verified in code with no refuting guards found. (1) pages/api/requests/[id].ts:124 stores the concatenated bilingual string "This request has been closed. / 이 요청이 종료되었습니다." (2) pages/api/admin/requests/[id].ts:110 stores English-only "This request has been closed by an administrator." (3) pages/api/admin/conversations/[id].ts:117-119 stores English-only "This conversation has been

---

### 37. API validation/error messages are English-only and surfaced verbatim to users in 8 pages

**Severity:** Medium  
**Feature area:** Forms and error handling across borrower/broker flows  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Medium  
**Found by:** i18n — also reported by: gap:Borrower onboarding / first-run experience (checklist says onboarding for BOTH roles; only broker side was reviewed), request-form, ux-states

**Files:** lib/validate.ts, pages/reset-password.tsx, pages/forgot-password.tsx, pages/broker/messages.tsx, pages/broker/requests/[id].tsx, pages/borrower/profile.tsx, pages/borrower/brokers/[requestId].tsx, pages/borrower/messages.tsx, pages/borrower/request/[id].tsx, pages/api/messages/index.ts
**Line references:** lib/validate.ts:26-37, lib/validate.ts:54, pages/api/messages/index.ts:23, pages/reset-password.tsx:51, pages/forgot-password.tsx:34, pages/broker/messages.tsx:310, pages/broker/requests/[id].tsx:108, pages/borrower/profile.tsx:87, pages/borrower/brokers/[requestId].tsx:82, pages/borrower/messages.tsx:331, pages/borrower/request/[id].tsx:135
**Current behavior:** ValidationError messages are developer-style English ("{field} must be at most {N} characters", "{field} must be one of: ..."); handlers return them in the error field; the listed pages call setError(err.message || data.error) before falling back to a translated generic — so whenever the API returns a message, Korean users see raw English.
**Expected behavior:** Either error codes mapped to t() keys client-side, or locale-aware server messages.
**User impact:** Korean users hitting any 400 (message too long, invalid enum, etc.) get untranslated technical English; e.g. "Message must be between 1 and 5000 characters" in the chat composer.
**Technical cause:** lib/validate.ts deliberately produces English user-facing strings (per its own doc comment) and the frontend trusts API error strings as display copy.
**Frontend impact:** 8 setError sites should map known error codes to catalog keys.
**Backend impact:** Return stable error codes alongside (or instead of) English messages.
**Database impact:** None.
**Exact recommended fix:** Add a code field to ValidationError responses; map codes→t() keys in a shared client helper; keep English message for logging only.
**Suggested test cases:**
- Send 5001-char chat message with locale=ko; assert the visible error is Korean
- Submit invalid enum on request form; assert localized error

> Adversarial verification: **confirmed** (calibrated severity Medium). The core claim holds end-to-end for 7 of the 8 cited pages. Server side: lib/validate.ts:26-37 and :54 throw English developer-style messages, the file's own doc comment (lines 4-6) calls them "user-facing", and lib/withAuth.ts:112-113 emits them verbatim as res.status(400).json({ error: error.message }). pages/api/messages/index.ts:23 (plus :29, :74, :94) returns hardcoded English error strings; 

---

### 38. EN locale choice is lost on every full-page round-trip (OAuth, signOut, Stripe, email links) and never persists across visits

**Severity:** Medium  
**Feature area:** Locale switching / persistence  
**User type affected:** All  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Medium  
**Found by:** i18n

**Files:** components/Navbar.tsx, pages/login.tsx, pages/signup.tsx, components/broker/BrokerShell.tsx, components/borrower/BorrowerShell.tsx, components/admin/AdminShell.tsx, components/DeleteAccountSection.tsx, pages/api/stripe/create-checkout.ts, pages/api/stripe/create-portal.ts, next-i18next.config.js
**Line references:** components/Navbar.tsx:110-112, next-i18next.config.js:4-6, pages/login.tsx:188, pages/signup.tsx:314-318, components/Navbar.tsx:554, components/broker/BrokerShell.tsx:282, components/borrower/BorrowerShell.tsx:233, components/admin/AdminShell.tsx:287, components/DeleteAccountSection.tsx:53, pages/api/stripe/create-checkout.ts:100-101, pages/api/stripe/create-portal.ts:28
**Current behavior:** switchLocale only does router.push with { locale }; no NEXT_LOCALE cookie is set anywhere in the repo, and localeDetection:false means even an existing cookie or Accept-Language would be ignored. Full-page redirects all use bare paths: signIn("google", { callbackUrl: "/select-role" }), signOut({ callbackUrl: "/login" }) in 4 shells, Stripe success_url/cancel_url/return_url `${origin}/broker/billing`. Credentials login (login.tsx:51-54,88) and verify-email DO preserve locale via router.push options — only client-side transitions survive.
**Expected behavior:** Locale persists via cookie and is carried through OAuth/Stripe/email round-trips with /en-prefixed URLs.
**User impact:** An English-speaking user flips to EN, signs in with Google → lands on the Korean select-role page; a broker completing Stripe checkout returns to the Korean billing page; signing out lands on the Korean login page; every fresh visit starts in Korean.
**Technical cause:** No cookie persistence + localeDetection:false + locale-unprefixed absolute callback/return URLs.
**Frontend impact:** Set NEXT_LOCALE (and honor it via middleware or enable detection), prefix callbackUrl with router.locale==='en' ? '/en/...' : '/...'.
**Backend impact:** Stripe URL builders should accept/propagate the user locale; optionally pass locale to Stripe Checkout's locale param.
**Database impact:** None (unless persisting per-user locale, see password-reset finding).
**Exact recommended fix:** Persist locale in a cookie on switch; build all externally-round-tripped URLs (OAuth callbacks, signOut, Stripe, emails) with the locale prefix.
**Suggested test cases:**
- Switch to EN → Google sign-in → assert /en/select-role
- EN broker completes Stripe checkout → returns to /en/broker/billing
- EN user signs out → /en/login
- Close and reopen browser on mortly.ca → still EN

> Adversarial verification: **confirmed** (calibrated severity Medium). Attempted refutation failed on every mechanism. (1) next-i18next.config.js:4-6 sets defaultLocale "ko" with localeDetection:false, which in Pages Router disables both Accept-Language and NEXT_LOCALE-cookie locale resolution, so any locale-unprefixed URL renders Korean. (2) Repo-wide grep (excluding node_modules/.next) finds zero NEXT_LOCALE writes; the only document.cookie write is the legal-accep

---

### 39. Date formatting hardcodes en-CA in 7 Korean-facing sites; same page mixes locale-aware and hardcoded formats

**Severity:** Medium  
**Feature area:** Date/number localization  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** i18n — also reported by: borrower-flow, ux-states

**Files:** pages/borrower/messages.tsx, pages/broker/messages.tsx, pages/broker/requests/[id].tsx, pages/borrower/profile.tsx, pages/borrower/request/[id].tsx, components/RequestCard.tsx, pages/broker/billing.tsx
**Line references:** pages/borrower/messages.tsx:69, pages/broker/messages.tsx:70, pages/broker/requests/[id].tsx:31, pages/borrower/profile.tsx:236, pages/borrower/request/[id].tsx:20, components/RequestCard.tsx:24, pages/broker/billing.tsx:389, pages/broker/billing.tsx:129
**Current behavior:** These sites call toLocaleDateString("en-CA", ...) unconditionally, so Korean-locale users see "June 13, 2026"-style dates in chat headers, profile, request detail/cards, and the subscription-cancelling banner. Meanwhile broker/dashboard.tsx:38, billing.tsx:121, billing.tsx:410, borrower/dashboard.tsx:46, Navbar.tsx:282 correctly switch ko-KR/en-CA — billing.tsx line 389 (cancelling banner) is hardcoded while line 410 (pending-downgrade banner) is locale-aware on the same screen. Currency (billing.tsx:129) is always Intl.NumberFormat("en-CA") — consistent CAD symbol, arguably fine, but Korean pages mix English month names with Korean copy.
**Expected behavior:** All user-facing date formatting keyed off router.locale like the dashboard helpers.
**User impact:** Korean UI shows English-formatted dates inconsistently across pages and even within the billing page.
**Technical cause:** Copy-pasted per-page formatDate helpers; 5 near-identical relative-time helpers exist (broker/dashboard.tsx:32-38, broker/requests/index.tsx:57-63, broker/requests/[id].tsx:42-48, borrower/dashboard.tsx:40-46, lib/admin/inboxQueue.ts:165-170).
**Frontend impact:** 7 call sites + consolidation opportunity.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Extract one shared formatDate/formatRelative util taking locale; replace all hardcoded en-CA call sites.
**Suggested test cases:**
- Render borrower messages in ko; assert date header contains Korean date format (년/월/일)
- Billing page in ko shows both banners with Korean dates

> Adversarial verification: **confirmed** (calibrated severity Medium). Every cited line checks out verbatim. Seven sites unconditionally call toLocaleDateString("en-CA"): borrower/messages.tsx:69 and broker/messages.tsx:70 (chat date separators, rendered at lines 387/331), broker/requests/[id].tsx:31 (rendered at 285), borrower/profile.tsx:236 (Member Since), borrower/request/[id].tsx:20 (rendered at 202), RequestCard.tsx:24 (rendered at 106, in a component that othe

---

### 40. Server accepts messages into CLOSED conversations; combined with suppressed unread badges, such messages are nearly invisible to the recipient

**Severity:** Medium  
**Feature area:** Message send / conversation lifecycle  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** messaging

**Files:** pages/api/messages/index.ts, pages/borrower/messages.tsx, pages/broker/messages.tsx, pages/api/messages/unread.ts
**Line references:** pages/api/messages/index.ts:32-125, pages/borrower/messages.tsx:239-270, pages/broker/messages.tsx:229-260, pages/api/messages/unread.ts:25, pages/borrower/messages.tsx:498, pages/broker/messages.tsx:406
**Current behavior:** POST /api/messages checks participant, blocks, and the spam guard but never checks conversation.status — sends into CLOSED conversations succeed (201). The UI hides the input when isClosed, but the 5s polling fallback only merges messages and never updates conversation status (only the realtime sync handler does), so a stale open tab keeps an enabled input after cron/admin/borrower-close and can send. The recipient then gets no unread badge: the nav badge endpoint filters status:'ACTIVE' (unread.ts:25) and both list badges are suppressed for CLOSED conversations (hasUnread && conv.status !== 'CLOSED').
**Expected behavior:** POST /api/messages returns 403/409 when conversation.status === 'CLOSED'; the polling fallback also refreshes conversation status so the input disables promptly.
**User impact:** A borrower replying from a stale tab after the 72h auto-close (realistic on left-open tabs) believes the message was delivered; the broker sees no unread indicator and likely never reads it. Lost leads on a marketplace whose core value is broker-borrower contact.
**Technical cause:** Missing status guard in pages/api/messages/index.ts (conversation is fetched at line 32 but status is never read); polling effect only calls setMessages, never setConversation status.
**Frontend impact:** Add status update to the poll handlers in both pages (mirror the realtime handler's setConversation/setActiveConversation status merge).
**Backend impact:** One added guard in /api/messages POST (and arguably the broker-intro path is unaffected since creation implies ACTIVE).
**Database impact:** None; existing orphan messages in closed conversations remain readable in thread history.
**Exact recommended fix:** In pages/api/messages/index.ts after the participant check: if (conversation.status === 'CLOSED') return res.status(403).json({ error: 'Conversation is closed' }); and update both pages' poll callbacks to also merge data.status.
**Suggested test cases:**
- POST /api/messages with conversationId of a CLOSED conversation → 403, no message row created
- Borrower closes conversation while broker thread open with realtime disabled → broker input disables within one poll tick
- Cron closes a conversation → subsequent participant send rejected
- Existing test suite: add to tests/integration/api/messages/index.test.ts

> Adversarial verification: **confirmed** (calibrated severity Medium). Every technical assertion verifies against the code. (1) Missing server guard: pages/api/messages/index.ts:32-44 fetches the conversation (status not even selected/read) and the handler checks only participant (50-56), user-blocks (61-75), and the broker spam counter (82-96) before inserting and returning 201 (101-125, 154). Nothing anywhere (no Prisma middleware in lib/prisma, no other guard) rej

---

### 41. System messages are returned without isSystem and render as ordinary participant bubbles (misattributed)

**Severity:** Medium  
**Feature area:** Chat rendering / system messages  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** messaging

**Files:** pages/api/conversations/[id].ts, pages/borrower/messages.tsx, pages/broker/messages.tsx, pages/api/requests/[id].ts, pages/api/admin/requests/[id].ts, pages/api/admin/conversations/[id].ts, prisma/schema.prisma
**Line references:** pages/api/conversations/[id].ts:32-41, pages/borrower/messages.tsx:725-757, pages/broker/messages.tsx:619-645, pages/api/requests/[id].ts:123-124, pages/api/admin/requests/[id].ts:109-110, pages/api/admin/conversations/[id].ts:112-120, prisma/schema.prisma:207-215
**Current behavior:** The schema comment (Message.isSystem) requires the rendering layer to read the column, and three server paths create isSystem:true messages. But GET /api/conversations/[id] selects only id/body/createdAt/senderId/conversationId/sender — isSystem is never returned — and neither frontend has any system-message styling. A borrower-initiated request close writes the system message with senderId = the borrower (pages/api/requests/[id].ts:121-124), so it renders as the borrower's own right-side bubble to them and as a normal borrower message to the broker. Admin closes render as a left-side bubble attributed to the counterpart.
**Expected behavior:** System messages render as centered/neutral notices, clearly machine-generated, in the viewer's language.
**User impact:** Brokers see 'This request has been closed. / 이 요청이 종료되었습니다.' as if the borrower typed it; admin closure notices appear to come from the other participant. Confusing and undermines trust in moderation messaging.
**Technical cause:** isSystem omitted from the Prisma select in pages/api/conversations/[id].ts:32-41; no isSystem branch in either page's message map.
**Frontend impact:** Add an isSystem branch in both groupedMessages renderers (centered chip style).
**Backend impact:** Add isSystem: true to the messages select.
**Database impact:** None — column already exists with index-friendly shape.
**Exact recommended fix:** Select isSystem in GET /api/conversations/[id]; in both messages pages render msg.isSystem messages as a centered system notice instead of a bubble; use a sentinel/system sender rather than the closing user's id.
**Suggested test cases:**
- GET /api/conversations/[id] response includes isSystem for system rows
- Borrower closes request → broker thread shows centered system notice, not a borrower bubble
- Admin closes conversation → both parties see system-styled notice

> Adversarial verification: **confirmed** (calibrated severity Medium). Every leg of the claim holds. (1) pages/api/conversations/[id].ts:32-41 selects only id/body/createdAt/senderId/conversationId/sender for messages — isSystem is never returned (both response paths at lines 120-125 just spread this object). (2) Three server paths write isSystem:true: pages/api/requests/[id].ts:119-126 (borrower close, senderId = the borrower's own user id), pages/api/admin/requests

---

### 42. No message-history pagination in either chat UI — threads silently truncate to the latest 50 messages

**Severity:** Medium  
**Feature area:** Chat thread / pagination  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Medium  
**Found by:** messaging

**Files:** pages/api/conversations/[id].ts, pages/borrower/messages.tsx, pages/broker/messages.tsx
**Line references:** pages/api/conversations/[id].ts:13-31, pages/api/conversations/[id].ts:88, pages/borrower/messages.tsx:163-176, pages/broker/messages.tsx:151-163
**Current behavior:** GET /api/conversations/[id] implements cursor pagination (limit ≤100, before cursor, hasMore flag), but neither frontend ever passes before/limit or reads hasMore (grep confirms zero occurrences in both pages). fetchActiveConversation loads the default latest 50 and there is no 'load older' affordance or infinite scroll.
**Expected behavior:** Scrolling to the top of a long thread loads older pages via the existing before cursor until hasMore is false.
**User impact:** Any conversation exceeding 50 messages (easily reached in an active mortgage negotiation) loses access to earlier history in the web UI — quotes, rate discussions, and commitments become unreachable.
**Technical cause:** Frontend never wired to the API's cursor parameters.
**Frontend impact:** Add top-scroll/load-older handling in both pages, prepending pages and preserving scroll position.
**Backend impact:** None — API ready.
**Database impact:** None.
**Exact recommended fix:** In both messages pages: when scrolled to top and hasMore, fetch /api/conversations/${id}?before=<oldest message id>&limit=50, prepend results (they arrive reversed-ascending), track hasMore. Note the same issue exists for the conversation list (default limit 50, page param never sent — users with >50 conversations lose older ones).
**Suggested test cases:**
- Thread with 120 messages → user can scroll/load back to message #1
- hasMore=false stops further fetches
- Prepended pages don't duplicate ids (existing dedupe)
- Conversation list with >50 conversations shows all via pagination

> Adversarial verification: **confirmed** (calibrated severity Medium). Confirmed at every cited line. (1) The API does implement cursor pagination: pages/api/conversations/[id].ts:13-14 parses `limit` (default 50, clamped to 1-100) and `before`; lines 29-31 apply `cursor: { id: before }, skip: 1, take: limit, orderBy createdAt desc`; line 88 computes `hasMore = messages.length === limit` and it is returned at lines 122/125. (2) Neither frontend uses any of it. pages/

---

### 43. In-page conversation list and unread badges go stale: no list polling and realtime only covers the active thread

**Severity:** Medium  
**Feature area:** Conversation list / unread  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** messaging

**Files:** pages/borrower/messages.tsx, pages/broker/messages.tsx, components/Navbar.tsx
**Line references:** pages/borrower/messages.tsx:195-227, pages/borrower/messages.tsx:239-270, pages/broker/messages.tsx:181-217, components/Navbar.tsx:67-71
**Current behavior:** Each page subscribes only to chat-<activeId> and the 5s poll fetches only the active conversation. fetchConversations runs on mount and inside the active-thread sync handler. A new message in any OTHER conversation (or a brand-new broker intro) produces no update to the left panel — no new row, no unread badge, no preview change — until the user reloads or receives a nudge on the active thread. Only the global Navbar badge refreshes (30s interval, Navbar.tsx:67-71).
**Expected behavior:** The conversation list reflects new activity within seconds: either poll GET /api/conversations on an interval, or subscribe to a per-user nudge channel.
**User impact:** A borrower sitting in one chat doesn't see another broker's new message or intro; response latency on a marketplace where speed-to-reply matters. The Navbar badge incrementing while the visible list shows nothing is confusing.
**Technical cause:** Realtime topics are per-conversation only; server has no per-user channel; list fetch isn't on the poll interval.
**Frontend impact:** Add fetchConversations() to the 5s/15s poll tick in both pages (cheap — endpoint is already batched), or implement user-<id> nudge topics server-side.
**Backend impact:** Optional: broadcast to user-<userId> topics in notifyConversation.
**Database impact:** None.
**Exact recommended fix:** Minimal: include fetchConversations() in the existing visibility-gated poll. Better: server broadcasts a user-scoped nudge on message send/conversation create.
**Suggested test cases:**
- Broker sends message in conversation B while borrower views conversation A → B's row moves up with unread badge within poll interval
- New broker intro appears in borrower's list without reload

> Adversarial verification: **confirmed** (calibrated severity Medium). Confirmed on all substantive points after attempting refutation.

1. Realtime covers only the active thread. The only client subscriptions in the repo are pages/borrower/messages.tsx:199-201 (`chat-${activeId}`) and pages/broker/messages.tsx:189-190 (`chat-${activeConvId}`); a repo-wide grep for `channel(` finds no others. The server side (lib/realtime.ts:74-83, notifyConversation/notifyConversati

---

### 44. Brokers are not notified of verification approval/rejection

**Severity:** Medium  
**Feature area:** Notifications / Broker onboarding  
**User type affected:** Broker  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** notifications

**Files:** /Users/hyunseokcho/Documents/GitHub/mortly/pages/api/admin/brokers/[id].ts
**Line references:** pages/api/admin/brokers/[id].ts:57-144
**Current behavior:** Admin PUT sets Broker.verificationStatus (VERIFIED/REJECTED/PENDING) and writes an AdminAction. No email, push, or notice is sent to the broker.
**Expected behavior:** Broker receives an email/push when verified (they can now spend credits to contact borrowers) or rejected (with reason so they can re-submit documents).
**User impact:** Verification is the activation gate for the broker funnel — brokers blocked at 'Broker must be verified to message clients' have no signal when the gate opens, delaying first revenue actions and increasing onboarding drop-off.
**Technical cause:** PUT handler performs only the broker update + audit create transaction (lines 123-141).
**Frontend impact:** None required.
**Backend impact:** Add notification dispatch after the transaction; broker user email/name available via the existing include (line 71 only selects publicId — widen the select).
**Database impact:** Optional AdminNotice row.
**Exact recommended fix:** After the verification transaction, send a localized push via sendPushToUsers (broker.userId) and a bilingual email; include the rejection reason when REJECTED.
**Suggested test cases:**
- PUT VERIFIED -> push/email dispatched once
- PUT REJECTED with reason -> notification contains reason
- Two-admin recommend path (202) -> no premature notification

> Adversarial verification: **confirmed** (calibrated severity Medium). Confirmed with no mitigating guards found. The PUT handler at pages/api/admin/brokers/[id].ts:57-144 performs only validation, an optional dual-admin audit gate (lines 84-115), and a transaction of broker.update + adminAction.create (lines 123-141); the file imports only prisma and withAdmin, so no email/push/realtime call is possible from it. No notification exists elsewhere either: lib/email.ts 

---

### 45. Notification preferences are stored but never enforced; no way to mute or disable push

**Severity:** Medium  
**Feature area:** Notifications / Preferences  
**User type affected:** All  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Medium  
**Found by:** notifications

**Files:** /Users/hyunseokcho/Documents/GitHub/mortly/pages/api/preferences.ts, /Users/hyunseokcho/Documents/GitHub/mortly/lib/push.ts, /Users/hyunseokcho/Documents/GitHub/mortly/pages/api/notifications/register-device.ts, /Users/hyunseokcho/Documents/GitHub/mortly/prisma/schema.prisma
**Line references:** pages/api/preferences.ts:23-28, lib/push.ts:38-45, pages/api/notifications/register-device.ts:52-60, prisma/schema.prisma:75-76
**Current behavior:** PUT /api/preferences accepts and persists emailNotifications/pushNotifications booleans, but no send path reads them: lib/push.ts filters only on DeviceToken.pushEnabled and mutedUntil, and lib/email.ts checks nothing. No endpoint anywhere sets pushEnabled=false or mutedUntil (register-device's upsert even forces pushEnabled:true on every re-registration, line 59). No web UI calls /api/preferences at all (repo-wide grep: zero frontend callers).
**Expected behavior:** Setting pushNotifications=false suppresses pushes; a mute endpoint sets DeviceToken.mutedUntil; emailNotifications gates non-security transactional email. App-store review (Apple 4.5.4 spam rules) and PIPEDA consent expectations favor a working opt-out.
**User impact:** A user who turns notifications off (e.g., in the mobile app settings backed by /api/preferences) keeps receiving pushes for every chat message; the only real opt-out is OS-level permission revocation or token deletion.
**Technical cause:** sendPushToUsers queries DeviceToken only; User.preferences is never joined. mutedUntil/pushEnabled have no write path besides defaults.
**Frontend impact:** Mobile app settings (external repo) will appear broken; web has no settings UI to add.
**Backend impact:** Join User.preferences in sendPushToUsers (or denormalize to DeviceToken), add a mute/disable endpoint (PATCH register-device or extend /api/preferences to flip DeviceToken.pushEnabled).
**Database impact:** None — columns already exist.
**Exact recommended fix:** In sendPushToUsers, exclude userIds whose preferences.pushNotifications === false; stop forcing pushEnabled:true on upsert-update (respect prior value or accept an explicit flag); add an API to set pushEnabled/mutedUntil.
**Suggested test cases:**
- preferences.pushNotifications=false -> sendPushToUsers sends nothing to that user
- mutedUntil in future -> device skipped; in past -> delivered
- Re-registering a muted device does not silently unmute it

> Adversarial verification: **confirmed** (calibrated severity Medium). Core claim verified with exact line matches. (1) pages/api/preferences.ts:23-28 accepts and persists emailNotifications/pushNotifications into User.preferences (Json, schema.prisma:32), and repo-wide grep confirms these keys are read nowhere else — no send path consults them. (2) lib/push.ts:38-45 (sendPushToUsers) filters only DeviceToken.pushEnabled and mutedUntil and never joins User.preference

---

### 46. Expo push receipts never checked; ticket index misalignment can prune the wrong token

**Severity:** Medium  
**Feature area:** Push infrastructure  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** notifications

**Files:** /Users/hyunseokcho/Documents/GitHub/mortly/lib/push.ts
**Line references:** lib/push.ts:73-101, lib/push.ts:76-83, lib/push.ts:87-95
**Current behavior:** Tickets are accumulated across chunks (lines 76-83); a failed chunk is caught and logged, contributing zero tickets. The pruning loop then maps tickets to messages positionally (`tickets.forEach((ticket, idx) => ... messages[idx]`, lines 87-95) — after any chunk failure the indices shift, so a DeviceNotRegistered ticket can point at the wrong message and delete a valid user's token (or keep a dead one). Separately, getPushNotificationReceiptsAsync is never called, so DeviceNotRegistered errors that only surface in receipts (the common case per Expo docs — e.g., app uninstalls) never prune tokens, and the table accumulates dead tokens that are re-sent forever.
**Expected behavior:** Ticket-to-message mapping survives partial chunk failure; receipts are polled (or dead tokens pruned via lastActiveAt aging) so uninstalled devices stop being targeted.
**User impact:** Worst case a user silently stops receiving all pushes because their valid token was deleted after an unrelated chunk failure; baseline case is growing waste and Expo throttling risk from dead tokens.
**Technical cause:** Positional indexing across a list built from variable-success chunks; no receipt-phase handling.
**Frontend impact:** None.
**Backend impact:** Track (message, ticket) pairs per chunk; store ticket ids and check receipts (cron or queue), or add a lastActiveAt-based token TTL.
**Database impact:** Optional ticket-id storage or periodic deviceToken cleanup.
**Exact recommended fix:** Inside the chunk loop, zip each chunk's tickets with that chunk's messages (same length on success) and prune from that pairing; add a receipts check or prune tokens with lastActiveAt older than ~90 days in the purge-expired cron.
**Suggested test cases:**
- Chunk 1 throws, chunk 2 returns DeviceNotRegistered -> correct token deleted
- All chunks succeed with one DeviceNotRegistered -> only that token removed
- Dead token aging path removes stale rows

> Adversarial verification: **confirmed** (calibrated severity Medium). Both parts hold up against the code. (1) Misalignment: lib/push.ts:76-83 accumulates tickets across chunks and swallows thrown chunks (zero tickets contributed), while lib/push.ts:87-95 maps tickets to messages positionally (`messages[idx]`). If an earlier chunk throws and a later chunk returns a DeviceNotRegistered ticket, the wrong token is deleted — exactly as claimed. (2) Receipts: getPushNoti

---

### 47. Push/email dispatched fire-and-forget after the HTTP response — delivery not guaranteed on Vercel serverless

**Severity:** Medium  
**Feature area:** Push / email infrastructure  
**User type affected:** Both  
**Status:** Needs manual verification  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** notifications

**Files:** /Users/hyunseokcho/Documents/GitHub/mortly/pages/api/messages/index.ts, /Users/hyunseokcho/Documents/GitHub/mortly/pages/api/conversations/index.ts, /Users/hyunseokcho/Documents/GitHub/mortly/pages/api/auth/forgot-password.ts
**Line references:** pages/api/messages/index.ts:142-154, pages/api/conversations/index.ts:216-227, pages/api/conversations/index.ts:341-355, pages/api/auth/forgot-password.ts:60-67
**Current behavior:** sendPushToUsers (which does a DB query plus one or more Expo HTTP round-trips) and sendPasswordResetEmail are invoked without await, with only .catch logging, and the handler returns immediately after. On Vercel's serverless runtime, execution after the response is sent may be frozen before these promises settle, silently dropping the push/email. Cannot be confirmed statically — depends on Vercel runtime behavior/region config.
**Expected behavior:** Background work is either awaited before responding, or scheduled via a mechanism Vercel guarantees (waitUntil / queue), so chat pushes and reset emails reliably deliver.
**User impact:** If freezing occurs, mobile users intermittently or consistently miss new-message and new-inquiry pushes — the primary re-engagement channel — and some password reset emails never arrive despite the 200 response.
**Technical cause:** Detached promises post-response in a freezable serverless environment; Pages Router API routes lack a built-in waitUntil.
**Frontend impact:** None.
**Backend impact:** Either await the dispatch before res.json (adds ~100-500ms), or move sends to a durable path (e.g., Vercel waitUntil via @vercel/functions, QStash, or DB-outbox drained by cron).
**Database impact:** None for await; outbox table if queued.
**Exact recommended fix:** Manually verify in production logs whether 'Expo push send error' / successful sends appear for messages sent right before lambda freeze; if drops are observed, await the push (it is already chunked and bounded) or adopt waitUntil.
**Suggested test cases:**
- Send message in prod, lock recipient phone -> push arrives consistently across 20 trials
- forgot-password under load -> reset email delivery rate ~100%

> Adversarial verification: **confirmed** (calibrated severity Medium). Verified at every cited site. pages/api/messages/index.ts:142-152 fires sendPushToUsers(...).catch(console.error) without await and returns res.status(201) at line 154; pages/api/conversations/index.ts:217-224 and :344-354 do the same (responses at lines 227/357); pages/api/auth/forgot-password.ts:63-67 fires sendPasswordResetEmail unawaited with an explicit "Fire-and-forget — never await" comment

---

### 48. Brokers get no notification of new matching leads

**Severity:** Medium  
**Feature area:** Notifications / Marketplace matching  
**User type affected:** Broker  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Medium  
**Found by:** notifications

**Files:** /Users/hyunseokcho/Documents/GitHub/mortly/pages/api/admin/requests/[id].ts, /Users/hyunseokcho/Documents/GitHub/mortly/lib/push.ts
**Line references:** pages/api/admin/requests/[id].ts:90-154, lib/push.ts:104-174
**Current behavior:** When a request becomes OPEN (approved), no broker is notified; repo-wide grep shows the only push templates are message/inquiry ones (lib/push.ts:104-174) and no email/push exists for new-lead events. Brokers must manually poll /broker/requests.
**Expected behavior:** Verified brokers (optionally filtered by province/category) receive a push/email digest when new requests open — this is the demand-side engine of the marketplace and the reason brokers pay for credits.
**User impact:** Slow broker response times degrade borrower experience and reduce credit spend (revenue). First-mover brokers who poll manually get all leads.
**Technical cause:** Feature not implemented; BrokerRequestSeen model exists for tracking views but nothing dispatches alerts.
**Frontend impact:** None for push; optional per-broker alert preferences UI later.
**Backend impact:** On APPROVE_REQUEST transition, query verified brokers (optionally same province) and sendPushToUsers in chunks; or a daily digest cron.
**Database impact:** None initially; per-broker alert prefs later.
**Exact recommended fix:** Add a newLeadPush LocalizedPush template and dispatch on the PENDING_APPROVAL->OPEN transition in pages/api/admin/requests/[id].ts, bounded to verified brokers with active subscriptions.
**Suggested test cases:**
- Request approved -> verified brokers receive one push each
- FREE-tier or unverified brokers excluded (configurable)
- Re-approval of same request doesn't re-blast

> Adversarial verification: **confirmed** (calibrated severity Medium). Confirmed by tracing every notification path in the repo. (1) New borrower requests default to PENDING_APPROVAL (prisma/schema.prisma:104; the create at pages/api/requests/index.ts:197-210 sets no status), and the only code that flips a request to OPEN is the admin PUT handler at pages/api/admin/requests/[id].ts:54-154. That handler emits no broker-facing notification on approval — the only side e

---

### 49. Stale pendingTier is never cleared on cancellation or re-checkout — can silently downgrade a brand-new subscription

**Severity:** Medium  
**Feature area:** Subscriptions — webhook state machine  
**User type affected:** Broker  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** payments

**Files:** pages/api/webhooks/stripe.ts, pages/broker/billing.tsx
**Line references:** pages/api/webhooks/stripe.ts:184-205, pages/api/webhooks/stripe.ts:393-419, pages/broker/billing.tsx:401-418
**Current behavior:** pendingTier is only cleared in handleInvoicePaid (line 283). handleSubscriptionDeleted (393-419) and handleCheckoutCompleted's upsert update branch (196-205) do not clear it. Sequence: broker on PRO schedules downgrade to BASIC (pendingTier=BASIC) → cancels via portal instead → sub deleted, broker → FREE, pendingTier survives → broker re-subscribes to PRO via Checkout → handleCheckoutCompleted leaves pendingTier=BASIC → first renewal's invoice.paid applies the stale downgrade (price swap + tier flip to BASIC). Additionally, after cancellation the billing page keeps showing the pending-downgrade banner (pendingTier && currentPeriodEnd both still set).
**Expected behavior:** pendingTier must be cleared whenever the subscription is deleted or a new checkout completes; the banner should never show a downgrade for a dead subscription.
**User impact:** A re-subscribed broker can be silently moved to a cheaper tier they never requested (and per the downgrade-billing bug, charged the wrong amount for that cycle); cancelled brokers see a confusing stale banner.
**Technical cause:** pendingTier lifecycle is only handled on the happy path (invoice.paid); terminal and restart transitions ignore it.
**Frontend impact:** Stale amber banner on /broker/billing.
**Backend impact:** Add pendingTier: null to handleSubscriptionDeleted's update and handleCheckoutCompleted's upsert update branch.
**Database impact:** One-time cleanup of any existing rows with pendingTier set on EXPIRED subscriptions.
**Exact recommended fix:** Clear pendingTier in handleSubscriptionDeleted and in handleCheckoutCompleted's update branch; optionally hide the frontend banner unless subscription.status === 'ACTIVE'.
**Suggested test cases:**
- pendingTier set → subscription.deleted → assert pendingTier null
- pendingTier set on old row → new checkout.session.completed → assert pendingTier null and next invoice.paid does NOT downgrade

> Adversarial verification: **confirmed** (calibrated severity Medium). Every step verified in code. pendingTier is set only at pages/api/stripe/create-checkout.ts:78-81 and cleared only at pages/api/webhooks/stripe.ts:283 (handleInvoicePaid) — exhaustive grep shows no other write site, cron, or guard. The claimed sequence holds: (1) scheduled downgrade sets pendingTier=BASIC with no Stripe change; (2) handleSubscriptionDeleted (stripe.ts:403-419) sets EXPIRED/endedAt

---

### 50. Delayed/replayed invoice.paid for an EXPIRED subscription re-activates it and re-grants paid credits

**Severity:** Medium  
**Feature area:** Webhook out-of-order handling  
**User type affected:** Broker  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** payments

**Files:** pages/api/webhooks/stripe.ts, tests/integration/api/stripe/webhook-ordering.test.ts
**Line references:** pages/api/webhooks/stripe.ts:231-235, pages/api/webhooks/stripe.ts:263-293, tests/integration/api/stripe/webhook-ordering.test.ts:113-118
**Current behavior:** handleInvoicePaid looks up the Subscription row by stripeSubscriptionId with no status guard. A stale invoice.paid arriving after customer.subscription.deleted sets status back to ACTIVE and re-grants the paid tier's credits to a broker who was downgraded to FREE. The webhook-ordering test explicitly documents this as a known edge ('the current handler does re-update the subscription row + broker credits even when EXPIRED').
**Expected behavior:** invoice.paid for a subscription already marked EXPIRED (or whose Stripe-side status is canceled) should not flip status to ACTIVE or grant credits.
**User impact:** A cancelled broker can end up with an ACTIVE-looking subscription and a month of paid credits without an active Stripe subscription; admin dashboards and entitlements drift from Stripe truth.
**Technical cause:** Missing status check in handleInvoicePaid; it trusts any paid invoice that maps to a known stripeSubscriptionId.
**Frontend impact:** Billing page would show an active plan for a cancelled broker.
**Backend impact:** Add an early return when the local row is EXPIRED, or verify stripeSub.status === 'active' from the retrieve call already being made (line 238).
**Database impact:** None.
**Exact recommended fix:** In handleInvoicePaid, after retrieving the Stripe subscription, no-op unless stripeSub.status is active/past_due; also skip when the local Subscription.status is EXPIRED. Update the documenting test assertion accordingly.
**Suggested test cases:**
- invoice.paid after subscription EXPIRED → no broker.update, no status flip (flip the existing documented assertion)

> Adversarial verification: **confirmed** (calibrated severity Medium). Verified directly in source. handleInvoicePaid (pages/api/webhooks/stripe.ts:231-235) looks up the Subscription by stripeSubscriptionId via findUnique with no status guard; the transaction (lines 263-293) only checks the period cursor (268-273) before unconditionally setting status: "ACTIVE" (278) and re-granting broker.subscriptionTier + responseCredits (286-292). The cited test (tests/integratio

---

### 51. Webhook idempotency ledger recorded before processing — crash/timeout permanently drops the event

**Severity:** Medium  
**Feature area:** Webhook reliability  
**User type affected:** Broker  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Medium  
**Found by:** payments

**Files:** pages/api/webhooks/stripe.ts, prisma/schema.prisma
**Line references:** pages/api/webhooks/stripe.ts:75-92, pages/api/webhooks/stripe.ts:114-147, prisma/schema.prisma:227-234
**Current behavior:** ProcessedStripeEvent row is inserted BEFORE the handler runs. If the handler throws, the row is deleted and a 500 triggers Stripe retry — correct. But if the lambda crashes or hits Vercel's function timeout mid-handler (the handlers make multiple sequential Stripe API + DB calls), the ledger row persists with the event unprocessed; Stripe's retry is then short-circuited as duplicate=true with a 200, and the event (e.g. a credit grant or PAST_DUE flip) is lost forever. The rollback-failure path (121-145) is also self-described as 'a known support ticket'.
**Expected behavior:** At-least-once processing: an event should only be marked processed after its handler commits, with handler-level idempotency (which already exists via period-cursor checks) protecting against duplicates.
**User impact:** Rare but unrecoverable: a broker pays and never receives credits/tier, or a cancellation never propagates — requiring manual support intervention.
**Technical cause:** Insert-first ledger design covers thrown errors but not process death; the per-handler idempotency checks already make insert-after safe.
**Frontend impact:** Billing page polling (billing.tsx:256-291) would time out showing the planUpdatePending message.
**Backend impact:** Move the ledger insert to after the switch statement (handlers are already idempotent), or add a processedAt column and treat rows without it as unprocessed.
**Database impact:** Optionally add processedAt to ProcessedStripeEvent. Also note: no cron ever purges this table despite its createdAt index — unbounded growth.
**Exact recommended fix:** Record the event ID after successful handling (relying on the existing in-transaction period-cursor idempotency), or two-phase: insert with processedAt=null, set on success, and treat null rows older than N minutes as retryable. Add a purge of rows older than ~30 days to the purge-expired cron.
**Suggested test cases:**
- Simulate handler interruption (ledger row exists, no state change) then redeliver → event must process
- Ledger purge removes rows older than retention window

> Adversarial verification: **confirmed** (calibrated severity Medium). Attempted refutation failed; every element of the claim holds. (1) Insert-first ledger: pages/api/webhooks/stripe.ts:76-78 inserts the ProcessedStripeEvent row before the handler switch (94-113); duplicates short-circuit at 82-88 returning 200 {duplicate:true} on P2002. (2) Thrown errors are handled correctly (catch at 114, rollback delete at 122, 500 at 146), but process death is not: the ledger 

---

### 52. Unset STRIPE_PRICE_* env vars silently disable all paid checkouts with a misleading 'Invalid tier' error

**Severity:** Medium  
**Feature area:** Configuration / tier definitions  
**User type affected:** Broker  
**Status:** Needs manual verification  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** payments

**Files:** lib/stripe.ts, pages/api/stripe/create-checkout.ts, pages/broker/billing.tsx
**Line references:** lib/stripe.ts:19-27, pages/api/stripe/create-checkout.ts:18-21, pages/broker/billing.tsx:240-243
**Current behavior:** TIER_PRICE_MAP reads STRIPE_PRICE_BASIC/PRO/PREMIUM at module load with no fallback and no startup validation. If any is unset in the deployment env, getPriceIdForTier returns undefined and create-checkout responds 400 {error:'Invalid tier'} for that tier. The frontend swallows non-ok responses (console.error only), so the broker clicks Upgrade and nothing visibly happens. getTierForPriceId would also mis-map: an unset tier's undefined matches... (it iterates entries; undefined ids only match undefined priceId inputs, which are guarded). Cannot verify Vercel env vars from code.
**Expected behavior:** Boot-time (or first-use) assertion that all three price IDs are configured, and a distinct 500/configuration error rather than 'Invalid tier'.
**User impact:** A single missing env var in a new environment silently kills all revenue with no alert.
**Technical cause:** Optional env reads with undefined propagated into a user-input-shaped 400.
**Frontend impact:** Billing page gives no feedback on failure (see missing-states).
**Backend impact:** Add an env assertion in getStripe()/module init mirroring the STRIPE_WEBHOOK_SECRET check in the webhook (webhook.ts:45-48).
**Database impact:** None.
**Exact recommended fix:** Throw at first use if any STRIPE_PRICE_* is missing (like getSafeRedirectOrigin does for NEXTAUTH_URL), log loudly, and surface a translated error toast on the billing page.
**Suggested test cases:**
- Unset STRIPE_PRICE_PRO → create-checkout for PRO returns 500 config error, not 400 Invalid tier
- Verify production Vercel env contains all three price IDs matching live Stripe prices (manual)

> Adversarial verification: **confirmed** (calibrated severity Medium). Attempted to refute; could not. Every element of the claim checks out against the code.

1. No fallback, no validation at module load. /Users/hyunseokcho/Documents/GitHub/mortly/lib/stripe.ts:19-23 declares `TIER_PRICE_MAP: Record<string, string | undefined>` reading `process.env.STRIPE_PRICE_BASIC/PRO/PREMIUM` directly; the type annotation explicitly permits undefined, and getPriceIdForTier (line

---

### 53. Admin credit adjustments are silently wiped at the broker's next renewal (overwrite semantics)

**Severity:** Medium  
**Feature area:** Credits — admin grants vs renewal grants  
**User type affected:** Admin  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Medium  
**Found by:** payments

**Files:** pages/api/admin/credits.ts, pages/api/webhooks/stripe.ts
**Line references:** pages/api/admin/credits.ts:40-49, pages/api/webhooks/stripe.ts:286-292, pages/api/webhooks/stripe.ts:207-213
**Current behavior:** Admin credits endpoint increments responseCredits (audited, capped). But every invoice.paid / checkout.session.completed / tier-change webhook OVERWRITES responseCredits to the tier's configured amount (responseCredits: credits, not increment). Any admin-granted bonus (e.g. goodwill compensation) silently disappears at the next monthly renewal. Unused monthly credits also never roll over — consistent with 'X per month' copy, but admin grants share the same fate.
**Expected behavior:** Either documented hard-reset semantics admins are aware of, or a separate bonusCredits balance that survives renewals.
**User impact:** Brokers compensated with bonus credits lose them within at most one billing cycle; support escalations repeat.
**Technical cause:** Single responseCredits column serves both monthly allowance and manual grants; webhooks treat it as fully derived state.
**Frontend impact:** Admin UI gives no warning that grants are temporary.
**Backend impact:** Option: add Broker.bonusCredits consumed after monthly credits, untouched by webhooks; or change webhook grant to max(current, tierAmount) — weaker.
**Database impact:** Possible new column bonusCredits.
**Exact recommended fix:** Decide the product semantics; minimally add a note in the admin credit UI ('resets at next renewal'), ideally split bonus credits into a separate column the webhook never writes.
**Suggested test cases:**
- Admin grants +10 to BASIC broker (5/mo) → invoice.paid → assert intended balance (15 or documented 5)
- Concurrency: admin negative adjust racing webhook overwrite

> Adversarial verification: **confirmed** (calibrated severity Medium). Every factual element verified. pages/api/admin/credits.ts:43 increments responseCredits (capped at 10,000 per line 19, audited via adminAction rows at lines 50-63). But pages/api/webhooks/stripe.ts assigns rather than increments the balance: invoice.paid renewal sets responseCredits: credits at line 290, checkout.session.completed at line 211, and tier change (customer.subscription.updated) at li

---

### 54. Lapsed/free brokers retain full messaging in existing conversations (no entitlement check on messages)

**Severity:** Medium  
**Feature area:** Subscription lapse behavior  
**User type affected:** Broker  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** payments

**Files:** pages/api/messages/index.ts, pages/api/webhooks/stripe.ts, pages/api/conversations/index.ts
**Line references:** pages/api/webhooks/stripe.ts:314-318, pages/api/conversations/index.ts:242-244
**Current behavior:** Credits/tier only gate NEW conversation creation. pages/api/messages/index.ts contains no subscriptionTier/responseCredits/status checks (grep verified), and no webhook handler touches Conversation rows. After cancellation, expiry, or payment failure, a broker keeps unlimited messaging in every existing ACTIVE conversation until the auto-close cron retires inactive threads. The payment_failed handler's stated rationale ('past-due brokers kept messaging clients') is therefore only partially achieved — it stops new intros, not ongoing messaging.
**Expected behavior:** Deliberate product decision, documented: either lapsed brokers keep existing threads (reasonable for in-flight deals) or messaging is restricted on PAST_DUE/EXPIRED.
**User impact:** Brokers can stockpile conversations on PREMIUM for one month, downgrade to FREE, and service all of them indefinitely — undermining the per-conversation credit model.
**Technical cause:** Entitlement enforced only at conversation creation.
**Frontend impact:** None today; would need a 'subscription required' state in chat if restricted.
**Backend impact:** Optional status check in POST /api/messages for broker senders.
**Database impact:** None.
**Exact recommended fix:** Make an explicit product call; if restricting, block broker message sends when their subscription status is EXPIRED (allow PAST_DUE grace), with a translated error.
**Suggested test cases:**
- EXPIRED broker POSTs to /api/messages in an existing conversation → expected behavior per product decision

> Adversarial verification: **confirmed** (calibrated severity Medium). Tried to refute by hunting for guards elsewhere; found none. Evidence:

1. No entitlement check on message send. /Users/hyunseokcho/Documents/GitHub/mortly/pages/api/messages/index.ts (full file, 162 lines) contains zero references to subscriptionTier, responseCredits, or subscription status. The only guards are: withAuth + 30/min rate limit (line 162), participant check (lines 50-56), user-block 

---

### 55. Pricing/credit amounts hardcoded in two UI files must manually match Stripe prices and SystemSettings; no CAD label

**Severity:** Medium  
**Feature area:** Pricing display  
**User type affected:** Broker  
**Status:** Needs manual verification  
**Launch blocker:** No  
**Implementation complexity:** Medium  
**Found by:** payments

**Files:** pages/pricing.tsx, pages/broker/billing.tsx, lib/settings.ts, lib/stripe.ts
**Line references:** pages/pricing.tsx:49-114, pages/broker/billing.tsx:51-118, lib/settings.ts:10-12
**Current behavior:** Displayed prices ($29/$69/$129 with strikethrough $49/$99/$199 and discount badges) are hardcoded strings in both pricing.tsx and billing.tsx; actual charge amounts live only in the Stripe dashboard prices referenced by STRIPE_PRICE_* env vars (unverifiable from code). Credit counts shown ('5 per month'/'20 per month') are hardcoded in locale strings while actual grants come from SystemSetting rows basic_tier_credits/pro_tier_credits (defaults 5/20 — currently consistent, but an admin settings change desyncs the UI). No currency label: '$' is ambiguous between CAD and USD for a Canadian audience; invoice history does format real currency via Intl (billing.tsx:128-133).
**Expected behavior:** Single source of truth (fetch prices from Stripe or a shared config), and explicit CAD labeling on plan cards.
**User impact:** If dashboard prices or credit settings drift from UI copy, brokers are charged or credited amounts different from what was advertised — a compliance/refund risk.
**Technical cause:** Display copy duplicated and decoupled from billing configuration.
**Frontend impact:** Two plan arrays to keep in sync plus locale strings.
**Backend impact:** Optionally expose a /api/pricing endpoint deriving amounts from Stripe prices + settings.
**Database impact:** None.
**Exact recommended fix:** Verify live Stripe prices are CAD $29/$69/$129; add 'CAD' to the price display; consolidate the plan definitions into one shared module; consider rendering credit counts from the settings values.
**Suggested test cases:**
- Manual: compare Stripe dashboard price amounts/currency to UI
- Change basic_tier_credits setting → verify UI claim still matches grants

> Adversarial verification: **confirmed** (calibrated severity Medium). All claimed facts verify. (1) Prices $29/$69/$129 with strikethrough $49/$99/$199 and 41%/30%/35% badges are hardcoded twice: pages/pricing.tsx:49-114 and pages/broker/billing.tsx:51-118 (usePlans). (2) Actual charge amounts are determined solely by Stripe dashboard prices via STRIPE_PRICE_* env vars (lib/stripe.ts:19-27) consumed by pages/api/stripe/create-checkout.ts:18,71,96 — the UI numbers pl

---

### 56. Default Open Graph image returns 404 on every page (asset renamed/moved)

**Severity:** Medium  
**Feature area:** SEO / social sharing  
**User type affected:** All  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** public-deploy

**Files:** components/SEO.tsx, public/og-default-1.png, public/logo/og-default.png
**Line references:** components/SEO.tsx:21, components/SEO.tsx:55-57, components/SEO.tsx:64
**Current behavior:** SEO.tsx defaults ogImage to `${SITE_URL}/og-default.png`. public/ root contains only og-default-1.png; the real image sits at public/logo/og-default.png (served at /logo/og-default.png). No page in the repo passes an ogImage prop (verified by grep), so og:image and twitter:image point to a 404 on every page.
**Expected behavior:** og:image resolves to an existing 1200x630 asset so link previews (KakaoTalk, iMessage, X, Facebook) render with an image.
**User impact:** Every shared link to mortly.ca renders without a preview image — significant for a marketplace whose Korean-Canadian audience shares heavily via KakaoTalk.
**Technical cause:** Asset was renamed to og-default-1.png / moved to /logo/og-default.png without updating the hardcoded default in components/SEO.tsx:21.
**Frontend impact:** One-line path fix in SEO.tsx or rename the file back to public/og-default.png.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Rename public/og-default-1.png → public/og-default.png (or change SEO.tsx:21 to /logo/og-default.png), and verify dimensions are 1200x630 to match the declared og:image:width/height.
**Suggested test cases:**
- curl -I https://mortly.ca/og-default.png returns 200 with image/png.
- Validate a marketing URL in opengraph.xyz / Kakao debugger and confirm the preview image renders.
- Unit test SEO component: default ogImage matches an asset that exists in public/.

> Adversarial verification: **confirmed** (calibrated severity Medium). Every element of the claim verifies against the repo. components/SEO.tsx:21 defaults ogImage to `${SITE_URL}/og-default.png`, emitted as og:image (line 55) and twitter:image (line 64). public/ root contains only og-default-1.png (1200x630); og-default.png exists only under public/logo/ (served at /logo/og-default.png). Grep confirms no page passes an ogImage prop and no other component emits og:im

---

### 57. Generated sitemap leaks /en-prefixed auth-only routes and emits broken /en/en hreflang alternates; robots.txt does not cover /en/ private paths

**Severity:** Medium  
**Feature area:** SEO / sitemap / robots  
**User type affected:** All  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** public-deploy

**Files:** next-sitemap.config.js, public/sitemap-0.xml, public/robots.txt, package.json
**Line references:** next-sitemap.config.js:5-21, public/sitemap-0.xml:13-35 (urls like https://mortly.ca/en/borrower/dashboard, https://mortly.ca/en/login), public/robots.txt:3-12, package.json:9 (postbuild: next-sitemap)
**Current behavior:** The exclude patterns ('/admin/*','/borrower/*','/login',...) only match unprefixed paths, so the generated sitemap-0.xml (committed, regenerated every deploy via postbuild) advertises /en/borrower/dashboard, /en/borrower/messages, /en/broker/billing, /en/login, /en/signup, /en/forgot-password, /en/reset-password, /en/verify-email, /en/404, /en/500, plus the bare /borrower and /broker redirect stubs ('/borrower/*' does not match '/borrower'). alternateRefs naive concatenation produces hreflang en URLs like https://mortly.ca/en/en/pricing for every /en page, and ko alternates of /en pages point back at the /en URL. robots.txt Disallow rules ('/borrower/', '/login') are prefix-based and do not block the /en/ variants, so these private pages are crawlable AND sitemap-advertised.
**Expected behavior:** Sitemap contains only the 9 public marketing URLs in both locales with correct reciprocal hreflang; robots.txt blocks both locale variants of private routes.
**User impact:** Search engines index login-redirect shells of dashboard/messages pages, dilute crawl budget, and receive contradictory hreflang signals — degraded bilingual SEO at launch.
**Technical cause:** next-sitemap exclude globs don't account for the i18n locale prefix, and alternateRefs in next-sitemap v4 appends the locale path to each alternate base without stripping the existing /en prefix.
**Frontend impact:** None (config only).
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Add '/en/admin/*','/en/borrower/*','/en/broker/*','/en/login','/en/signup','/en/forgot-password','/en/reset-password','/en/verify-email','/en/select-role','/en/404','/en/500','/borrower','/broker','/en/borrower','/en/broker' to exclude (or use a transform fn filtering any path containing those segments); fix alternateRefs via the documented transform that rewrites hreflang for prefixed locales; mirror the /en/ Disallow lines into robots.txt; regenerate and re-commit sitemap-0.xml.
**Suggested test cases:**
- After build, grep sitemap-0.xml for 'borrower' and 'login' — expect zero matches.
- Assert no <loc>/<xhtml:link> contains '/en/en/'.
- Each public URL pair (ko ↔ en) has reciprocal hreflang entries.
- robots.txt blocks /en/borrower/dashboard per Google robots tester.

---

### 58. /pricing is auth-gated (redirects logged-out visitors) yet sitemap-advertised, and its static HTML prerenders empty

**Severity:** Medium  
**Feature area:** Pricing / SEO  
**User type affected:** All  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** public-deploy

**Files:** pages/pricing.tsx, public/sitemap-0.xml, components/Navbar.tsx
**Line references:** pages/pricing.tsx:30-39, pages/pricing.tsx:45-47, public/sitemap-0.xml:9 (pricing url), components/Navbar.tsx:130-136
**Current behavior:** useEffect redirects unauthenticated visitors to /signup?role=broker and borrowers to /borrower/dashboard; the component returns null while status==='loading' || !session, so the SSG-prerendered HTML contains no content and no <SEO> meta tags at all. The sitemap lists /pricing and /en/pricing, robots allows it, and meta.pricingTitle/Desc keys exist but are never emitted. Navbar shows the Pricing link only to BROKER sessions, so prospective brokers can never see pricing before creating an account.
**Expected behavior:** Either pricing is a public marketing page (rendered statically with meta, CTAs adapting to session) or it is removed from the sitemap and noindexed.
**User impact:** Prospective brokers must sign up before seeing prices (conversion friction); crawlers index a blank page; ad/SEO traffic to /pricing bounces through signup.
**Technical cause:** Client-side auth gate (lines 30-47) wraps what is structurally a marketing page built with getStaticProps.
**Frontend impact:** Remove the redirect/null-gate and render publicly with session-aware CTAs, or add noindex + sitemap exclusion.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Make /pricing publicly viewable (it contains no private data — tiers/FAQ only) with goToBilling falling back to /signup?role=broker for logged-out users; otherwise exclude it from next-sitemap.config.js and pass noindex to <SEO>.
**Suggested test cases:**
- curl the prerendered /pricing HTML: expect tier names and <title> from meta.pricingTitle (currently absent).
- Visit /pricing logged out: see pricing (or, if intentionally gated, confirm it is not in sitemap-0.xml).
- Broker session: CTA buttons route to /broker/billing.

> Adversarial verification: **confirmed** (calibrated severity Medium). Every element of the claim holds against the code. (1) pages/pricing.tsx:30-39 client-redirects unauthenticated visitors to /signup?role=broker and borrowers to /borrower/dashboard; lines 45-47 return null for loading/!session/BORROWER. (2) The page is SSG (getStaticProps, pricing.tsx:328-332); during prerender useSession has no session so the component returns null before <SEO> at line 143 — the 

---

### 59. Homepage 'live' stats (500+ requests, 50+ verified brokers, 95% satisfaction) are static copy rendered inside the LIVE marketplace card

**Severity:** Medium  
**Feature area:** Homepage / marketing claims  
**User type affected:** All  
**Status:** Needs manual verification  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** public-deploy

**Files:** pages/index.tsx, public/locales/en/common.json, public/locales/ko/common.json
**Line references:** pages/index.tsx:100-104, pages/index.tsx:149-163, public/locales/en/common.json (home.social.stat1Value='500+', stat2Value='50+', stat3Value='95%')
**Current behavior:** The hero card mixes a genuinely live request list (DB-backed) and a 'LIVE · N OPEN' counter with four hardcoded stats from translation files: '500+ Requests Submitted', '50+ Verified Brokers', '95% Satisfaction Rate', '0 Fees for Borrowers'. The first three are static strings with no data source; three of them also appear as checkmarked claims under the hero CTA (lines 100-104). The adjacent placement inside the live card presents them as live marketplace metrics.
**Expected behavior:** Quantitative marketplace claims are either backed by real data (queried like liveRequests) or removed/reworded before public launch.
**User impact:** If actual counts are lower (pre-launch), this is fabricated social proof — a dark pattern and misleading-representation risk that also erodes trust with the close-knit Korean-Canadian community.
**Technical cause:** Marketing placeholder values committed to common.json; no API/DB binding.
**Frontend impact:** Replace with computed counts (e.g. prisma counts in getStaticProps next to liveRequests) or soften to qualitative copy.
**Backend impact:** Optional count queries in the existing getStaticProps.
**Database impact:** None.
**Exact recommended fix:** Verify the numbers against production data; if unverifiable, compute them in getStaticProps (count of requests / verified brokers) and drop the satisfaction-rate claim until you have survey data.
**Suggested test cases:**
- Compare prisma.borrowerRequest.count() and verified Broker count against the displayed values.
- Snapshot test: hero stats derive from props, not literal locale strings.

> Adversarial verification: **confirmed** (calibrated severity Medium). Confirmed by direct code inspection. pages/index.tsx:149-163 renders the four stats exclusively from translation keys (t("home.social.stat1Value") etc.) with no props/API/DB binding; public/locales/en/common.json:85-92 and ko/common.json:85-92 hardcode "500+", "50+", "95%", "0". The same card genuinely is live elsewhere: line 115 renders `LIVE · ${liveRequests.length} OPEN` and lines 119-140 rende

---

### 60. Fabricated anchor pricing: 'was $49/$99/$199' strikethrough prices with 41%/30%/35% OFF badges hardcoded in pricing page

**Severity:** Medium  
**Feature area:** Pricing / marketing claims  
**User type affected:** Broker  
**Status:** Needs manual verification  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** public-deploy

**Files:** pages/pricing.tsx
**Line references:** pages/pricing.tsx:69-71, pages/pricing.tsx:85-87, pages/pricing.tsx:101-103, pages/pricing.tsx:180-189
**Current behavior:** originalPrice/discount are hardcoded constants ($49→$29 '41% OFF', $99→$69 '30% OFF', $199→$129 '35% OFF') rendered with strikethrough + red discount badges. There is no time-limited promotion logic, no end date, and (for a pre-launch product) presumably no period during which the higher 'ordinary price' was actually charged.
**Expected behavior:** Reference prices comply with Competition Act ordinary-selling-price rules (price actually offered for a substantial period) or are removed.
**User impact:** Brokers are induced by a perpetual fake discount; regulatory/misleading-advertising exposure and trust damage when the 'sale' never ends.
**Technical cause:** Static marketing values in the tiers[] array.
**Frontend impact:** Remove originalPrice/discount fields or wire to a real, time-bounded promotion.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Confirm with counsel/founder whether the $49/$99/$199 prices were ever genuinely charged; if not, remove the strikethrough anchors and OFF badges before launch (also verify $29/$69/$129 match the Stripe dashboard amounts behind STRIPE_PRICE_BASIC/PRO/PREMIUM).
**Suggested test cases:**
- Compare Stripe dashboard price amounts for the three price IDs to the displayed $29/$69/$129.
- If discounts kept: assert promotion has an end date and the page reflects it.

> Adversarial verification: **confirmed** (calibrated severity Medium). Tried to refute and could not. Verified all cited code: /Users/hyunseokcho/Documents/GitHub/mortly/pages/pricing.tsx lines 69-71 (BASIC $29, originalPrice "$49", discount "41%"), 85-87 (PRO $69/"$99"/"30%"), 101-103 (PREMIUM $129/"$199"/"35%") are static constants in the tiers[] array, rendered at lines 180-188 with `line-through` styling on originalPrice and a red badge `{tier.discount} {t("misc.

---

### 61. Privacy page has no last-updated/effective date and omits key PIPEDA specifics (180-day retention, public homepage display of request data)

**Severity:** Medium  
**Feature area:** Legal / PIPEDA  
**User type affected:** All  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** public-deploy

**Files:** pages/privacy.tsx, pages/terms.tsx, lib/legal.ts, lib/settings.ts, pages/index.tsx
**Line references:** pages/privacy.tsx:122-139 (hero — no date rendered anywhere in file), pages/terms.tsx:111-113 (terms DOES render lastUpdated), lib/legal.ts:1 (CURRENT_LEGAL_VERSION='2026-04-06'), lib/settings.ts:12-15 (request_retention_days: '180', commented as 'PIPEDA retention'), pages/index.tsx:325-348 (public display of request city/province/product/status)
**Current behavior:** The privacy page is a bilingual 'Trust & Privacy' marketing-style page that does disclose data categories, all five processors, access/correction/deletion requests, and generic retention language ('subject to legal and operational retention needs'). It renders no version/effective date even though consent is versioned (CURRENT_LEGAL_VERSION) and users accept a specific version at signup. The concrete 180-day post-terminal purge (purge-expired cron) is not disclosed, and neither privacy nor terms mention that anonymized request details (product type, city, province, status) are shown on the public homepage (verified: no 'homepage/publicly' language in en privacy/terms strings).
**Expected behavior:** Privacy policy displays its effective date matching CURRENT_LEGAL_VERSION, states the actual retention schedule, and discloses the public live-activity feed; PIPEDA also expects a complaint route (designated privacy officer / OPC).
**User impact:** Users cannot tell which policy version they accepted; transparency obligations (PIPEDA Principles 4.8/4.5) only partially met; borrowers don't know their request appears (anonymized) on the public homepage.
**Technical cause:** Privacy page was built as marketing content; lib/legal.ts version was never surfaced there; live-feed feature added without a legal-text update.
**Frontend impact:** Add a lastUpdated line (reuse terms pattern) sourced from CURRENT_LEGAL_VERSION; add retention + public-feed disclosure strings in ko+en.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Render CURRENT_LEGAL_VERSION as the policy effective date on /privacy, add ko+en copy for the 180-day anonymization schedule and the anonymized public live feed, and have a privacy professional confirm PIPEDA/Law 25 sufficiency.
**Suggested test cases:**
- /privacy (ko and en) shows an effective date equal to lib/legal.ts CURRENT_LEGAL_VERSION.
- Privacy text search for retention period and public-feed disclosure passes in both locales.

> Adversarial verification: **confirmed** (calibrated severity Medium). Every factual element of the claim holds up under adversarial checking.

1. No date on privacy page: Read the entire pages/privacy.tsx (369 lines) — no version/effective date is rendered anywhere; it imports nothing from lib/legal.ts and there is no privacy.lastUpdated key in the locale files. By contrast, pages/terms.tsx:111-113 renders t("terms.lastUpdated"), which resolves to "Last Updated: Apr

---

### 62. CI runs no lint, typecheck, or production build; E2E skipped on unlabeled PRs

**Severity:** Medium  
**Feature area:** Build & deployment / CI  
**User type affected:** Admin  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** public-deploy

**Files:** .github/workflows/test.yml, package.json
**Line references:** .github/workflows/test.yml:14-57 (vitest job only), .github/workflows/test.yml:59-64 (e2e gated on push-to-main or 'run-e2e' label), package.json:11 (lint script exists but never invoked in CI)
**Current behavior:** PRs run only Vitest with coverage. `next build` (which performs the production type-check), `next lint`, and `tsc --noEmit` are never executed in CI; e2e (2 specs) runs only post-merge on main or when a PR carries the run-e2e label. Local `npx tsc --noEmit` currently passes (exit 0).
**Expected behavior:** Type errors and build breaks are caught pre-merge; at minimum tsc --noEmit + next build on PRs.
**User impact:** A PR that type-checks-fails or breaks the production build can merge green and only fail at Vercel deploy time.
**Technical cause:** Workflow only defines unit-and-integration and conditional e2e jobs.
**Frontend impact:** None.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Add a job (or steps) running `npx tsc --noEmit`, `npm run lint`, and `npm run build` on every PR; consider running the cheap auth e2e spec on PRs unconditionally.
**Suggested test cases:**
- Open a PR with a deliberate type error: CI must fail.
- Open a PR breaking next build (e.g. invalid getStaticProps return): CI must fail.

> Adversarial verification: **confirmed** (calibrated severity Medium). Could not refute; every assertion checks out against the repo. .github/workflows/test.yml is the only workflow file and defines exactly two jobs: unit-and-integration (lines 14-57, runs only `npm run test:coverage` at line 49 after `npm ci` and `prisma generate`) and e2e (lines 59-126, gated at line 64 by `if: github.event_name == 'push' || contains(github.event.pull_request.labels.*.name, 'run-e2

---

### 63. Server accepts requests the client would reject: desiredTimeline, residential notes, and annualIncome are unvalidated; incomeTypes/timeline not enum-checked; province free-form

**Severity:** Medium  
**Feature area:** Request creation API parity  
**User type affected:** Borrower  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Medium  
**Found by:** request-form

**Files:** pages/api/requests/index.ts, components/RequestForm.tsx, lib/requestConfig.ts, lib/validate.ts
**Line references:** pages/api/requests/index.ts:146-150, pages/api/requests/index.ts:164-180, components/RequestForm.tsx:249-268, components/RequestForm.tsx:301-321, components/RequestForm.tsx:909, lib/requestConfig.ts:70-76
**Current behavior:** Field-by-field parity: mortgageCategory enum (both); productTypes enum-per-category (both); province required (both) but server accepts ANY string <=100, client restricts to 13 names; city optional <=100 (both, client has no maxLength); desiredTimeline REQUIRED + enum-restricted client-side (isStep2Valid + select options) but OPTIONAL free string <=200 server-side (TIMELINE_OPTIONS in lib/requestConfig.ts:70-76 is never used by the server); notes REQUIRED for both categories client-side (submit disabled, line 909) but only required for COMMERCIAL server-side; purposeOfUse enum-validated (both); incomeTypes non-empty (both) but item VALUES unvalidated server-side (any JSON values pass); annualIncome with a filled current-year required client-side, completely unvalidated server-side; incomeTypeOther/businessType/ownerNetIncome/corporateAnnualIncome/corporateAnnualExpenses shapes unvalidated server-side (only details total <=4096 chars); commercial income/expense year-pairing rule is CLIENT-ONLY (RequestForm.tsx:301-321).
**Expected behavior:** Server enforces at least the same enums/required fields the client does, since mobile/native/direct API calls share this endpoint.
**User impact:** Direct API or future mobile clients can create requests brokers see as incomplete/garbled (no income, arbitrary 'province', non-enum timeline rendered raw via t() fallback). Broker marketplace data quality degrades.
**Technical cause:** POST handler validates only a subset; TIMELINE_OPTIONS and the 13-province list exist but are not imported by the API.
**Frontend impact:** None required.
**Backend impact:** Add assertEnum(desiredTimeline, TIMELINE_OPTIONS), validate province against a shared canonical list, validate incomeTypes items against INCOME_TYPES, validate annualIncome map shape (year keys, digit strings), enforce year-pairing for commercial, bound businessType/incomeTypeOther lengths individually.
**Database impact:** Existing rows may already contain unvalidated shapes.
**Exact recommended fix:** Move the province list and detail-shape validators into lib/requestConfig.ts / lib/validate.ts and apply in both POST and PATCH.
**Suggested test cases:**
- POST with desiredTimeline: 'whenever I feel like it' → expect 400 (currently 201)
- POST residential with details.annualIncome absent → expect 400 (currently 201)
- POST with province: 'Seoul' → expect 400 (currently 201)
- POST with incomeTypes: [123] → expect 400 (currently 201)

> Adversarial verification: **confirmed** (calibrated severity Medium). Every field-level assertion verified against the code. Server (pages/api/requests/index.ts POST): province = assertString max 100, any string (line 146) vs client 13-province select (RequestForm.tsx:13-27, 537-549); desiredTimeline = assertOptionalString max 200 (line 148) vs client required (RequestForm.tsx:254) + 5 enum-only select options (lines 783-788) — TIMELINE_OPTIONS (lib/requestConfig.ts

---

### 64. PATCH handler skips category-specific validation entirely and 500s on malformed mortgageCategory/productTypes

**Severity:** Medium  
**Feature area:** Request edit API  
**User type affected:** Borrower  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** request-form

**Files:** pages/api/requests/[id].ts
**Line references:** pages/api/requests/[id].ts:194-202, pages/api/requests/[id].ts:217-231, pages/api/requests/[id].ts:224
**Current behavior:** (1) mortgageCategory is spread into prisma update unvalidated (line 224) — an invalid enum value throws PrismaClientValidationError → generic 500. (2) validateProductTypes() runs BEFORE the Array.isArray check (lines 195-201) — a non-array productTypes (e.g. a string) makes products.every throw TypeError → 500. (3) None of POST's category-specific rules apply: a borrower can PATCH details to remove purposeOfUse/incomeTypes/businessType, or flip mortgageCategory to COMMERCIAL while keeping residential-shaped details and no notes.
**Expected behavior:** PATCH applies the same shape validation as POST and returns 400 for malformed input.
**User impact:** Edited requests can end up self-inconsistent (commercial request with residential details), which broker detail pages then render as 'not specified' blocks; malformed input produces 500s instead of helpful 400s.
**Technical cause:** Validation logic duplicated between POST and PATCH and only partially copied.
**Frontend impact:** None (UI can't produce these payloads), but error states would be clearer with 400s.
**Backend impact:** Reorder Array.isArray before validateProductTypes; assertEnum mortgageCategory; extract POST's category-specific block into a shared function and run it on PATCH against the merged (existing + patch) state.
**Database impact:** Possible inconsistent category/details rows.
**Exact recommended fix:** Shared validateRequestPayload(category, productTypes, details, notes) used by both handlers.
**Suggested test cases:**
- PATCH mortgageCategory: 'INDUSTRIAL' → expect 400 (currently 500)
- PATCH productTypes: 'NEW_MORTGAGE' (string) → expect 400 (currently 500)
- PATCH details: {} on a RESIDENTIAL request → expect 400 (currently 200)

> Adversarial verification: **confirmed** (calibrated severity Medium). All three sub-claims verified against the code; I could not refute any of them.

(1) Unvalidated mortgageCategory -> 500. PATCH destructures mortgageCategory from req.body (pages/api/requests/[id].ts:162-170) with no enum check, then spreads it into the update at line 224 (`...(mortgageCategory && { mortgageCategory })`). The Prisma schema defines it as an enum (`mortgageCategory MortgageCategory 

---

### 65. Province list mismatch: borrower form offers 13 provinces/territories, broker filter/onboarding/profile only 10

**Severity:** Medium  
**Feature area:** Province selection  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** request-form

**Files:** components/RequestForm.tsx, pages/broker/requests/index.tsx, pages/broker/onboarding.tsx, pages/broker/profile.tsx
**Line references:** components/RequestForm.tsx:13-27, pages/broker/requests/index.tsx:22-33, pages/broker/onboarding.tsx:15-26, pages/broker/profile.tsx:20-31
**Current behavior:** Borrower form includes Northwest Territories, Nunavut, and Yukon; the broker browse filter, broker onboarding, and broker profile lists omit all three territories. Four separately hardcoded copies of the list exist. The broker GET filter does exact string equality on province (pages/api/requests/index.ts:32-34).
**Expected behavior:** One shared canonical list (ideally codes, not English display names) used by borrower form, broker filter, and broker profile; province display localized to Korean.
**User impact:** A borrower in Yukon/NWT/Nunavut can post a request that no broker can filter for (it only appears under 'all provinces'); a broker based in a territory cannot select their own province at all. Province names also display in English even in the Korean UI.
**Technical cause:** Four divergent hardcoded arrays; full English names stored as data.
**Frontend impact:** Consolidate into lib/requestConfig.ts (or a new lib/provinces.ts) with label keys for ko/en.
**Backend impact:** Validate province against the shared list.
**Database impact:** Existing rows store full English names; migrating to codes would need a data migration.
**Exact recommended fix:** Export PROVINCES from one module with i18n label keys; add the 3 territories to broker pages; validate server-side.
**Suggested test cases:**
- Broker filter dropdown contains all 13 entries
- Broker onboarding allows Yukon
- Request with province 'Nunavut' is findable via filter

> Adversarial verification: **confirmed** (calibrated severity Medium). Every factual assertion checks out against the code. (1) components/RequestForm.tsx:13-27 hardcodes a 13-entry PROVINCES array including "Northwest Territories" (line 19), "Nunavut" (line 21), and "Yukon" (line 26); it is rendered as a required <select> (lines 538-544), so borrowers genuinely can pick a territory. (2) pages/broker/requests/index.tsx:22-33, pages/broker/onboarding.tsx:15-26, and pa

---

### 66. No server-side idempotency for submission; max-active-requests cap has a count-then-create race; double-click can double-submit

**Severity:** Medium  
**Feature area:** Request creation  
**User type affected:** Borrower  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Medium  
**Found by:** request-form

**Files:** pages/api/requests/index.ts, components/RequestForm.tsx
**Line references:** pages/api/requests/index.ts:183-210, components/RequestForm.tsx:296-341, components/RequestForm.tsx:907-915
**Current behavior:** Client protection is only the `submitting` state on the submit button (set asynchronously via setState — two rapid clicks/Enter presses before re-render both invoke handleSubmit). Server-side: no idempotency key; the active-request cap is a non-transactional count() followed by create(), so two concurrent POSTs both pass the check. Rate limit (10/min) does not prevent 2 quick submissions.
**Expected behavior:** At-most-once creation per user action; cap enforced atomically.
**User impact:** Duplicate identical requests appear in the broker marketplace and count against the borrower's cap; brokers may spend credits contacting duplicates.
**Technical cause:** No idempotency token; no transaction/unique constraint guarding the cap.
**Frontend impact:** Guard handleSubmit with a ref (if (submittingRef.current) return).
**Backend impact:** Wrap count+create in a serializable transaction, or accept a client-generated idempotency key and upsert on it; optionally dedupe identical payloads within a short window.
**Database impact:** Optional unique constraint on (borrowerId, contentHash, createdAt-bucket).
**Exact recommended fix:** Add ref-based double-fire guard client-side plus a transactional cap check server-side.
**Suggested test cases:**
- Fire 2 concurrent POSTs at cap-1 active requests → only one succeeds
- Double-click submit button → one request created

> Adversarial verification: **confirmed** (calibrated severity Medium). Server-side claim fully verified: pages/api/requests/index.ts:183-194 performs a non-transactional count() of active requests, then lines 196-210 do generateRequestPublicId() (an extra DB round-trip widening the TOCTOU window) followed by create(), with no $transaction, no lock, and no DB constraint enforcing the cap — two concurrent POSTs both pass the check. No idempotency key exists anywhere in

---

### 67. Currency amounts stored as browser-locale-formatted display strings in the DB

**Severity:** Medium  
**Feature area:** Currency inputs  
**User type affected:** Borrower  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** request-form

**Files:** components/RequestForm.tsx, pages/borrower/request/[id].tsx, components/broker/RequestDetailBlocks.tsx
**Line references:** components/RequestForm.tsx:208-214, components/RequestForm.tsx:226-232, components/RequestForm.tsx:759-762, components/broker/RequestDetailBlocks.tsx:155-158
**Current behavior:** Input handlers strip non-digits then store Number(digits).toLocaleString() — using the BROWSER'S default locale, not the app locale — directly into details JSON. en-CA/ko-KR both produce '100,000', but a user with a de-DE system locale stores '100.000', fr-FR stores '100 000' (narrow no-break space), hi-IN '1,00,000'. Brokers see the raw string prefixed with '$'. Amounts are never stored as numbers, so no sorting/filtering/analytics on income is possible.
**Expected behavior:** Store the raw numeric value (or canonical digit string); format with the viewer's locale at render time.
**User impact:** Inconsistent/odd-looking financial figures shown to brokers for users on non-English/Korean systems; future features (income filters, matching) blocked by string storage.
**Technical cause:** Display formatting applied at input time and persisted.
**Frontend impact:** Keep digits in state, format only in the input's value prop via a fixed locale (en-CA).
**Backend impact:** Optionally normalize on write (strip non-digits) for new rows.
**Database impact:** Existing rows hold mixed formatted strings.
**Exact recommended fix:** Persist plain digit strings/numbers; render with toLocaleString('en-CA') (or locale-aware) on display.
**Suggested test cases:**
- Submit income with browser locale de-DE → stored value parses as number
- Broker view renders $100,000 regardless of submitter locale

> Adversarial verification: **confirmed** (calibrated severity Medium). Every factual element holds. (1) components/RequestForm.tsx:208-214, 226-232, and 759-762 all store `Number(digits).toLocaleString()` with no locale argument into the details JSON — this uses the browser's default locale, not the app locale. Verified ICU outputs: en-CA/ko-KR -> "100,000", de-DE -> "100.000", fr-FR -> "100 000" (U+202F narrow no-break space, as claimed), hi-IN -> "1,00,000". (2) No

---

### 68. Borrower request detail page shows an infinite skeleton when the initial fetch fails

**Severity:** Medium  
**Feature area:** Request detail page  
**User type affected:** Borrower  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** request-form — also reported by: borrower-flow, ux-states

**Files:** pages/borrower/request/[id].tsx
**Line references:** pages/borrower/request/[id].tsx:69-88, pages/borrower/request/[id].tsx:141-147, pages/borrower/request/[id].tsx:188-192
**Current behavior:** fetchRequest catch sets error + loading=false but request stays null; the guard `if (loading || !request) return <Skeleton/>` (line 141) renders the skeleton forever — the error banner at line 188 is below that guard and unreachable for load failures. (404 is handled via redirect; this affects 500s/network errors.) This is the page borrowers land on immediately after submitting a new request.
**Expected behavior:** A visible error state with retry when the request fails to load.
**User impact:** After submitting, a transient API failure leaves the borrower staring at a permanent loading skeleton with no feedback.
**Technical cause:** Error state not consulted in the early-return guard.
**Frontend impact:** Render an error card with retry when error && !request.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** if (!loading && !request) return <ErrorState onRetry={fetchRequest} />.
**Suggested test cases:**
- Mock fetch 500 → error message + retry button visible
- Retry after failure reloads successfully

> Adversarial verification: **confirmed** (calibrated severity Medium). Every cited line checks out. In pages/borrower/request/[id].tsx, fetchRequest (lines 69-88) redirects only on 404; any other failure throws, the catch sets error, finally sets loading=false, and `request` stays null (line 59). The guard at line 141 (`if (loading || !request)`) then renders SkeletonRequestDetail unconditionally and forever — there is no retry/polling (useEffect at lines 90-95 only 

---

### 69. Broker billing: checkout/portal API failures produce no user-visible feedback (console.error only)

**Severity:** Medium  
**Feature area:** Billing / Stripe  
**User type affected:** Broker  
**Status:** Confirmed  
**Launch blocker:** Yes  
**Implementation complexity:** Small  
**Found by:** ux-states — also reported by: gap:Mobile responsiveness of borrower/broker (non-admin) authed surfaces, especially chat, payments

**Files:** pages/broker/billing.tsx
**Line references:** pages/broker/billing.tsx:240-243, pages/broker/billing.tsx:296-303, pages/broker/billing.tsx:306-323
**Current behavior:** In executePlanChange, `if (!res.ok) { console.error("Checkout error:", data.error); return; }` — the button spinner stops and nothing happens. Same in handleManageSubscription: if create-portal fails or returns no url, only console.error fires. A broker clicking Upgrade on a failed Stripe call sees the page do nothing.
**Expected behavior:** Failed checkout/portal creation shows an error banner or toast with retry guidance.
**User impact:** Brokers attempting to pay get silent no-ops; likely repeated clicks, support tickets, and lost subscription revenue.
**Technical cause:** Error branches log to console instead of setting any state; the page has a successMessage state but no errorMessage state.
**Frontend impact:** Add error state + banner (Banner component already exists) in both handlers.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Introduce setErrorMessage on !res.ok and catch branches in executePlanChange and handleManageSubscription; render with the existing banner pattern; localize the Stripe error.
**Suggested test cases:**
- Mock /api/stripe/create-checkout 500 → error banner visible, button re-enabled
- Mock /api/stripe/create-portal returning {} → error banner visible

> Adversarial verification: **confirmed** (calibrated severity Medium). The cited code behaves exactly as claimed, and I found no compensating guard anywhere. Evidence: (1) pages/broker/billing.tsx:240-243 — executePlanChange does `if (!res.ok) { console.error(...); return; }`; the `finally` at :301-303 clears actionLoading, so the spinner stops and the page visibly does nothing. (2) The catch at :299-300 is console.error only. (3) handleManageSubscription (:306-323) 

---

### 70. Data-context and admin list fetch failures masquerade as designed empty states (systemic silent-error pattern)

**Severity:** Medium  
**Feature area:** Cross-cutting error states  
**User type affected:** All  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Medium  
**Found by:** ux-states — also reported by: borrower-flow, gap:Borrower onboarding / first-run experience (checklist says onboarding for BOTH roles; only broker side was reviewed)

**Files:** components/borrower/BorrowerDataContext.tsx, components/broker/BrokerDataContext.tsx, pages/borrower/dashboard.tsx, pages/admin/people.tsx, pages/admin/reports.tsx, pages/admin/activity.tsx, pages/admin/system.tsx, pages/broker/billing.tsx
**Line references:** components/borrower/BorrowerDataContext.tsx:181-183, components/broker/BrokerDataContext.tsx:210-212, pages/borrower/dashboard.tsx:71-72, pages/admin/people.tsx:124-133, pages/admin/people.tsx:451-455, pages/admin/reports.tsx:115-116, pages/admin/activity.tsx:171-176, pages/admin/system.tsx:74-87, pages/broker/billing.tsx:187-196
**Current behavior:** BorrowerDataContext/BrokerDataContext catch fetch errors and 'keep previous counters' with no error flag; borrower dashboard then renders the 'no requests yet' empty card. admin/people never destructures SWR's error so failures show '조건에 맞는 사용자가 없습니다'; admin/reports load() returns silently on !ok; admin/activity treats failed streams as {data:[]}; admin/system settings render blank on failure; billing invoices failure shows 'no billing history'.
**Expected behavior:** Fetch failures render an error banner with retry, distinct from genuine empty data.
**User impact:** During API/database incidents users see confident wrong information ('you have no requests', 'no users match', 'no billing history') instead of an error, leading to bad decisions (e.g. borrower resubmitting a request).
**Technical cause:** catch blocks swallow errors; success-path empty arrays reused as the only non-loading render branch.
**Frontend impact:** Add error state to both data contexts and the four admin pages; reuse Banner/ADrawerError patterns already in the codebase (admin inbox does this correctly).
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Expose `error` from BorrowerDataContext/BrokerDataContext and render the (currently dead) dashboard error banner; destructure SWR error in people.tsx; set error state in reports/activity/system on !res.ok.
**Suggested test cases:**
- Mock /api/requests 500 → borrower dashboard shows error banner, not 'no requests'
- Mock /api/admin/users 500 → people page shows error + retry, not empty state

> Note: Systemic: BorrowerDataContext, BrokerDataContext, and admin list pages all swallow fetch errors. During an outage borrowers are told they have no requests and invited to create duplicates.

> Adversarial verification: **confirmed** (calibrated severity Medium). Every cited location behaves exactly as claimed; I tried and failed to refute via guards elsewhere.

Evidence per file:
1. /Users/hyunseokcho/Documents/GitHub/mortly/components/borrower/BorrowerDataContext.tsx:181-183 — `catch { // keep previous counters / lists }`. Additionally the `!res.ok` branches (lines 154/168/173) silently skip, and the context value (lines 84-94) exposes no error field. Cr

---



## Low issues (71)

### 1. Admin list pages render the empty state when the fetch fails

**Severity:** Low  
**Feature area:** Admin UX  
**User type affected:** Admin  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** admin

**Files:** pages/admin/people.tsx, pages/admin/activity.tsx, pages/admin/reports.tsx, pages/admin/system.tsx
**Line references:** pages/admin/people.tsx:124-137, pages/admin/people.tsx:451-454, pages/admin/activity.tsx:171-191, pages/admin/reports.tsx:109-127, pages/admin/system.tsx:74-103
**Current behavior:** people.tsx ignores SWR's error (not destructured) so a 500 shows '조건에 맞는 사용자가 없습니다'; activity.tsx maps !res.ok to {data:[]}; reports.tsx load() returns early on !r.ok leaving an empty list; system.tsx settings/audit fetches swallow failures, rendering blank settings. Inbox and the three detail pages DO have proper error branches (ADrawerError / load-error panel).
**Expected behavior:** Distinct error state with retry on all list pages, matching the inbox pattern.
**User impact:** During backend incidents admins are told queues are empty — the opposite of the truth for a moderation tool.
**Technical cause:** Error branches omitted from fetch wrappers.
**Frontend impact:** Surface SWR error / set error state and render retry UI.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Reuse the inbox error panel for all four pages.
**Suggested test cases:**
- Mock 500 on /api/admin/users → error panel with retry, not empty message

---

### 2. Audit logging inconsistencies: three handlers skip IP/UA meta and notes-only report updates are unaudited

**Severity:** Low  
**Feature area:** Audit log  
**User type affected:** Admin  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** admin

**Files:** pages/api/admin/brokers/[id].ts, pages/api/admin/credits.ts, pages/api/admin/settings.ts, pages/api/admin/reports/[id].ts
**Line references:** pages/api/admin/brokers/[id].ts:96-140, pages/api/admin/credits.ts:50-63, pages/api/admin/settings.ts:56-64, pages/api/admin/reports/[id].ts:98-118
**Current behavior:** lib/admin/audit.ts states 'Every admin mutation records IP + user-agent', and requests/users/bulk/create/conversations/reports handlers comply via buildAdminActionCreate. But broker verification, credit adjustment, and settings updates build adminAction.create manually with no requestIp/userAgent; broker PUT's reason also bypasses validateText (unbounded). In reports/[id].ts an adminNotes-only PUT (no status change) writes no audit row at all.
**Expected behavior:** All mutations use buildAdminActionCreate; notes edits audited (or notes history kept).
**User impact:** Forensics on a compromised admin account loses IP/UA for exactly the high-value actions (credit grants, broker verification, settings).
**Technical cause:** Handlers predating the Phase-4 audit helper were not migrated.
**Frontend impact:** None.
**Backend impact:** Swap three manual creates to buildAdminActionCreate; add validateText on broker reason; audit notes updates.
**Database impact:** None.
**Exact recommended fix:** As above; extend tests/admin/audit.test.ts to assert meta presence per action type.
**Suggested test cases:**
- VERIFY_BROKER row contains requestIp/userAgent
- CREDIT_ADJUST row contains meta
- notes-only report PUT creates UPDATE_REPORT_NOTES row

---

### 3. Report detail targetDetails lookup can never match web-created reports and the result is never rendered

**Severity:** Low  
**Feature area:** Reports moderation  
**User type affected:** Admin  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** admin

**Files:** pages/api/admin/reports/[id].ts, pages/admin/reports.tsx, components/ReportButton.tsx
**Line references:** pages/api/admin/reports/[id].ts:29-52, pages/admin/reports.tsx:42-44, pages/broker/requests/[id].tsx:217, pages/borrower/brokers/[requestId].tsx:216
**Current behavior:** Web report creation stores 9-digit publicIds as targetId (request.publicId, broker.user.publicId). The detail GET resolves targetDetails with findUnique on internal id columns (broker.id / borrowerRequest.id / conversation.id), which never equal a publicId → targetDetails is always null. The drawer (ReportDrawer) declares but never renders targetDetails anyway, so the bug is invisible — dead computation that costs a query and will mislead future devs. The list endpoint handles this correctly with a publicId regex branch; the detail endpoint also skips USER targets entirely.
**Expected behavior:** Detail endpoint resolves by publicId like the list endpoint does (regex /^\d{9}$/ branch), or drop targetDetails entirely.
**User impact:** None today; blocks any future drawer enrichment.
**Technical cause:** Lookup written for cuid-shaped targetIds; creation sites send publicIds.
**Frontend impact:** Optionally render target summary card once fixed.
**Backend impact:** Mirror queue.ts/index.ts resolution logic in the detail handler.
**Database impact:** None.
**Exact recommended fix:** Share one resolveReportTarget helper across reports index/detail/queue.
**Suggested test cases:**
- BROKER report with user publicId returns broker targetDetails
- REQUEST publicId resolves
- deleted target returns null without 500

---

### 4. Rail badge counts lag the inbox after mutations because invalidate() cannot bust the 60s KV stats cache

**Severity:** Low  
**Feature area:** Admin dashboard  
**User type affected:** Admin  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** admin

**Files:** lib/admin/AdminDataContext.tsx, pages/api/admin/stats.ts
**Line references:** lib/admin/AdminDataContext.tsx:73-114, pages/api/admin/stats.ts:5-6, pages/api/admin/stats.ts:102-126
**Current behavior:** After approve/reject, pages call invalidate() which refetches /api/admin/queue (Cache-Control: no-store — fresh) and /api/admin/stats (served from KV for up to 60s plus browser private max-age=30). Result: the inbox list shrinks immediately while the rail badge and '오늘 아침 N건' headline keep the old number for up to ~90s.
**Expected behavior:** Mutation-driven refetches see fresh counts (e.g., admin mutations DEL the admin:stats:v1 KV key, or badges derive from queue counts which are already fresh).
**User impact:** Confusing mismatched counts right after taking action; mild distrust of the dashboard.
**Technical cause:** TTL cache without invalidation hook; AdminDataContext derives badges from stats instead of queue.counts.
**Frontend impact:** Simplest: compute badges from queue response counts (already returned by /api/admin/queue).
**Backend impact:** Alternative: kv.del(KV_KEY) inside withAdmin after successful mutations.
**Database impact:** None.
**Exact recommended fix:** Derive rail badges from queue.counts in AdminDataContext (one fetch fewer, always consistent).
**Suggested test cases:**
- Approve last pending request → inbox badge hits 0 immediately

---

### 5. Request status PUT allows arbitrary transitions with no guard

**Severity:** Low  
**Feature area:** Request approval flow  
**User type affected:** Admin  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** admin

**Files:** pages/api/admin/requests/[id].ts
**Line references:** pages/api/admin/requests/[id].ts:61-95
**Current behavior:** Any of the six statuses can be set from any current status: a CLOSED/EXPIRED request can be flipped to PENDING_APPROVAL or IN_PROGRESS; REJECTED can jump to IN_PROGRESS keeping its rejectionReason (only the REJECTED→OPEN path clears it, lines 86-88). Setting REJECTED on a request with active conversations leaves them open (cascade only on CLOSED). IN_PROGRESS/EXPIRED set manually bypass the marketplace lifecycle.
**Expected behavior:** A transition allowlist (e.g., PENDING_APPROVAL→{OPEN,REJECTED}, OPEN→{CLOSED,EXPIRED}, REJECTED→OPEN, …) with 409 on invalid moves; rejectionReason cleared on any move out of REJECTED.
**User impact:** Fat-fingered or scripted updates can produce inconsistent listings (e.g., EXPIRED request with live conversations) that confuse borrowers and brokers.
**Technical cause:** Validation checks membership in validStatuses only.
**Frontend impact:** None (UI only offers sane transitions today).
**Backend impact:** Add transition map; clear rejectionReason on all exits from REJECTED.
**Database impact:** None.
**Exact recommended fix:** Transition allowlist + audit of previous/new (already logged).
**Suggested test cases:**
- CLOSED→PENDING_APPROVAL → 409
- REJECTED→IN_PROGRESS → 409 or reason cleared
- PENDING_APPROVAL→OPEN ok

---

### 6. Admin UI is effectively Korean-only: 289 of 318 t() keys missing from both locale files plus many hardcoded Korean strings

**Severity:** Low  
**Feature area:** Admin i18n  
**User type affected:** Admin  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Medium  
**Found by:** admin — also reported by: i18n

**Files:** pages/admin/inbox.tsx, pages/admin/people.tsx, pages/admin/activity.tsx, pages/admin/system.tsx, components/admin/AdminShell.tsx, components/admin/UndoToast.tsx, components/admin/primitives/AConfirmDialog.tsx, lib/admin/inboxQueue.ts, public/locales/ko/common.json, public/locales/en/common.json
**Line references:** lib/admin/inboxQueue.ts:162-171, components/admin/UndoToast.tsx:72, components/admin/primitives/AConfirmDialog.tsx:48, components/admin/primitives/AConfirmDialog.tsx:129-133, pages/admin/inbox.tsx:390-398, pages/admin/system.tsx:28-44
**Current behavior:** A scripted diff of every t('…') key used in pages/admin + components/admin + lib/admin against both common.json files shows 289/318 keys (admin.inbox.*, admin.people.*, admin.activity.*, admin.brokerDetail.*, admin.userDetail.*, admin.reports.*, admin.system.*, admin.palette.*, admin.nav.*, plus common.retry, common.close, request.incomeTypeOther) absent from BOTH ko and en — only inline Korean fallback strings render, in every locale. Many more strings bypass t() entirely (formatAge units '방금/분/시간/일', UndoToast '실행 취소', AConfirmDialog default cancel '취소' and its '(선택)' hack keyed off cancelLabel==='취소', inbox row buttons '✓ 승인', detail field labels, DetailChecks/RecommendedAction text, people.tsx '크레딧/요청/대화/명' and 'Platform Admin', activity.tsx '전문가 응답/메시지/전/신청인/상업용/주거용', system.tsx GROUP_LABEL_KO and English SETTING_FIELDS labels). An English-locale admin sees a Korean UI with stray English labels.
**Expected behavior:** Per stated product scope an admin-Korean-only UI may be acceptable — but then the t() scaffolding is dead weight; if EN admin support is intended, the 289 keys must be added to both files and the hardcoded strings keyed.
**User impact:** English-speaking admins cannot use the panel; mixed-language UI looks unfinished.
**Technical cause:** New admin UI written with t(key, koFallback) pattern but keys were never extracted into the locale files.
**Frontend impact:** Key extraction + literal cleanup.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Decide policy: either document admin as ko-only and strip t(), or extract all keys to ko/en common.json and replace hardcoded literals.
**Suggested test cases:**
- i18n lint/CI check: every t() key in pages/admin exists in both locales

---

### 7. AdminShell shows a fake always-green 'all systems normal' indicator

**Severity:** Low  
**Feature area:** Admin shell  
**User type affected:** Admin  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** admin — also reported by: ux-states

**Files:** components/admin/AdminShell.tsx
**Line references:** components/admin/AdminShell.tsx:232-235
**Current behavior:** The top bar renders a pulsing green dot with '모든 시스템 정상' unconditionally — it is not connected to any health check. The adjacent error banner (lines 244-252) can simultaneously say data is stale while the green dot claims all systems normal.
**Expected behavior:** Tie the indicator to a real signal (AdminDataContext error, last successful poll) or remove it.
**User impact:** Contradictory status signals during incidents.
**Technical cause:** Static decorative JSX.
**Frontend impact:** Bind to `error` from useAdminData() at minimum.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Green when last poll succeeded, red/amber when error is set.
**Suggested test cases:**
- Queue fetch failure flips the dot

---

### 8. No enforced gate forcing OAuth users through role selection

**Severity:** Low  
**Feature area:** OAuth role-selection flow  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** auth-core

**Files:** lib/auth.ts, pages/select-role.tsx, components/borrower/BorrowerShell.tsx
**Line references:** lib/auth.ts:223-228, pages/select-role.tsx:26-42, components/borrower/BorrowerShell.tsx:79-85
**Current behavior:** OAuth account creation sets role=BORROWER + preferences.needsRoleSelection=true and OAuth callbackUrl points at /select-role. But nothing forces the user there: because their default role is already BORROWER, BorrowerShell's guard (role==='BORROWER') admits them to /borrower/dashboard with needsRoleSelection still true. A user intending to be a BROKER who closes the select-role page silently becomes a borrower.
**Expected behavior:** A user with needsRoleSelection=true should be redirected to /select-role from any app page until they choose a role.
**User impact:** Brokers who abandon the role picker are treated as borrowers; they can later flip to BROKER via /select-role, but the experience is inconsistent and can create stray borrower data.
**Technical cause:** Default OAuth role is BORROWER and role guards don't consult needsRoleSelection.
**Frontend impact:** Wrong dashboard for would-be brokers.
**Backend impact:** withAuth/APIs never consult needsRoleSelection.
**Database impact:** Possible orphan BorrowerRequest rows before a role switch.
**Exact recommended fix:** In BorrowerShell/BrokerShell (or a shared guard) redirect to /select-role when session.user.needsRoleSelection is true.
**Suggested test cases:**
- Google user with needsRoleSelection navigating to /borrower/dashboard is redirected to /select-role

---

### 9. Credential-login account-enumeration oracle via GOOGLE_ACCOUNT branch

**Severity:** Low  
**Feature area:** Authentication / login  
**User type affected:** All  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** auth-core

**Files:** lib/auth.ts
**Line references:** lib/auth.ts:105-120
**Current behavior:** authorize() runs the constant-time dummy compare, then for an existing OAuth-only account returns the distinct error 'GOOGLE_ACCOUNT' (lib/auth.ts:114-116) regardless of the submitted password, and 'EMAIL_NOT_VERIFIED' for unverified accounts. The non-existent-account path returns 'Invalid email or password'.
**Expected behavior:** Login responses should not let an unauthenticated attacker distinguish registered vs unregistered (and OAuth-vs-password) emails.
**User impact:** An attacker can enumerate which emails are registered Google accounts by observing GOOGLE_ACCOUNT vs the generic error; submitting any password works because the GOOGLE_ACCOUNT branch fires before password validation. This partly undermines the timing-oracle defense the dummy hash provides.
**Technical cause:** UX-driven distinct error codes leak account state pre-authentication.
**Frontend impact:** login.tsx surfaces a helpful 'use Google sign-in' message (auth.useGoogleSignIn); the same signal that leaks existence.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Accept the UX tradeoff explicitly, or gate the GOOGLE_ACCOUNT hint behind a generic message and only reveal provider hints after an out-of-band signal; at minimum keep the per-email rate limit tight.
**Suggested test cases:**
- Probing an OAuth-only email with a random password returns a response indistinguishable from an unregistered email (if hardened)

---

### 10. Wrong-role users are bounced to /login instead of their own dashboard

**Severity:** Low  
**Feature area:** Role-based page protection  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** auth-core

**Files:** components/borrower/BorrowerShell.tsx, components/broker/BrokerShell.tsx
**Line references:** components/borrower/BorrowerShell.tsx:82-84, components/broker/BrokerShell.tsx:110-112
**Current behavior:** When an authenticated user with the wrong role hits a borrower/broker page, the Shell redirects to /login even though the user is logged in. (select-role.tsx:33-41, by contrast, redirects wrong-role to the correct dashboard.)
**Expected behavior:** An authenticated user on the wrong section should be sent to their own dashboard, not the login page.
**User impact:** A logged-in borrower who follows a broker link lands on /login, which is confusing (they are already authenticated).
**Technical cause:** Guard treats any non-matching role identically to anonymous.
**Frontend impact:** Confusing redirect; potential perceived loop.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Redirect wrong-role authenticated users to getDashboardPath(session.user.role) instead of /login.
**Suggested test cases:**
- Borrower visiting /broker/dashboard is redirected to /borrower/dashboard

---

### 11. Signup silently proceeds when the verification email fails to send

**Severity:** Low  
**Feature area:** Signup / email verification  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** auth-core

**Files:** pages/api/auth/signup.ts, pages/signup.tsx
**Line references:** pages/api/auth/signup.ts:101-112, pages/signup.tsx:86-102
**Current behavior:** The API returns { requiresVerification:true, emailSent:false } when Resend throws, but signup.tsx ignores emailSent and always redirects to /verify-email regardless.
**Expected behavior:** When emailSent is false the user should be told the email could not be sent and offered a resend.
**User impact:** If the verification email never arrives, the user is dropped on /verify-email with no code and no signal that the send failed; they may be stuck unless they discover the resend flow.
**Technical cause:** Frontend does not read the emailSent flag.
**Frontend impact:** No error/warning state for send failure.
**Backend impact:** User row is created (correct) but verification cannot complete without resend.
**Database impact:** Unverified user rows accumulate.
**Exact recommended fix:** On emailSent===false show a warning and surface the resend action immediately.
**Suggested test cases:**
- Resend failure on signup shows a 'could not send email, try resend' message

---

### 12. Post-login redirect falls back to homepage when session role is unavailable

**Severity:** Low  
**Feature area:** Login redirect  
**User type affected:** All  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** auth-core

**Files:** pages/login.tsx
**Line references:** pages/login.tsx:78-88
**Current behavior:** After a successful credential sign-in the page fetches /api/auth/session, reads session.user.role, and computes ROLE_REDIRECTS[role]. If the fetch fails or role is undefined, redirectUrl falls back to '/'. There is no error handling around the session fetch.
**Expected behavior:** A successful login should reliably land the user on their role dashboard.
**User impact:** On a transient session-fetch hiccup (or if the session callback briefly returns null) the user is dropped on the marketing homepage instead of their dashboard.
**Technical cause:** No guard for missing role / failed fetch; only a try/catch around the whole handler.
**Frontend impact:** Occasional wrong landing page after login.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** If role is missing, retry the session fetch or fall back to a role-derived dashboard rather than '/'.
**Suggested test cases:**
- Login with session fetch returning no role still routes to a dashboard, not /

---

### 13. Login rate-limit counts successful logins and can lock shared-NAT users

**Severity:** Low  
**Feature area:** Authentication / rate limiting  
**User type affected:** All  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Medium  
**Found by:** auth-core

**Files:** pages/api/auth/[...nextauth].ts, lib/rate-limit.ts
**Line references:** pages/api/auth/[...nextauth].ts:24-51, lib/rate-limit.ts:67-82
**Current behavior:** The per-email cap (5/15min) and per-IP cap (30/15min) increment on EVERY POST to callback/credentials, including successful logins, and key per-IP off x-real-ip / last XFF entry.
**Expected behavior:** Brute-force counters ideally key off failures; legitimate repeated logins and large shared NATs should not be locked out by a low cap.
**User impact:** A user who fat-fingers a password a few times then logs in/out repeatedly can hit 5/15min; many users behind one corporate/school NAT share the 30/IP budget.
**Technical cause:** Counter increments pre-auth on all attempts; no success exemption.
**Frontend impact:** Surfaces auth.tooManyAttempts (RATE_LIMITED) to legitimate users.
**Backend impact:** None beyond the 429.
**Database impact:** None.
**Exact recommended fix:** Consider only counting failed attempts toward the per-email cap, and/or raising the shared-IP cap, while keeping the per-email cap strict.
**Suggested test cases:**
- 5 successful logins for one email in 15min should not block the 6th legitimate login (if exempting successes)

---

### 14. reset-password page flashes 'Invalid Link' for valid links before router.query hydrates

**Severity:** Low  
**Feature area:** Password reset  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** auth-recovery — also reported by: ux-states

**Files:** pages/reset-password.tsx
**Line references:** pages/reset-password.tsx:12, pages/reset-password.tsx:92-101
**Current behavior:** The page is statically generated (getStaticProps) and branches on !token (line 92). On first client render router.query is empty, so every visitor — including those with a valid token in the URL — briefly sees the 'Invalid Link / This password reset link is invalid or has expired' card before hydration populates the query.
**Expected behavior:** Render nothing (or a loading state) until router.isReady, then branch on token.
**User impact:** Users clicking a legitimate emailed link see an alarming 'invalid or expired' message flash, eroding trust in a security-sensitive flow; on slow devices the flash is long enough to make users abandon and re-request links.
**Technical cause:** Missing router.isReady guard around the !token branch on a statically-exported page.
**Frontend impact:** Add `if (!router.isReady) return <Layout>...spinner...</Layout>;` or gate the invalid-link branch on router.isReady && !token.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Guard with router.isReady before evaluating !token.
**Suggested test cases:**
- Render page with token in URL → no transient Invalid Link state
- Navigate to /reset-password with no token → Invalid Link card after isReady

---

### 15. forgot-password has no per-account cooldown — reset-email bombing and reset-link DoS for a targeted victim

**Severity:** Low  
**Feature area:** Password reset  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** auth-recovery

**Files:** pages/api/auth/forgot-password.ts
**Line references:** pages/api/auth/forgot-password.ts:25-32, pages/api/auth/forgot-password.ts:48-56
**Current behavior:** Only a per-IP limit exists (3/min). Each request for an existing email overwrites resetToken/resetTokenExpiry (lines 53-56) and fires a real email. There is no per-email cooldown analogous to resend-code's 60s verificationCodeSentAt check.
**Expected behavior:** Per-email cooldown (e.g., 60s) plus daily cap, so a distributed attacker cannot flood a victim's inbox or continuously rotate the stored token.
**User impact:** A targeted victim can be spammed with reset emails (3/min/IP, multiplied across IPs), burning Resend quota and sender reputation; because each request invalidates the previous token, an attacker repeatedly requesting resets can race the victim and keep killing the link they just received, blocking legitimate password recovery.
**Technical cause:** Rate limiting keyed only on client IP; token storage is single-slot overwrite without send-throttling per account.
**Frontend impact:** None.
**Backend impact:** Add a per-email checkRateLimit key (e.g., forgot-email-<email>, 1/60s and ~5/day) before generating/overwriting the token; respond with the same generic 200 to preserve enumeration safety.
**Database impact:** Optionally a resetTokenSentAt column mirroring verificationCodeSentAt.
**Exact recommended fix:** Mirror resend-code's cooldown using a durable KV key per normalized email, while keeping the response body identical (generic 200) so no enumeration signal is added.
**Suggested test cases:**
- Two forgot-password requests for same email within 60s from different IPs → second does not send/rotate
- Cooldown response identical in shape and timing to normal 200

---

### 16. resend-code cooldown 429 leaks existence of unverified accounts (enumeration oracle)

**Severity:** Low  
**Feature area:** Email verification / resend code  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** auth-recovery — also reported by: notifications

**Files:** pages/api/auth/resend-code.ts
**Line references:** pages/api/auth/resend-code.ts:45-47, pages/api/auth/resend-code.ts:50-58
**Current behavior:** Unknown or already-verified emails always get 200 {success:true} (lines 45-47), but an existing unverified email inside the 60s cooldown gets 429 {message:'Too many requests', retryAfter} (lines 50-58). Two rapid requests therefore distinguish 'unverified account exists' (second response 429 with retryAfter) from 'no such unverified account' (both 200). The IP limit of 3/min permits the probe pair. A 502 on send failure (line 77) is a second existence signal.
**Expected behavior:** Identical response shape/status regardless of account existence — e.g., return 200 {success:true} on cooldown too (silently skipping the send), letting the client-side 60s countdown handle UX.
**User impact:** Attackers can enumerate which emails have unverified Mortly accounts; limited blast radius (only unverified accounts) but contradicts the deliberate enumeration defenses in forgot-password and verify-email.
**Technical cause:** Cooldown branch returns a distinguishable 429 with retryAfter only reachable for existing unverified users.
**Frontend impact:** verify-email.tsx relies on the 429 retryAfter to sync the countdown; if removed, return retryAfter inside a 200 body or accept client-side countdown drift.
**Backend impact:** Return 200 with optional retryAfter field for the cooldown case, or pad/uniform all branches.
**Database impact:** None.
**Exact recommended fix:** Make the cooldown branch return the same 200 {success:true, retryAfter} shape as other branches (frontend can still read retryAfter), and convert the 502 to a logged generic 200 or uniform error.
**Suggested test cases:**
- Two rapid resend requests for nonexistent email → identical responses
- Two rapid requests for existing unverified email → responses identical in status/shape to nonexistent case

---

### 17. Verification codes stored plaintext in DB (reset tokens are hashed, codes are not)

**Severity:** Low  
**Feature area:** Email verification  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** auth-recovery

**Files:** prisma/schema.prisma, pages/api/auth/signup.ts, pages/api/auth/resend-code.ts, pages/api/auth/verify-email.ts
**Line references:** prisma/schema.prisma:22, pages/api/auth/signup.ts:74-90, pages/api/auth/resend-code.ts:63-71, pages/api/auth/verify-email.ts:102
**Current behavior:** User.verificationCode holds the raw 6-digit code; signup and resend write it unhashed and verify-email compares against the stored plaintext. By contrast, resetToken is stored as a SHA-256 hash (forgot-password.ts:50).
**Expected behavior:** Store a hash (SHA-256 is fine for a short-lived 6-digit code with attempt caps) and compare hashes, consistent with the reset-token treatment.
**User impact:** Anyone with DB read access (compromised backup, log leak, insider) can verify arbitrary unverified accounts. Impact is limited — verification only flips emailVerified and codes live 10 minutes — but it is an inconsistency with the rest of the file's threat model.
**Technical cause:** Codes written raw in signup.ts:86 and resend-code.ts:66.
**Frontend impact:** None.
**Backend impact:** Hash at write in signup/resend, hash the candidate in verify-email before timingSafeEqual.
**Database impact:** No schema change; existing in-flight codes invalidated once on deploy (users can resend).
**Exact recommended fix:** sha256(code) at rest; keep timingSafeEqual on the hex digests.
**Suggested test cases:**
- Valid code verifies after hashing change
- DB row contains no raw 6-digit value

---

### 18. reset-password API lacks input type/length validation present in signup

**Severity:** Low  
**Feature area:** Password reset  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** auth-recovery

**Files:** pages/api/auth/reset-password.ts, pages/api/auth/signup.ts
**Line references:** pages/api/auth/reset-password.ts:25-35, pages/api/auth/reset-password.ts:44, pages/api/auth/signup.ts:47-49
**Current behavior:** token and password are used without typeof checks. A numeric password (e.g., 12345678 sent as JSON number) passes the truthiness check, skips the length check (undefined < 8 is false at line 31), and reaches bcrypt hash() (line 44) where a non-string throws → 500. There is also no max length cap, unlike signup's 8-200 rule (signup.ts:47-49), and a non-string token throws inside createHash().update() (line 35) → 500.
**Expected behavior:** 400 with a clear message for non-string or out-of-range inputs; same 8-200 length policy as signup.
**User impact:** Malformed clients get opaque 500s instead of 400s; password policy is inconsistent between signup and reset (a 500-char password is accepted on reset but rejected at signup).
**Technical cause:** Missing typeof === 'string' guards and max-length check before hashing.
**Frontend impact:** None (web form already enforces string + min 8).
**Backend impact:** Add `typeof token !== 'string' || typeof password !== 'string'` → 400, and `password.length > 200` → 400.
**Database impact:** None.
**Exact recommended fix:** Mirror signup.ts:47-49 validation in reset-password.ts before the hash.
**Suggested test cases:**
- POST with numeric password → 400 not 500
- POST with object token → 400 not 500
- 201-char password → 400, matching signup policy

---

### 19. verify-email page mislabels rate-limit (429) and attempt-exhaustion responses

**Severity:** Low  
**Feature area:** Email verification  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** auth-recovery

**Files:** pages/verify-email.tsx, pages/api/auth/verify-email.ts
**Line references:** pages/verify-email.tsx:77-85, pages/api/auth/verify-email.ts:52-54, pages/api/auth/verify-email.ts:97-99
**Current behavior:** The submit handler only branches on data.expired: a 429 'Too many attempts. Please wait and try again.' (verify-email.ts:53) is displayed as 'Invalid code. Try again.' (auth.invalidCode), telling the user to keep retrying — the opposite of the server's instruction. The attempt-exhaustion 400 (verify-email.ts:97-99, expired:true) is shown as 'Code expired. Request a new one.' which is functionally adequate but inaccurate.
**Expected behavior:** Distinct localized message for 429 ('too many attempts, wait a moment') and ideally for the burned-code case.
**User impact:** A throttled user is told their code is wrong and keeps re-entering it, deepening the throttle and possibly burning a valid code via the attempt counter.
**Technical cause:** Frontend collapses all non-expired errors into auth.invalidCode; no res.status === 429 branch.
**Frontend impact:** Add a 429 branch using a new localized key (e.g., auth.tooManyVerifyAttempts) in both locale files.
**Backend impact:** Optionally add a machine-readable code field (e.g., {code:'RATE_LIMITED'}) instead of relying on status/expired flags.
**Database impact:** None.
**Exact recommended fix:** Branch on res.status 429 before the expired check; add ko/en keys.
**Suggested test cases:**
- Mock 429 → user sees wait message, not invalid-code
- Mock burned-code 400 → user prompted to request new code

---

### 20. Reset links break if NEXTAUTH_URL is unset (localhost fallback); env value unverifiable from code

**Severity:** Low  
**Feature area:** Password reset emails  
**User type affected:** Both  
**Status:** Needs manual verification  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** auth-recovery

**Files:** pages/api/auth/forgot-password.ts, lib/email.ts
**Line references:** pages/api/auth/forgot-password.ts:58, lib/email.ts:14
**Current behavior:** forgot-password.ts builds the reset URL from process.env.NEXTAUTH_URL with fallback 'http://localhost:3000', while lib/email.ts uses fallback 'https://mortly.ca' for its BASE_URL — inconsistent fallbacks for the same concept. NEXT_PUBLIC_SITE_URL is not used anywhere in the codebase. If NEXTAUTH_URL is missing or wrong in the Vercel production environment, every reset email contains a localhost link.
**Expected behavior:** Production NEXTAUTH_URL set to https://mortly.ca (NextAuth itself also requires it); a production-safe fallback (or hard failure) instead of localhost in forgot-password.ts.
**User impact:** If misconfigured, password reset is completely unusable: emails arrive but the button points at http://localhost:3000.
**Technical cause:** Divergent env fallbacks; correctness depends on Vercel dashboard config that cannot be read from the repo (per audit rules, .env not inspected).
**Frontend impact:** None.
**Backend impact:** Use a single shared BASE_URL (lib/email.ts already exports the pattern) or throw in production when NEXTAUTH_URL is absent (lib/origin.ts:72-74 already does this for redirects).
**Database impact:** None.
**Exact recommended fix:** Verify NEXTAUTH_URL in Vercel production env equals https://mortly.ca; replace the localhost fallback in forgot-password.ts:58 with the lib/email.ts BASE_URL constant.
**Suggested test cases:**
- Send reset email in production-like env → link host is https://mortly.ca
- Unit test: resetUrl construction with NEXTAUTH_URL set/unset

---

### 21. generateVerificationCode never produces 999999 (randomInt upper bound exclusive)

**Severity:** Low  
**Feature area:** Email verification  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** auth-recovery

**Files:** lib/email.ts
**Line references:** lib/email.ts:17-19
**Current behavior:** crypto.randomInt(100000, 999999) generates 100000-999998 inclusive; 999999 is unreachable, giving 899,999 instead of 900,000 possible codes.
**Expected behavior:** randomInt(100000, 1000000) for the full 6-digit non-leading-zero space (or randomInt(0,1000000) with zero-padding for the full 10^6 space).
**User impact:** None in practice — negligible keyspace reduction; purely a correctness nit.
**Technical cause:** Off-by-one on crypto.randomInt's exclusive max parameter.
**Frontend impact:** None.
**Backend impact:** One-character change.
**Database impact:** None.
**Exact recommended fix:** Change the exclusive bound to 1000000.
**Suggested test cases:**
- Statistical/unit test that bound 999999 is generatable after fix

---

### 22. Commercial request detail renders '$undefined' for legacy scalar financial values

**Severity:** Low  
**Feature area:** Request detail display  
**User type affected:** BORROWER  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** borrower-flow

**Files:** /Users/hyunseokcho/Documents/GitHub/mortly/pages/borrower/request/[id].tsx
**Line references:** pages/borrower/request/[id].tsx:476-477 (`${'$'}${value}` || "--" — template literal is always truthy so the '--' fallback is dead; undefined interpolates as '$undefined')
**Current behavior:** When details.corporateAnnualIncome is not an object (legacy/partial data) and is undefined, the row shows '$undefined'; the intended '--' fallback can never trigger.
**Expected behavior:** Show '--' when the value is missing.
**User impact:** Broken-looking financial rows on older commercial requests.
**Technical cause:** `\`$${x}\` || "--"` — the OR applies to an always-truthy template string.
**Frontend impact:** Guard: value ? `$${value}` : '--' (as already done for ownerNetIncome on line 480).
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Apply the ternary pattern; while there, format amounts with Intl.NumberFormat(locale, {style:'currency', currency:'CAD'}) — currently all amounts are raw '$'+string with no CAD formatting or thousands separators (lines 439, 467-468, 476-480).
**Suggested test cases:**
- Commercial request with undefined corporateAnnualIncome renders '--'

---

### 23. Account deletion leaves reports about the deleted user and related dangling report targets

**Severity:** Low  
**Feature area:** Account deletion / PIPEDA  
**User type affected:** BORROWER  
**Status:** Needs manual verification  
**Launch blocker:** No  
**Implementation complexity:** Medium  
**Found by:** borrower-flow

**Files:** /Users/hyunseokcho/Documents/GitHub/mortly/pages/api/users/me.ts, /Users/hyunseokcho/Documents/GitHub/mortly/prisma/schema.prisma
**Line references:** pages/api/users/me.ts:145-149 (only targetType BROKER reports deleted), 162 (reports BY user deleted), prisma/schema.prisma:254-273 (Report has no FK to target)
**Current behavior:** Hard delete fully removes the User row, requests, conversations, messages, device tokens, blocks (cascade) — genuinely deletes PII and cannot throw on FK constraints (all required relations are manually cleared first; verified against schema). However, Report rows with targetType USER/REQUEST/CONVERSATION pointing at the deleted user's entities remain with dangling targetIds, and report `reason` free-text from other users may contain the deleted user's personal info. AdminAction audit rows also persist (likely acceptable/required).
**Expected behavior:** Decide retention policy: either delete/anonymize reports targeting the deleted user or document retention as legitimate-purpose under PIPEDA.
**User impact:** Possible residual PII in third-party report text after deletion; admin report screens may show unresolvable targets.
**Technical cause:** Cascade list only covers BROKER-targeted reports.
**Frontend impact:** None.
**Backend impact:** Extend transaction to handle targetType USER (targetId appears to be publicId for users — verify, since ReportButton passes broker.user.publicId at brokers/[requestId].tsx:216 while users/me deletes by broker.id at line 147; the targetId convention itself looks inconsistent and worth auditing).
**Database impact:** Possible cleanup migration for dangling report targets.
**Exact recommended fix:** Audit Report.targetId conventions per targetType, then add USER-targeted report cleanup (or anonymization) to the deletion transaction.
**Suggested test cases:**
- Delete user who was reported (targetType USER) -> report handled per policy
- Verify ReportButton targetId matches what admin/deletion code expects

---

### 24. PUT close endpoint has no current-status guard

**Severity:** Low  
**Feature area:** Request lifecycle API  
**User type affected:** BORROWER  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** borrower-flow

**Files:** /Users/hyunseokcho/Documents/GitHub/mortly/pages/api/requests/[id].ts
**Line references:** pages/api/requests/[id].ts:100-110 (accepts CLOSED from any current status)
**Current behavior:** A borrower can PUT status=CLOSED on a REJECTED, EXPIRED, or already-CLOSED request, overwriting terminal states (e.g., hiding a rejection).
**Expected behavior:** Only allow CLOSED from OPEN/IN_PROGRESS (or document the laxity).
**User impact:** Minor: status history integrity; admin metrics could be skewed.
**Technical cause:** Missing status precondition.
**Frontend impact:** None.
**Backend impact:** Add `if (!['OPEN','IN_PROGRESS'].includes(request.status)) return 400`.
**Database impact:** None.
**Exact recommended fix:** Add the guard alongside the ownership check.
**Suggested test cases:**
- PUT CLOSED on REJECTED -> 400

---

### 25. Dashboard badge mislabels total responses as 'new' responses

**Severity:** Low  
**Feature area:** Dashboard  
**User type affected:** BORROWER  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** borrower-flow

**Files:** /Users/hyunseokcho/Documents/GitHub/mortly/pages/borrower/dashboard.tsx
**Line references:** pages/borrower/dashboard.tsx:439 (responses = total conversation count), pages/borrower/dashboard.tsx:522-528 ('{{count}} 새 응답' badge uses that total)
**Current behavior:** Badge text means 'N new responses' (Korean fallback '새 응답') but the count is total conversations on the request, not unread/new ones.
**Expected behavior:** Either label as total responses or count conversations with unreadCount > 0 from context.
**User impact:** Borrower repeatedly sees 'new responses' for long-read threads.
**Technical cause:** Copy/data mismatch.
**Frontend impact:** Re-label or derive unread from conversations list.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Use unread-derived count or change the key's copy.
**Suggested test cases:**
- All conversations read -> no 'new responses' badge

---

### 26. Profile sidebar shows stale name after rename; stats grid reserves a third column for a removed metric

**Severity:** Low  
**Feature area:** Profile  
**User type affected:** BORROWER  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** borrower-flow

**Files:** /Users/hyunseokcho/Documents/GitHub/mortly/pages/borrower/profile.tsx, /Users/hyunseokcho/Documents/GitHub/mortly/components/borrower/BorrowerDataContext.tsx
**Line references:** pages/borrower/profile.tsx:67-91 (handleUpdateName never calls context refresh), components/borrower/BorrowerShell.tsx:120-123 (sidebar reads context profile.name), pages/borrower/profile.tsx:157 (grid-cols-3 with only 2 cards), 19-23 (interface declares _count.reviews which the API at pages/api/borrowers/profile.ts:17-23 never returns)
**Current behavior:** After saving a new name, the sidebar keeps the old name until the next 30s poll/page reload; the stats grid renders 2 cards in a 3-column grid leaving a hole.
**Expected behavior:** Call useBorrowerData().refresh() after successful save; grid-cols-2; drop the phantom reviews field.
**User impact:** Polish-level confusion.
**Technical cause:** Page bypasses shared context on mutation; leftover reviews metric.
**Frontend impact:** Small edits in profile.tsx.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** refresh() on success; fix grid class; remove reviews from interface.
**Suggested test cases:**
- Rename -> sidebar updates immediately

---

### 27. Explicit plural-suffixed key brokerCard.yearsExperience_other bypasses singular form

**Severity:** Low  
**Feature area:** i18n  
**User type affected:** BORROWER  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** borrower-flow

**Files:** /Users/hyunseokcho/Documents/GitHub/mortly/pages/borrower/brokers/[requestId].tsx, /Users/hyunseokcho/Documents/GitHub/mortly/public/locales/en/common.json
**Line references:** pages/borrower/brokers/[requestId].tsx:205 (t('brokerCard.yearsExperience_other', { count }))
**Current behavior:** Both yearsExperience_one and yearsExperience_other exist in locales, but the code hardcodes the _other key, so count=1 in English renders the plural form (e.g., '1 years').
**Expected behavior:** t('brokerCard.yearsExperience', { count }) and let i18next pick the plural form.
**User impact:** Minor grammar error in English.
**Technical cause:** Suffix baked into the key string.
**Frontend impact:** One-line change.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Use the base key.
**Suggested test cases:**
- count=1 in en renders singular

---

### 28. Admin verification queue renders the literal string 'null' for brokers without a license (optional since migration 20260511)

**Severity:** Low  
**Feature area:** Admin broker verification  
**User type affected:** Admin  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** broker-flow

**Files:** pages/admin/inbox.tsx, pages/admin/brokers/[id].tsx, pages/api/admin/queue.ts
**Line references:** pages/admin/inbox.tsx:614, pages/admin/inbox.tsx:486, pages/admin/brokers/[id].tsx:39, pages/admin/brokers/[id].tsx:285, pages/api/admin/queue.ts:164
**Current behavior:** summarizeBroker builds `${b.province} · ${b.licenseNumber}${...}` via template literal; queue.ts:164 passes licenseNumber ?? null through, so a license-less broker's row subtitle reads e.g. 'Ontario · null'. The detail pairs at inbox.tsx:486 and brokers/[id].tsx:285 render a blank value with no '—' or 'no license provided' marker, and the TS type at brokers/[id].tsx:39 still declares licenseNumber: string (non-nullable).
**Expected behavior:** Missing license shows an explicit localized placeholder (e.g. '라이선스 미제공') so admins can make an informed verify/reject decision.
**User impact:** Admins verifying brokers see 'null' or silent blanks for the single most important verification datum, increasing risk of mistaken approvals after license became optional.
**Technical cause:** Admin UI was not updated when the 20260511221104_make_broker_license_optional migration made the column nullable.
**Frontend impact:** Null-guard the subtitle and pairs (licenseNumber ?? '—'/t key); fix the stale non-nullable type.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Render `b.licenseNumber ?? t('admin.noLicense', '미제공')` in inbox.tsx:614/486 and brokers/[id].tsx:285; change the interface to string | null.
**Suggested test cases:**
- Broker with null license in queue: subtitle shows placeholder, not 'null'
- Broker detail page shows explicit no-license marker
- Broker with license unchanged

> Adversarial verification: **confirmed** (calibrated severity Low). Directionally right, but the headline mechanism is wrong and severity is overstated. The premise is real: licenseNumber is nullable (prisma/schema.prisma:129, migration 20260511221104_make_broker_license_optional), broker creation does not require it (pages/api/brokers/profile.ts:45-51 — non-partial POST only forces brokerageName/province/phone; licenseNumber may be omitted or explicitly nulled), 

---

### 29. Request detail briefly shows the wrong 'no credits' card and wrong tier copy before broker profile loads

**Severity:** Low  
**Feature area:** Broker request detail  
**User type affected:** Broker  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** broker-flow

**Files:** pages/broker/requests/[id].tsx, components/broker/BrokerDataContext.tsx
**Line references:** pages/broker/requests/[id].tsx:172-174, pages/broker/requests/[id].tsx:339-341
**Current behavior:** brokerTier defaults to 'BASIC' and brokerCredits to 0 while BrokerDataContext's profile fetch is in flight (page loading state only tracks the request fetch). A PREMIUM or credit-holding broker hard-loading the detail URL can momentarily see the 'no credits — upgrade plan' warning card before the profile resolves and the real CTA swaps in.
**Expected behavior:** CTA region waits for profileChecked (skeleton) before choosing a card.
**User impact:** Flash of misleading paywall content; brief layout shift.
**Technical cause:** Defaults `profile?.subscriptionTier ?? 'BASIC'` / `?? 0` are used as real values rather than gating on profileChecked.
**Frontend impact:** Gate the CTA block on useBrokerData().profileChecked/loaded.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Render a small skeleton for the CTA card until profile !== null (or profileChecked).
**Suggested test cases:**
- Slow /api/brokers/profile: no upgrade card flash for PREMIUM broker
- Profile 404 path still redirects to onboarding

---

### 30. Invalid mortgageCategory query param causes Prisma enum error → 500 instead of 400

**Severity:** Low  
**Feature area:** Requests API  
**User type affected:** Broker  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** broker-flow

**Files:** pages/api/requests/index.ts, prisma/schema.prisma
**Line references:** pages/api/requests/index.ts:35-37, prisma/schema.prisma:97,288-291
**Current behavior:** `where.mortgageCategory = mortgageCategory` assigns any string straight into the Prisma where clause; BorrowerRequest.mortgageCategory is enum MortgageCategory (RESIDENTIAL|COMMERCIAL), so GET /api/requests?mortgageCategory=junk throws PrismaClientValidationError, caught by the handler's catch → 500 'Internal server error' (and an error log) for what is client input error.
**Expected behavior:** 400 with a validation message for non-enum values.
**User impact:** None via the UI (select only emits valid values); noisy 500s and misleading monitoring signals from crafted requests.
**Technical cause:** Query param not validated against the enum before use.
**Frontend impact:** None.
**Backend impact:** Validate with assertOptionalEnum(['RESIDENTIAL','COMMERCIAL']) before assignment.
**Database impact:** None.
**Exact recommended fix:** Add enum validation for mortgageCategory (and optionally province against the known list) in the GET branch.
**Suggested test cases:**
- ?mortgageCategory=junk → 400
- ?mortgageCategory=COMMERCIAL → filtered 200

---

### 31. Sidebar tier chip renders '<TIER> · PRO' for every subscription tier

**Severity:** Low  
**Feature area:** Broker shell  
**User type affected:** Broker  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** broker-flow — also reported by: gap:Mobile responsiveness of borrower/broker (non-admin) authed surfaces, especially chat, ux-states

**Files:** components/broker/BrokerShell.tsx
**Line references:** components/broker/BrokerShell.tsx:291-293
**Current behavior:** `{subscriptionTier ? `${subscriptionTier} · PRO` : t('broker.tagline', 'BROKER')}` — a FREE broker's sidebar header shows 'FREE · PRO', BASIC shows 'BASIC · PRO', etc. The ' · PRO' suffix is hardcoded and wrong for 3 of 4 tiers.
**Expected behavior:** Show just the tier (or a localized label).
**User impact:** Confusing/false plan label in persistent chrome; FREE users may believe they have PRO.
**Technical cause:** Hardcoded template suffix.
**Frontend impact:** Render `${subscriptionTier}` alone or a t() label.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Drop the ' · PRO' suffix.
**Suggested test cases:**
- FREE broker sidebar shows 'FREE'
- PREMIUM shows 'PREMIUM'

---

### 32. Dashboard stat labeled 'New requests · this week' actually shows all-time unseen count

**Severity:** Low  
**Feature area:** Broker dashboard  
**User type affected:** Broker  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** broker-flow

**Files:** pages/broker/dashboard.tsx, pages/api/requests/index.ts
**Line references:** pages/broker/dashboard.tsx:259-267, pages/api/requests/index.ts:44-53
**Current behavior:** counters.newRequests is the server's newCount = OPEN requests with no BrokerRequestSeen row for this broker, with no time bound; the StatCard label says 'New requests · this week' (key broker.newRequestsWeek missing from both locales, so English shows everywhere).
**Expected behavior:** Label matches the metric ('Unseen requests') or the query is time-bounded to 7 days.
**User impact:** Misleading number — a month-old unseen request counts as 'this week'.
**Technical cause:** Copy/metric mismatch between widget label and newCount semantics.
**Frontend impact:** Rename label (and add the i18n keys).
**Backend impact:** Optional createdAt >= now-7d bound on newCountWhere.
**Database impact:** None.
**Exact recommended fix:** Change label to 'New (unseen) requests' in both locales.
**Suggested test cases:**
- 10-day-old unseen request: label and count consistent

---

### 33. Phone validation accepts incomplete North American numbers (e.g. '+1416555')

**Severity:** Low  
**Feature area:** Broker onboarding/profile  
**User type affected:** Broker  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** broker-flow

**Files:** pages/broker/onboarding.tsx, pages/broker/profile.tsx, lib/validate.ts
**Line references:** pages/broker/onboarding.tsx:61-66,91, pages/broker/profile.tsx:64-69,143, lib/validate.ts:155-162
**Current behavior:** Client formats up to 10 digits but enforces no minimum; submit sends `+1${digits}`. Server E164_RE /^\+[1-9]\d{6,14}$/ accepts 7–15 total digits, so a 6-digit entry ('(416) 555') becomes '+1416555' and passes both client and server validation, persisting an undialable phone.
**Expected behavior:** NA numbers require exactly 10 national digits (+1 + 10).
**User impact:** Brokers can be verified/contacted with unusable phone numbers; admin verification calls fail.
**Technical cause:** Generic E.164 regex without +1 length rule; no client minLength.
**Frontend impact:** Block submit until 10 digits.
**Backend impact:** For +1 numbers require /^\+1\d{10}$/.
**Database impact:** Existing short numbers may need backfill audit.
**Exact recommended fix:** Add a +1-specific length check in assertPhone callers or a dedicated assertNAPhone.
**Suggested test cases:**
- '(416) 555' → client blocks / server 400
- '(416) 555-1234' → accepted as +14165551234

---

### 34. lib/constants.ts is a dead mirror — 20 of 25 exported constants are imported nowhere and their values are duplicated inline at call sites

**Severity:** Low  
**Feature area:** Data layer / maintainability  
**User type affected:** All  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** data-layer

**Files:** lib/constants.ts, pages/api/auth/signup.ts, pages/api/messages/index.ts, pages/api/admin/credits.ts, pages/api/requests/index.ts, pages/api/users/me.ts
**Line references:** lib/constants.ts:10-53, pages/api/auth/signup.ts:21-22, pages/api/messages/index.ts:22-23, pages/api/admin/credits.ts:19, pages/api/requests/index.ts:149-150, pages/api/users/me.ts:9
**Current behavior:** Only CONVERSATION_INACTIVE_HOURS, CONVERSATION_UNSTARTED_DAYS, CRON_BATCH_SIZE, SETTINGS_CACHE_TTL_MS, SESSION_DB_CACHE_TTL_MS are imported. MAX_MESSAGE_LENGTH/SIGNUP_PER_IP_PER_MIN/MAX_ADMIN_CREDIT_DELTA/MAX_REQUEST_NOTES_LENGTH/etc. are unused; handlers hardcode 5000, 5, 10_000, 4000/4096, 30*24*60*60 inline. The header comment ('changing one place flips behavior everywhere') is false.
**Expected behavior:** Handlers import the constants, or the dead exports are removed.
**User impact:** None today; high drift risk — editing constants.ts changes nothing, and inline values can silently diverge from the documented policy.
**Technical cause:** Constants were extracted but call sites never refactored.
**Frontend impact:** None.
**Backend impact:** Misleading single-source-of-truth claims.
**Database impact:** None.
**Exact recommended fix:** Wire call sites to the constants (signup, verify-email, messages, credits, requests, me.ts) or delete the unused exports; add eslint no-unused-exports or knip to CI.
**Suggested test cases:**
- Changing MAX_MESSAGE_LENGTH actually changes /api/messages behavior

---

### 35. assertBoundedJson counts UTF-16 code units, not bytes — Korean request details pass at up to ~3x the stated byte cap

**Severity:** Low  
**Feature area:** Validation / Korean text handling  
**User type affected:** Borrower  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** data-layer

**Files:** lib/validate.ts, pages/api/requests/index.ts
**Line references:** lib/validate.ts:134-137, pages/api/requests/index.ts:150
**Current behavior:** `JSON.stringify(value).length > maxBytes` measures characters; Korean syllables are 1 UTF-16 unit but 3 UTF-8 bytes, so a 'details ≤ 4096 bytes' payload can actually be ~12KB. Messages are consistent (char-based 5000 check vs PG VarChar(5000) char semantics — fine, astral chars even over-count safely).
**Expected behavior:** Use Buffer.byteLength(serialized, 'utf8') or rename the parameter/messages to chars.
**User impact:** None functional (JSONB has no 4KB limit); error message 'exceeds N bytes' is inaccurate and the cap is ~3x looser for Korean than English users.
**Technical cause:** String.length used where byte length was intended.
**Frontend impact:** None.
**Backend impact:** Slightly larger stored payloads than designed.
**Database impact:** details JSONB up to ~12KB.
**Exact recommended fix:** Buffer.byteLength + import MAX_REQUEST_DETAILS_BYTES from constants.
**Suggested test cases:**
- 4096 Korean-char details object rejected when byte-measured
- Equivalent English payload behavior unchanged

---

### 36. Cron endpoints' platform protections depend on unverifiable Vercel config (CRON_SECRET set, x-vercel-cron header stripping)

**Severity:** Low  
**Feature area:** Cron auth  
**User type affected:** All  
**Status:** Needs manual verification  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** data-layer

**Files:** lib/cron.ts, vercel.json
**Line references:** lib/cron.ts:19-38, vercel.json:2-15
**Current behavior:** verifyCronRequest requires Bearer CRON_SECRET (timing-safe) AND (x-vercel-cron: 1 OR ALLOW_NONVERCEL_CRON=1). Code is correct and tested (401 paths covered). Whether CRON_SECRET is actually set in the Vercel project, ALLOW_NONVERCEL_CRON is unset in prod, and the platform strips inbound x-vercel-* headers from external requests cannot be confirmed from the repo.
**Expected behavior:** CRON_SECRET present in prod env; ALLOW_NONVERCEL_CRON unset.
**User impact:** If CRON_SECRET is missing, verifyCronRequest returns false for everyone — crons silently never run (requests never expire, PII never purged).
**Technical cause:** Env-dependent behavior.
**Frontend impact:** None.
**Backend impact:** Silent cron no-op on misconfig (Vercel cron gets 401, visible only in logs).
**Database impact:** Stale statuses / unpurged PII if crons fail.
**Exact recommended fix:** Verify env vars in Vercel dashboard; add a monitor/alert on cron 401/500 responses.
**Suggested test cases:**
- Production cron logs show 200s daily for all three jobs

---

### 37. Privacy policy does not document the implemented 180-day PII anonymization schedule

**Severity:** Low  
**Feature area:** PII retention / legal  
**User type affected:** All  
**Status:** Needs manual verification  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** data-layer

**Files:** pages/api/cron/purge-expired.ts, public/locales/en/common.json, public/locales/ko/common.json
**Line references:** pages/api/cron/purge-expired.ts:10-26, lib/settings.ts:13-15
**Current behavior:** purge-expired anonymizes financial details/notes and redacts chat bodies 180 days (request_retention_days) after a request goes terminal. The privacy policy strings in both locales only say records 'may be retained' for security/legal reasons — no retention period is stated, and retained fields (province, city, desiredTimeline, rejectionReason, productTypes) are not enumerated.
**Expected behavior:** Policy text states the concrete retention window and what is anonymized vs retained (PIPEDA Principle 8 openness).
**User impact:** Compliance/communication gap rather than a functional bug.
**Technical cause:** Policy copy predates the purge cron.
**Frontend impact:** privacy page copy incomplete.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Update privacy.* locale strings (ko + en) to state the 180-day anonymization and the retained non-financial fields; have counsel review.
**Suggested test cases:**
- Policy text matches request_retention_days default and admin-configured value

---

### 38. BorrowerShell auth redirect drops the intended destination (no callbackUrl)

**Severity:** Low  
**Feature area:** Borrower auth gating  
**User type affected:** Borrower  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** gap:Borrower onboarding / first-run experience (checklist says onboarding for BOTH roles; only broker side was reviewed)

**Files:** /Users/hyunseokcho/Documents/GitHub/mortly/components/borrower/BorrowerShell.tsx, /Users/hyunseokcho/Documents/GitHub/mortly/pages/login.tsx
**Line references:** components/borrower/BorrowerShell.tsx:80-85, pages/login.tsx:86-88
**Current behavior:** BorrowerShell redirects unauthenticated viewers to /login with no callbackUrl. login.tsx honors router.query.callbackUrl (line 86-87) but it is never provided, so a session-expired borrower deep-linked to e.g. /borrower/messages?id=... always lands on /borrower/dashboard after re-login.
**Expected behavior:** Redirect to /login?callbackUrl=<asPath> so re-login returns the user to where they were (push-notification/email deep links especially).
**User impact:** Minor friction: users following email/push links after session expiry must re-navigate manually.
**Technical cause:** router.replace('/login') without query param.
**Frontend impact:** One-line change in BorrowerShell (and verify the same for BrokerShell).
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** router.replace(`/login?callbackUrl=${encodeURIComponent(router.asPath)}`) with an open-redirect guard (relative paths only) in login.tsx.
**Suggested test cases:**
- Expired session on /borrower/messages?id=x → after login, returned to that URL
- callbackUrl=https://evil.com is rejected

---

### 39. PostHog identified with raw email as distinct ID plus name/email properties at signup and login

**Severity:** Low  
**Feature area:** Borrower signup analytics / PII  
**User type affected:** All  
**Status:** Needs manual verification  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** gap:Borrower onboarding / first-run experience (checklist says onboarding for BOTH roles; only broker side was reviewed)

**Files:** /Users/hyunseokcho/Documents/GitHub/mortly/pages/signup.tsx, /Users/hyunseokcho/Documents/GitHub/mortly/pages/login.tsx
**Line references:** pages/signup.tsx:94-95, pages/login.tsx:83-84
**Current behavior:** posthog.identify(email, { name, email, role }) at signup and posthog.identify(email, { email, role }) at login send the user's email as the analytics distinct_id and as person properties.
**Expected behavior:** Identify with the opaque publicId/cuid and avoid name/email person properties unless retention/deletion workflows cover PostHog (prior audit flagged PII retention).
**User impact:** User PII proliferates into a third-party analytics store; account deletion (DELETE /api/users/me) does not purge PostHog persons.
**Technical cause:** Email chosen as the identify key; no server-side ID available pre-session at signup, but publicId is available post-login.
**Frontend impact:** Switch identify key to publicId after session fetch; drop email/name properties or gate behind consent.
**Backend impact:** None (or add PostHog deletion call to account-deletion flow).
**Database impact:** None.
**Exact recommended fix:** Use session.user.publicId as distinct_id; remove email/name from person properties; verify PostHog project data-retention settings in the dashboard (cannot be confirmed from code).
**Suggested test cases:**
- Signup/login emit identify with publicId not email
- Account deletion triggers (or documents) PostHog person deletion

---

### 40. Broker.profilePhoto is a write-only dead field: API accepts it, no UI sets it, nothing renders it

**Severity:** Low  
**Feature area:** Broker profile / file handling  
**User type affected:** Broker  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** gap:File upload / document handling (beyond broker profile photo)

**Files:** pages/api/brokers/profile.ts, pages/broker/profile.tsx, pages/broker/onboarding.tsx, components/broker/BrokerDataContext.tsx, pages/borrower/brokers/[requestId].tsx, pages/api/requests/[id].ts, prisma/schema.prisma, lib/validate.ts, types/index.ts
**Line references:** pages/api/brokers/profile.ts:65-68, prisma/schema.prisma:136, pages/broker/profile.tsx:46-56, pages/broker/onboarding.tsx:35-45, components/broker/BrokerDataContext.tsx:39, pages/borrower/brokers/[requestId].tsx:13-31, pages/borrower/brokers/[requestId].tsx:174-176, pages/api/requests/[id].ts:32-48, lib/validate.ts:100-117, types/index.ts:76-86
**Current behavior:** POST/PUT /api/brokers/profile validates and persists profilePhoto (https-only URL, max 2048 chars). Neither the onboarding form nor the profile edit form has any photo field, there is no upload mechanism anywhere in the repo, and no page renders the value — the borrower comparison page shows an initials circle (lines 174-176) and the server select for /api/requests/[id] deliberately omits profilePhoto, so a value set via raw API call is visible to nobody. The only <img> in the app is the logo (components/BrandMark.tsx:48-49).
**Expected behavior:** Either (a) the field, its validation branch, and the BrokerDataContext type member are removed until a real photo feature ships, or (b) a complete feature exists: upload (or at minimum a UI field), storage, and rendering with a host allowlist.
**User impact:** Brokers cannot present a photo at all, weakening trust signals on the borrower comparison page; the dead API surface invites confusion and future accidental exposure if a renderer is added without a host allowlist (CSP img-src currently allows any https: origin — next.config.mjs:86).
**Technical cause:** Feature was started server-side (schema column + validation at pages/api/brokers/profile.ts:65-68) but the client write path and all render paths were never built; assertOptionalHttpsUrl's only consumer is this dead branch.
**Frontend impact:** None today. If later rendered naively, arbitrary third-party HTTPS images (hotlink/tracking pixel) would load since CSP img-src is 'self data: blob: https:'.
**Backend impact:** One dead validation branch and a stored column nobody reads; GET /api/brokers/profile returns the full Broker row including profilePhoto to the broker themselves only.
**Database impact:** Unused nullable column Broker.profilePhoto (prisma/schema.prisma:136); seed.ts never populates it.
**Exact recommended fix:** Short term: delete the profilePhoto branch from validateBrokerFields, the type member in BrokerDataContext.tsx:39, and (via migration) the column — or leave the column and stop accepting writes. Long term, if photos are wanted: add real upload (e.g. Supabase Storage signed upload) plus rendering restricted to the storage host, and tighten CSP img-src.
**Suggested test cases:**
- PUT /api/brokers/profile with profilePhoto rejected/ignored after removal
- PUT with profilePhoto='javascript:alert(1)' returns 400 (current validator behavior, untested)
- Borrower comparison page payload never contains profilePhoto

---

### 41. All four broker.introMessage* locale keys (including the 'required documents' hint) are dead — referenced nowhere in the codebase

**Severity:** Low  
**Feature area:** Broker contact flow / i18n  
**User type affected:** Broker  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** gap:File upload / document handling (beyond broker profile photo)

**Files:** public/locales/en/common.json, public/locales/ko/common.json, pages/broker/requests/[id].tsx
**Line references:** public/locales/en/common.json:492-495, public/locales/ko/common.json:492-495, pages/broker/requests/[id].tsx:94-132
**Current behavior:** broker.introMessageLabel/introMessageHint/introMessageTip/introMessagePlaceholder exist in both locale files (en+ko lines 492-495); repo-wide grep (excluding node_modules/.next/coverage/public) finds zero usages. The current broker contact flow (handleStartConversation, pages/broker/requests/[id].tsx:94-132) creates the conversation and jumps straight into chat with no intro-message composer, so the hint telling brokers to cover 'Required documents and estimated loan amounts/rates by lender' (en:493) / '렌더에 따른 필요서류 및 대출가능금액, 이율 안내' (ko:493) is never shown in the web app.
**Expected behavior:** Orphaned keys removed, or — if they are resurrected for an intro composer or consumed by the Expo mobile app (separate repo; root app.json here is an empty {"expo":{}}) — the wording should not steer brokers into requesting documents through a channel with no attachment support.
**User impact:** None in the web app today. If the mobile app consumes these strings, it actively encourages document logistics in text-only chat / off-platform.
**Technical cause:** Leftover copy from a removed intro-message composer; the conversation-creation flow no longer takes a first-message payload.
**Frontend impact:** Dead locale weight; risk of stale guidance resurfacing.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Delete the four keys from both locale files after confirming the Expo app does not fetch this web app's public/locales/*/common.json; if kept, reword the documents bullet to direct exchanges appropriately.
**Suggested test cases:**
- Locale lint: every key in common.json is referenced by at least one t() call (orphan detection)

---

### 42. Broker chat list pane has conflicting Tailwind width classes (w-80 vs w-full) and an invalid stacked variant lg:md:w-96

**Severity:** Low  
**Feature area:** Broker chat mobile layout  
**User type affected:** Broker  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** gap:Mobile responsiveness of borrower/broker (non-admin) authed surfaces, especially chat

**Files:** /Users/hyunseokcho/Documents/GitHub/mortly/pages/broker/messages.tsx
**Line references:** pages/broker/messages.tsx:354-358
**Current behavior:** The left pane className concatenates base `w-80 lg:w-96` with, in list mode, `w-full md:w-80 lg:md:w-96`. `w-80` and `w-full` are both unprefixed and conflict — the rendered width depends purely on Tailwind's CSS emission order (w-full is emitted after the spacing scale today, so the mobile list happens to be full-width). `lg:md:w-96` is a double-stacked responsive variant that compiles to nested min-width media queries, i.e. a redundant duplicate of the already-present lg:w-96.
**Expected behavior:** One unambiguous responsive declaration, matching the borrower page's `w-full md:w-80 lg:w-96` (pages/borrower/messages.tsx:454).
**User impact:** None today (w-full wins), but any Tailwind upgrade/reorder or class-merge tooling could silently shrink the mobile conversation list to 320px on a 360px screen.
**Technical cause:** Conditional class string appends a second width set instead of replacing the base one.
**Frontend impact:** Replace the three width fragments with `w-full md:w-80 lg:w-96` on the base class and drop the conditional width block.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Normalize to the borrower page's class set; optionally add eslint-plugin-tailwindcss no-contradicting-classname to catch this class of bug.
**Suggested test cases:**
- Snapshot/DOM test: in list view below md the pane has w-full and not w-80
- Visual check at 360px: list spans full width with no dead gutter

---

### 43. Borrower chat header can crush the broker name to zero width at 360px

**Severity:** Low  
**Feature area:** Borrower chat mobile header  
**User type affected:** Borrower  
**Status:** Needs manual verification  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** gap:Mobile responsiveness of borrower/broker (non-admin) authed surfaces, especially chat

**Files:** /Users/hyunseokcho/Documents/GitHub/mortly/pages/borrower/messages.tsx
**Line references:** pages/borrower/messages.tsx:604-700, pages/borrower/messages.tsx:662-669, pages/borrower/messages.tsx:676-699
**Current behavior:** On an open mobile thread the header row stacks five fixed-width items: back button (md:hidden), 40px avatar, the flex-1 min-w-0 name/brokerage block, the 'close conversation' text button (btn-secondary !py-2 !px-3 !text-xs, shrink-0), and the lg:hidden context toggle — all with gap-3 inside px-5 padding. Every non-name element is shrink-0, so at 360px the name/brokerage column absorbs all the squeeze and can truncate to a few characters or nothing; nothing overflows, but identity info disappears.
**Expected behavior:** Broker name remains legible at 360-414px; secondary actions collapse to icons or overflow menu.
**User impact:** On small phones the borrower may not be able to see who they are talking to while the thread is open.
**Technical cause:** Too many shrink-0 siblings competing with a single flexible column in one row.
**Frontend impact:** Make the close action icon-only below sm, or move it into the context drawer; alternatively allow the header to wrap to two lines.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Below sm render the close-conversation control as an icon button (it already has a confirm dialog) and keep text from md up.
**Suggested test cases:**
- 360px viewport with a long Korean brokerage name: name shows at least ~8 characters
- Close and context buttons both remain tappable (>=40px hit area) at 360px

---

### 44. Navbar mobile menu renders Dashboard and Messages twice

**Severity:** Low  
**Feature area:** Navbar mobile menu  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** gap:Mobile responsiveness of borrower/broker (non-admin) authed surfaces, especially chat

**Files:** /Users/hyunseokcho/Documents/GitHub/mortly/components/Navbar.tsx
**Line references:** components/Navbar.tsx:130-136, components/Navbar.tsx:371-385, components/Navbar.tsx:417-451, components/Navbar.tsx:363-367
**Current behavior:** navLinks for an authed user contains dashboardHref and messagesHref (130-136) and is rendered at the top of the mobile menu (371-385); below the divider, the authed block renders dashboardHref (417-430) and messagesHref (433-451) again with icons. Brokers therefore see Dashboard and Messages twice plus Pricing, Notifications, Settings, Sign out — and the container clips at max-h-[500px] overflow-hidden (363-367), which the broker menu height approaches.
**Expected behavior:** Each destination listed once; menu never clips its last item.
**User impact:** Confusing duplicate entries and a possible cut-off Sign out button on small screens / large font settings.
**Technical cause:** navLinks loop and the explicit authed link block were both kept when the menu was restructured.
**Frontend impact:** Drop the navLinks loop from the mobile menu for authed users (keep the icon versions), or vice versa; replace max-h-[500px] with a measured/scrollable container.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Render navLinks only when !session in the mobile menu, and change the menu to max-h with overflow-y-auto.
**Suggested test cases:**
- Authed broker at 375px: exactly one Dashboard and one Messages entry in the mobile menu
- Sign out is fully visible/tappable with browser font-size 120%

---

### 45. Borrower chat opened via ?id= query param skips the unread-clearing path used by manual selection

**Severity:** Low  
**Feature area:** Borrower chat unread state  
**User type affected:** Borrower  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** gap:Mobile responsiveness of borrower/broker (non-admin) authed surfaces, especially chat

**Files:** /Users/hyunseokcho/Documents/GitHub/mortly/pages/borrower/messages.tsx
**Line references:** pages/borrower/messages.tsx:179-186, pages/borrower/messages.tsx:273-300
**Current behavior:** The query-param effect (179-186, used by the broker-comparison page's 'view messages' button at pages/borrower/brokers/[requestId].tsx:236-243) calls setActiveId + fetchActiveConversation + setMobileShowChat(true) directly, bypassing selectConversation (273-300) which zeroes the list unreadCount and dispatches the 'refresh-unread' event after the fetch. The server still marks the thread read (api/conversations/[id] updates borrowerLastReadAt), but the already-fetched client list and navbar badge keep showing stale unread counts until the next poll/refetch.
**Expected behavior:** Both selection paths share the same logic so badges clear immediately when a thread opens.
**User impact:** After tapping 'view messages' from the broker comparison page (a primary mobile path), the conversation opens but its unread badge and the global badge linger.
**Technical cause:** Duplicated selection logic; the query-param branch predates the optimistic-unread handling.
**Frontend impact:** Call selectConversation(qid) in the query effect (as the broker page already does at pages/broker/messages.tsx:166-172).
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Replace the bespoke branch with selectConversation(qid).
**Suggested test cases:**
- Navigate to /borrower/messages?id=<conv> with unread>0: list badge clears and 'refresh-unread' fires after load

---

### 46. Hardcoded English accessibility labels (aria-label) in both locales

**Severity:** Low  
**Feature area:** Accessibility / i18n  
**User type affected:** All  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** i18n

**Files:** pages/broker/dashboard.tsx, pages/broker/requests/index.tsx, components/Tooltip.tsx, components/ui/Banner.tsx, components/Toast.tsx, components/broker/BrokerShell.tsx, components/borrower/BorrowerShell.tsx
**Line references:** pages/broker/dashboard.tsx:344, pages/broker/requests/index.tsx:465, components/Tooltip.tsx:50, components/ui/Banner.tsx:79, components/Toast.tsx:98, components/broker/BrokerShell.tsx:184, components/broker/BrokerShell.tsx:296, components/borrower/BorrowerShell.tsx:156, components/borrower/BorrowerShell.tsx:249
**Current behavior:** aria-label="New", "More information", "Dismiss", "Broker navigation", "Borrower navigation" are English literals — Korean screen-reader users hear English.
**Expected behavior:** aria-labels via t().
**User impact:** Korean assistive-technology users get English announcements; minor but systematic.
**Technical cause:** Attributes skipped during i18n pass.
**Frontend impact:** 9 attribute sites.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Wrap each in t() with new keys in both catalogs.
**Suggested test cases:**
- axe/i18n lint rule flagging non-t() aria-label literals

---

### 47. First-visit English speakers always get Korean: localeDetection disabled with defaultLocale ko

**Severity:** Low  
**Feature area:** Locale detection / first visit  
**User type affected:** All  
**Status:** Needs manual verification  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** i18n

**Files:** next-i18next.config.js
**Line references:** next-i18next.config.js:3-7
**Current behavior:** defaultLocale "ko" + localeDetection:false means an English-only visitor (and Googlebot crawling /) receives Korean with no Accept-Language or cookie consideration; they must find the KO/EN toggle in the Navbar (which is present at Navbar.tsx:188-205).
**Expected behavior:** Likely intentional for a Korean-Canadian audience — but should be a confirmed product decision; hreflang in SEO.tsx does correctly expose /en alternates to search engines.
**User impact:** EN-first prospects (e.g., brokers who aren't Korean speakers) bounce off a Korean landing page.
**Technical cause:** Deliberate config; cannot confirm product intent from code.
**Frontend impact:** Config-level.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Confirm intent; if EN acquisition matters, enable cookie-honoring detection or a first-visit language prompt.
**Suggested test cases:**
- Visit / with Accept-Language: en-CA and no cookie; document expected locale

---

### 48. Merged realtime/poll messages are appended unsorted — out-of-order rendering and duplicate React date-group keys possible

**Severity:** Low  
**Feature area:** Chat rendering  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** messaging

**Files:** pages/borrower/messages.tsx, pages/broker/messages.tsx
**Line references:** pages/borrower/messages.tsx:206-210, pages/borrower/messages.tsx:248-252, pages/borrower/messages.tsx:384-393, pages/borrower/messages.tsx:714, pages/broker/messages.tsx:196-200, pages/broker/messages.tsx:238-242, pages/broker/messages.tsx:328-337, pages/broker/messages.tsx:608
**Current behavior:** Both the sync handler and the poll merge with [...prev, ...incoming] (id-deduped but never re-sorted by createdAt). Race: both parties send near-simultaneously — the sender's optimistic append lands first, then the counterpart's earlier-timestamped message is appended after it, rendering out of order until reload. Date grouping iterates array order and keys groups by date string (key={group.date}); interleaved dates after a merge across midnight produce two groups with the same key → React duplicate-key warning and potential mis-reconciliation.
**Expected behavior:** Messages always render in createdAt (then id) order; group keys unique.
**User impact:** Occasionally jumbled message order in active back-and-forth conversations; cosmetic but trust-damaging in a financial negotiation.
**Technical cause:** Merge is purely additive; no sort step; group key derived from non-unique date string.
**Frontend impact:** Sort after merge: next.sort((a,b)=> a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)); key groups by `${date}-${index}` or first message id.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Add a stable sort in all three merge sites per page (sync, poll, optimistic append) or centralize merging in one helper.
**Suggested test cases:**
- Simulated cross-send race renders chronologically
- Merge spanning a date boundary produces unique group keys (no console warning)

---

### 49. Borrower unread-badge rollback is dead code: fetchActiveConversation swallows errors so .catch never fires

**Severity:** Low  
**Feature area:** Conversation list / unread  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** messaging

**Files:** pages/borrower/messages.tsx, pages/broker/messages.tsx
**Line references:** pages/borrower/messages.tsx:163-176, pages/borrower/messages.tsx:276-300, pages/broker/messages.tsx:151-163, pages/broker/messages.tsx:270-279
**Current behavior:** selectConversation snapshots prevUnread and registers a .catch() to restore the badge on fetch failure — the code comment explicitly says this fixes 'cleared optimistically without rollback'. But fetchActiveConversation wraps its body in try/catch and never rethrows, so the returned promise always resolves: the .catch is unreachable, the badge stays cleared on failure, and the .then() dispatches refresh-unread even when the load failed. Broker side has the same swallow-and-then pattern with no rollback attempt at all.
**Expected behavior:** Failed thread load restores the unread badge and does not signal refresh-unread.
**User impact:** After a transient failure the unread indicator disappears even though the messages were never displayed — exactly the bug the comment claims was fixed.
**Technical cause:** Internal try/catch in fetchActiveConversation converts rejection into a resolved promise.
**Frontend impact:** Have fetchActiveConversation rethrow (or return a success boolean) and branch in selectConversation.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Return res.ok/throw from fetchActiveConversation; in selectConversation, only clear/keep-cleared the badge and dispatch refresh-unread on success.
**Suggested test cases:**
- Mock failed GET /api/conversations/[id] on select → badge restored, refresh-unread not dispatched
- Successful select → badge cleared, event dispatched

---

### 50. Unread counting inconsistent between list and nav badge (gte vs gt, ACTIVE-only filter, blocked users included)

**Severity:** Low  
**Feature area:** Unread counts  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** messaging

**Files:** pages/api/conversations/index.ts, pages/api/messages/unread.ts
**Line references:** pages/api/conversations/index.ts:101, pages/api/messages/unread.ts:25, pages/api/messages/unread.ts:45
**Current behavior:** Per-conversation unread (list) uses createdAt: { gte: lastReadAt } while the nav total uses gt — a message stamped exactly at lastReadAt (possible: send-transaction sets lastReadAt and message createdAt in the same instant) is counted by one and not the other. The nav total also counts only ACTIVE conversations and ignores blocks, while the list computes unread for every returned conversation (then the UI suppresses CLOSED) and filters blocked counterparties after counting. Badges can therefore disagree.
**Expected behavior:** One shared unread predicate (same comparator, same status/block filters) used by both endpoints.
**User impact:** Nav badge showing 3 while the list shows 2 (or vice versa); minor but erodes trust in the indicator.
**Technical cause:** Two near-duplicate hand-rolled OR-condition builders drifted (gte vs gt; differing filters).
**Frontend impact:** None.
**Backend impact:** Extract a shared buildUnreadConditions(conversations, userId) helper; pick gt consistently; apply block filtering before counting in the list endpoint.
**Database impact:** None.
**Exact recommended fix:** Unify the predicate in a lib helper used by both pages/api/conversations/index.ts and pages/api/messages/unread.ts.
**Suggested test cases:**
- Message created at exactly lastReadAt counted identically by both endpoints
- Blocked counterpart's messages excluded from both badge counts

---

### 51. Borrower-initiated conversation creation is not race-safe — concurrent duplicates return 500

**Severity:** Low  
**Feature area:** Conversation creation  
**User type affected:** Borrower  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** messaging

**Files:** pages/api/conversations/index.ts
**Line references:** pages/api/conversations/index.ts:194-209, pages/api/conversations/index.ts:294-338, pages/api/conversations/index.ts:361-367
**Current behavior:** The borrower branch does findUnique-then-create without a transaction or P2002 handling; two concurrent POSTs for the same (requestId, brokerId) both pass the existence check, the second create hits the unique constraint and the generic catch returns 500. The broker branch is Serializable-safe for credits, but a serialization conflict (Prisma P2034) also surfaces as a 500 with no retry, instead of the idempotent 200 the sequential path provides.
**Expected behavior:** Duplicate-create races resolve idempotently: catch P2002/P2034 and return the existing conversation (200).
**User impact:** Double-click or mobile retry on 'contact broker' can show an error even though the conversation was created; user confusion, support noise.
**Technical cause:** No unique-violation/serialization-conflict handling around create.
**Frontend impact:** None required.
**Backend impact:** Wrap creates in a catch for PrismaClientKnownRequestError P2002 (refetch and return existing) and retry-once on P2034.
**Database impact:** None — unique constraint already guarantees integrity.
**Exact recommended fix:** Add P2002/P2034 handling in both branches of POST /api/conversations.
**Suggested test cases:**
- Two parallel borrower POSTs for same request+broker → both 2xx, one conversation row (extend tests/concurrency/credits.test.ts pattern)
- Broker branch serialization conflict → second request returns existing conversation, credit deducted exactly once

---

### 52. GET /api/conversations/[id] marks the thread read on every poll tick — unseen messages marked read and a write every 5s per open thread

**Severity:** Low  
**Feature area:** Unread / read receipts  
**User type affected:** Both  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** messaging

**Files:** pages/api/conversations/[id].ts, pages/borrower/messages.tsx, pages/broker/messages.tsx
**Line references:** pages/api/conversations/[id].ts:90-99, pages/borrower/messages.tsx:239-270, pages/broker/messages.tsx:229-260
**Current behavior:** Every non-paginated GET updates borrower/brokerLastReadAt. The 5s poll and every realtime nudge hit this GET, so (a) each open thread issues a conversation.update write every 5 seconds while the tab is visible, and (b) messages are marked read merely because the tab is visible — the user may be scrolled up or away from the window (visibilitystate stays 'visible' for an unfocused but exposed window).
**Expected behavior:** Read receipts updated on explicit view interactions (selection, focus, scroll-to-bottom), or at least only when new messages were actually delivered; polling should not write.
**User impact:** Counterpart-facing effects are minimal today (lastReadAt isn't surfaced as a read receipt), but unread badges zero out for messages the user never actually saw; DB write amplification grows linearly with concurrently open threads.
**Technical cause:** Read-marking is a side effect of the fetch path shared by initial load, polling, and realtime refetch.
**Frontend impact:** Optionally pass a markRead=false flag from poll/sync refetches.
**Backend impact:** Support ?markRead=0 (skip the update), or only update when unread messages exist.
**Database impact:** Reduces steady-state UPDATE load on conversations.
**Exact recommended fix:** Add a markRead query flag; only the initial selection (and a focus/visibility re-entry) marks read.
**Suggested test cases:**
- Poll refetch does not modify lastReadAt
- Initial selection still clears unread
- Background-but-visible tab accumulates unread until interaction

---

### 53. No isComposing guard on chat send — Korean IME Enter behavior relies entirely on native form-submit semantics

**Severity:** Low  
**Feature area:** Chat input / i18n  
**User type affected:** Both  
**Status:** Needs manual verification  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** messaging

**Files:** pages/borrower/messages.tsx, pages/broker/messages.tsx
**Line references:** pages/borrower/messages.tsx:776-792, pages/broker/messages.tsx:677-733
**Current behavior:** Both pages use a single-line <input type="text"> inside <form onSubmit={handleSend}> with no onKeyDown handler, no e.isComposing/keyCode 229 check, and no compositionend handling. Because there is no custom Enter handler, the classic mid-composition double-send bug is likely avoided (browsers consume Enter during composition before form submission), but this is browser-dependent (Safari historically quirky) and untested. Additionally the single-line input makes multiline messages impossible to compose on web even though rendering supports them (whitespace-pre-wrap).
**Expected behavior:** Pressing Enter mid-composition (e.g. finishing '한국어') never sends a partial message and never double-sends; ideally a textarea with Shift+Enter newline and an explicit isComposing guard.
**User impact:** If any supported browser submits on composition-Enter, Korean-typing users (the primary audience) send truncated messages. Multi-paragraph messages are impossible on web.
**Technical cause:** No composition-aware key handling; reliance on default browser behavior.
**Frontend impact:** Swap to textarea with onKeyDown guard: if (e.key==='Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); handleSend(); }.
**Backend impact:** None (5000-char cap already allows newlines).
**Database impact:** None.
**Exact recommended fix:** Manually test Enter-at-end-of-composition in Safari/Chrome/Firefox with the Korean IME; add the isComposing-guarded handler regardless as defense in depth and to enable multiline input.
**Suggested test cases:**
- Type 한국어 and press Enter to commit composition in Safari → no message sent until second Enter
- Shift+Enter inserts newline (after textarea migration)
- Rapid Enter spam doesn't double-send (sending flag already guards)

---

### 54. Public anon-key broadcast spoofing can force participants into refetch loops (no channel authorization, no broadcast rate limit)

**Severity:** Low  
**Feature area:** Realtime chat transport  
**User type affected:** Both  
**Status:** Needs manual verification  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** messaging

**Files:** lib/realtime.ts, pages/borrower/messages.tsx, pages/broker/messages.tsx
**Line references:** lib/realtime.ts:48-71, pages/borrower/messages.tsx:199-222, pages/broker/messages.tsx:189-212
**Current behavior:** The server broadcasts with only the anon key (lib/realtime.ts:53-57), which means any client holding that public key can also POST broadcasts to chat-<id> topics. Each received 'sync' triggers an authenticated GET /api/conversations/[id] with no client-side debounce; GETs are not rate-limited by withAuth (only mutating methods are).
**Expected behavior:** Either private channels with Realtime Authorization restricting subscribe/broadcast to participants/service role, or client-side debounce + GET rate limiting to bound the amplification.
**User impact:** An attacker with a conversation id could make both participants' browsers hammer the API (each spoofed broadcast = one authenticated DB-heavy GET each), degrading the victims' session and adding server load. No data exposure (payload ignored, refetch is participant-gated).
**Technical cause:** Broadcast topics are public; broadcasts authenticated only by the public anon key; no debounce on the sync handler.
**Frontend impact:** Debounce the sync refetch (e.g. trailing 1s).
**Backend impact:** Consider Supabase Realtime Authorization (private channels) using the service role for server broadcasts; or per-user GET rate limit.
**Database impact:** None.
**Exact recommended fix:** Verify in Supabase whether Realtime broadcast requires authorization for these topics; add a 1s debounce around the sync-handler refetch in both pages.
**Suggested test cases:**
- Spoofed broadcast flood → client issues at most ~1 refetch/sec
- Anon client broadcast to chat-<id> rejected once private channels enabled

---

### 55. Auto-close 'borrower engaged' check samples 10 unordered messages — can misclassify if admin raises broker message limit

**Severity:** Low  
**Feature area:** Auto-close cron  
**User type affected:** Borrower  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** messaging

**Files:** pages/api/cron/auto-close-conversations.ts
**Line references:** pages/api/cron/auto-close-conversations.ts:38-46, pages/api/cron/auto-close-conversations.ts:96-104, pages/api/cron/auto-close-conversations.ts:53-62
**Current behavior:** Pass 2 loads up to 10 non-system messages per conversation with no orderBy and closes the conversation if none were sent by the borrower. With the default broker_initial_message_limit of 3 this is safe, but if an admin raises the setting above ~9, a 7-day-old conversation where the borrower replied after 10+ broker messages could be wrongly auto-closed (borrower's reply not in the unordered 10-row sample). Separately, the eligible.length===0 early break (lines 57-62) can permanently strand eligible conversations behind a full page of ineligible ones since pagination has no cursor.
**Expected behavior:** Engagement check uses an exact predicate (e.g. borrowerMsgCount > 0 from the denormalized counter, or a where: { senderId: borrowerId } count) and pagination advances past ineligible pages.
**User impact:** Edge-case: an engaged conversation closed out from under both parties; stranded stale conversations never close.
**Technical cause:** Sampled relation read instead of using Conversation.borrowerMsgCount which already exists for exactly this purpose; cursor-less pagination.
**Frontend impact:** None.
**Backend impact:** Replace the messages sample with borrowerMsgCount === 0 in the where clause (also removes the include entirely) and add id-cursor pagination.
**Database impact:** None — counter column already maintained transactionally.
**Exact recommended fix:** Pass 2 where: { createdAt: { lt: cutoff }, borrowerMsgCount: 0 } — exact, index-friendly, and removes the filterFn/early-break hazard.
**Suggested test cases:**
- Conversation with 12 broker messages then 1 borrower reply, 8 days old → NOT closed
- Page of all-ineligible rows doesn't halt processing of later eligible rows

---

### 56. No dev/test fallback when RESEND_API_KEY is unset — verification codes unobtainable locally

**Severity:** Low  
**Feature area:** Transactional email / DX  
**User type affected:** All  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** notifications

**Files:** /Users/hyunseokcho/Documents/GitHub/mortly/lib/email.ts
**Line references:** lib/email.ts:6-14, lib/email.ts:57-62
**Current behavior:** getResend() constructs Resend with process.env.RESEND_API_KEY unconditionally; with no key, send throws at call time. RESEND_FROM falls back to noreply@mortly.ca and NEXTAUTH_URL to https://mortly.ca (or http://localhost:3000 in forgot-password.ts:58). There is no dev-mode branch that logs the verification code/reset URL to console, so local signups return emailSent:false and the account can never be verified without DB access.
**Expected behavior:** In non-production without an API key, log the code/URL to console (or use a no-op transport) so the auth flow is testable end to end.
**User impact:** Developer/staging friction only; no production impact assuming the env var is set in Vercel (env contents not inspectable here).
**Technical cause:** No NODE_ENV guard around the Resend client.
**Frontend impact:** None.
**Backend impact:** Small guard in lib/email.ts.
**Database impact:** None.
**Exact recommended fix:** If !process.env.RESEND_API_KEY && NODE_ENV !== 'production', console.log the payload and return instead of calling Resend.
**Suggested test cases:**
- Local signup without key -> code visible in server log, emailSent true (dev mode)
- Production without key -> loud startup/runtime error

---

### 57. Admin credits negative-balance guard is read-then-write outside the transaction (race to negative; stale audit)

**Severity:** Low  
**Feature area:** Admin credit adjustment  
**User type affected:** Admin  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** payments

**Files:** pages/api/admin/credits.ts
**Line references:** pages/api/admin/credits.ts:23-38, pages/api/admin/credits.ts:40-49
**Current behavior:** The broker balance is read (23-26), the negative guard checked against that snapshot (32-36), and previousBalance captured (38) BEFORE the transaction that performs an unconditional increment (40-49). A concurrent broker spend or webhook reset between read and write can drive responseCredits negative, and the audit row's previousBalance/newBalance can be wrong.
**Expected behavior:** Atomic conditional decrement (updateMany where responseCredits >= |amount|) like the conversation spend path, with the audit reading the post-update value.
**User impact:** Rare data-integrity drift; negative balances would also confuse the PREMIUM -1 sentinel display logic.
**Technical cause:** Check-then-act across separate queries.
**Frontend impact:** None.
**Backend impact:** Use updateMany with a balance predicate for negative amounts inside the transaction; derive audit values from the returned row.
**Database impact:** Optional CHECK constraint responseCredits >= -1.
**Exact recommended fix:** For amount < 0, use tx.broker.updateMany({ where: { id, responseCredits: { gte: -amount } }, data: { increment } }) and 400 when count === 0; log balances from the updated row.
**Suggested test cases:**
- Concurrent admin -5 and broker spends → balance never < 0
- Audit details match actual pre/post balances under concurrency

---

### 58. handleSubscriptionUpdated status map ignores trialing/incomplete/incomplete_expired/paused

**Severity:** Low  
**Feature area:** Webhook state mapping  
**User type affected:** Broker  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** payments

**Files:** pages/api/webhooks/stripe.ts
**Line references:** pages/api/webhooks/stripe.ts:351-357
**Current behavior:** statusMap covers active/past_due/canceled/unpaid; any other Stripe status (trialing, incomplete, incomplete_expired, paused) falls back to the existing local status, so e.g. a paused or incomplete_expired subscription stays ACTIVE locally. No trials are currently configured (checkout has no trial_period_days), so these states are unlikely but possible via dashboard actions.
**Expected behavior:** Explicit mapping or at least logging for unmapped statuses.
**User impact:** Dashboard-initiated pauses would not reflect in entitlements.
**Technical cause:** Partial status map with silent fallback.
**Frontend impact:** None.
**Backend impact:** Extend statusMap; map paused/incomplete_expired to EXPIRED or PAST_DUE.
**Database impact:** None.
**Exact recommended fix:** Map remaining Stripe statuses and log a warning when falling back.
**Suggested test cases:**
- subscription.updated with status 'paused' → local status not left ACTIVE

---

### 59. lib/stripe.ts pins a .clover API version directly under a comment warning against .clover tags

**Severity:** Low  
**Feature area:** Stripe SDK configuration  
**User type affected:** All  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** payments

**Files:** lib/stripe.ts
**Line references:** lib/stripe.ts:8-13
**Current behavior:** Comment says 'Avoid *.clover preview tags — they get sunset … and break webhook handlers without warning', then the very next line pins apiVersion: '2026-02-25.clover'. The webhook code depends on v2026+ object shapes (webhook.ts:20-35 reads item-level periods and invoice.parent.subscription_details), so the version itself appears intentional; the comment is self-contradictory and will mislead the next maintainer.
**Expected behavior:** Comment accurately describing the pinned release train and the v2026 shape dependencies.
**User impact:** None directly; maintenance hazard (someone 'fixing' the version per the comment would break getSubPeriod/getInvoiceSubscriptionId).
**Technical cause:** Stale or mistaken comment.
**Frontend impact:** None.
**Backend impact:** Comment fix; confirm the version string is a GA release in the Stripe dashboard.
**Database impact:** None.
**Exact recommended fix:** Rewrite the comment to state why 2026-02-25.clover is required (item-level period fields, invoice.parent) and verify it matches the dashboard's default/webhook API version.
**Suggested test cases:**
- Manual: confirm Stripe dashboard webhook endpoint API version matches the SDK pin

---

### 60. ProcessedStripeEvent ledger grows unbounded — no purge despite createdAt index

**Severity:** Low  
**Feature area:** Webhook idempotency ledger  
**User type affected:** All  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** payments — also reported by: data-layer

**Files:** prisma/schema.prisma, pages/api/cron/purge-expired.ts, vercel.json
**Line references:** prisma/schema.prisma:227-234
**Current behavior:** ProcessedStripeEvent has an @@index([createdAt]) clearly intended for time-based cleanup, but grep shows the model is referenced only by the webhook handler; none of the three crons (expire-requests, auto-close-conversations, purge-expired) delete from it.
**Expected behavior:** Periodic deletion of rows older than Stripe's retry horizon (e.g. 30 days).
**User impact:** None short-term; table bloat and slower unique-constraint checks over years.
**Technical cause:** Cleanup job never implemented.
**Frontend impact:** None.
**Backend impact:** One deleteMany in the purge-expired cron.
**Database impact:** Row cleanup only.
**Exact recommended fix:** Add prisma.processedStripeEvent.deleteMany({ where: { createdAt: { lt: 30daysAgo } } }) to pages/api/cron/purge-expired.ts.
**Suggested test cases:**
- Cron run deletes rows older than retention, keeps newer rows

---

### 61. Service worker never refreshes its precached '/' and uses a fixed cache name — offline fallback can serve stale post-deploy HTML

**Severity:** Low  
**Feature area:** PWA / deployment  
**User type affected:** All  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** public-deploy

**Files:** public/sw.js, pages/_app.tsx
**Line references:** public/sw.js:1-2, public/sw.js:4-9, public/sw.js:30-46, pages/_app.tsx:117-123
**Current behavior:** '/' is precached once at install. CACHE_NAME 'mortly-v1' is static and sw.js bytes never change between deploys, so the install event never re-runs and the runtime fetch handler only writes /_next/static/, /logo/, /locales/ — never '/'. Online behavior is safe (network-first), but the offline fallback for '/' is the HTML from whenever the user first installed the SW, referencing _next chunks from that old build (chunks may be in cache, so a coherent-but-ancient homepage can render offline indefinitely).
**Expected behavior:** Offline fallback serves a recent copy of the page (stale-while-revalidate on navigations) or a dedicated offline page; cache version bumps with deploys.
**User impact:** Offline/flaky-network users see an arbitrarily old homepage; cached /locales/ JSON can similarly go stale offline.
**Technical cause:** Static CACHE_NAME + precache list that the fetch handler never updates.
**Frontend impact:** sw.js only.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** In the fetch handler, also cache.put successful navigations for '/' (keeping network-first), or inject a build-id into CACHE_NAME at build time; optionally precache a dedicated /offline page instead of '/'.
**Suggested test cases:**
- Install SW, deploy a homepage change, go offline: served '/' should be the latest successfully fetched version, not first-install HTML.
- Cache storage contains only the current cache name after activate.

---

### 62. Package/dependency oddities: eslint-config-next 14 vs next 16, dead recharts dependency, Expo leftovers, env vars that silently degrade

**Severity:** Low  
**Feature area:** Build & deployment / dependencies  
**User type affected:** Admin  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Medium  
**Found by:** public-deploy

**Files:** package.json, app.json, lib/supabase.ts, lib/realtime.ts, lib/email.ts, instrumentation-client.ts, lib/stripe.ts
**Line references:** package.json:44 (next ^16.2.9), package.json:70-71 (eslint ^8, eslint-config-next 14.2.35), package.json:53 (recharts — only consumer is dead components/TrendChart.tsx), app.json:1-3 ({"expo":{}} leftover), lib/supabase.ts:3-4 (NEXT_PUBLIC_SUPABASE_URL/ANON_KEY ?? ''), lib/realtime.ts:30,40 (same '' fallbacks), lib/email.ts:14 (NEXTAUTH_URL || 'https://mortly.ca'), instrumentation-client.ts:3 (POSTHOG token non-null assertion), lib/stripe.ts:8-14 (comment says avoid *.clover preview API versions, then pins '2026-02-25.clover')
**Current behavior:** eslint-config-next is two majors behind next, so lint rules don't understand Next 16 conventions (installed next-auth 4.24.14 peer-supports next 16/react 19 — verified in node_modules, so peers are NOT broken despite the package.json appearance). recharts (~large bundle dep) is only imported by the unused TrendChart component. app.json with an empty expo object and pages/fonts/Geist*.woff are leftovers. Several lib modules fall back to empty strings for required env vars: missing Supabase envs make realtime chat silently no-op instead of failing fast; missing NEXTAUTH_URL silently points emails at https://mortly.ca; missing PostHog token passes undefined! to posthog.init. lib/stripe.ts pins the exact .clover preview API version its own comment warns against.
**Expected behavior:** Lint config matches the framework major; unused deps removed; required env vars validated at startup (fail fast) per variable criticality.
**User impact:** Indirect: misconfigured deploys degrade silently (dead chat, wrong email links, no analytics) instead of failing loudly.
**Technical cause:** Incremental upgrades without dependency hygiene; no central env validation module.
**Frontend impact:** None visible when envs are correct.
**Backend impact:** Add an env assertion module imported by lib/supabase.ts, lib/realtime.ts, lib/email.ts.
**Database impact:** None.
**Exact recommended fix:** Bump eslint-config-next to the 16.x line (or migrate to flat config); remove recharts + TrendChart, app.json, pages/fonts/*; add a lib/env.ts that throws (server) or console.errors (client) on missing NEXT_PUBLIC_SUPABASE_URL/ANON_KEY, NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN, NEXTAUTH_URL; reconcile the Stripe apiVersion comment with the pinned value.
**Suggested test cases:**
- npm run lint passes with the upgraded config.
- Boot with NEXT_PUBLIC_SUPABASE_URL unset: build/startup surfaces an explicit error instead of silent chat failure.
- Bundle analyze: recharts absent.

---

### 63. WebSite JSON-LD SearchAction is malformed (no urlTemplate/query-input)

**Severity:** Low  
**Feature area:** SEO / structured data  
**User type affected:** All  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** public-deploy

**Files:** pages/index.tsx
**Line references:** pages/index.tsx:42-51
**Current behavior:** The WebSite schema includes potentialAction: {"@type":"SearchAction", target:"https://mortly.ca/how-it-works"} — SearchAction requires an EntryPoint urlTemplate containing {search_term_string} plus a matching query-input property; /how-it-works is not a search endpoint.
**Expected behavior:** Either a valid sitelinks-searchbox SearchAction or no potentialAction.
**User impact:** Rich-result eligibility lost; Search Console may flag invalid structured data.
**Technical cause:** Schema copied without a real site-search feature.
**Frontend impact:** Delete the potentialAction block (site has no search).
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Remove potentialAction from the JSON-LD graph in pages/index.tsx (keep Organization + WebSite).
**Suggested test cases:**
- Google Rich Results Test on mortly.ca reports no structured-data errors.

---

### 64. Logged-out users clicking borrower CTAs land on /login with no return-to destination

**Severity:** Low  
**Feature area:** Marketing funnel / auth handoff  
**User type affected:** Borrower  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** public-deploy

**Files:** pages/index.tsx, pages/404.tsx, pages/how-it-works.tsx, components/borrower/BorrowerShell.tsx
**Line references:** pages/index.tsx:290-295 (CTA → /borrower/request/new), pages/404.tsx:27-29, pages/how-it-works.tsx:175-177, components/borrower/BorrowerShell.tsx:81-85 (router.replace('/login') without callbackUrl)
**Current behavior:** Homepage 'Get Started Free', how-it-works 'Submit Request', and the 404 page all link to /borrower/request/new; for logged-out visitors BorrowerShell replaces to /login with no callbackUrl/query, so after logging in the user is not returned to the request form (the funnel's primary conversion step).
**Expected behavior:** Auth gate preserves the intended destination (e.g. /login?callbackUrl=/borrower/request/new) and resumes after sign-in.
**User impact:** Funnel drop-off: the strongest CTA dumps anonymous users at a bare login page and loses their intent.
**Technical cause:** BorrowerShell auth gate hardcodes '/login' without propagating router.asPath.
**Frontend impact:** Pass callbackUrl through the redirect and honor it on the login page.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** router.replace(`/login?callbackUrl=${encodeURIComponent(router.asPath)}`) in BorrowerShell (and broker equivalent), consumed by the login page's signIn callbackUrl.
**Suggested test cases:**
- Logged out, click homepage 'Get Started Free', complete login: land on /borrower/request/new.

---

### 65. beforeunload warning fires even on a pristine/untouched form

**Severity:** Low  
**Feature area:** Request creation UX  
**User type affected:** Borrower  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** request-form

**Files:** pages/borrower/request/new.tsx
**Line references:** pages/borrower/request/new.tsx:34-40
**Current behavior:** The beforeunload handler unconditionally preventDefaults for the page's whole lifetime — closing/refreshing the tab triggers the 'leave site?' dialog even when nothing has been entered (and despite the draft being saved to sessionStorage anyway, making refresh loss-free).
**Expected behavior:** Warn only when there are unsaved meaningful changes (or not at all, since drafts persist across refresh).
**User impact:** Annoying spurious dialog; undermines trust in the warning.
**Technical cause:** No dirty-check before preventDefault.
**Frontend impact:** Gate on a dirty flag from the form snapshot.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Only attach/preventDefault when snapshot.form differs from the empty default.
**Suggested test cases:**
- Open form, close tab immediately → no dialog
- Type into form, close tab → dialog appears

---

### 66. Edit mode mislabels income years: 'current year' slot gets the OLDEST stored year

**Severity:** Low  
**Feature area:** Request edit  
**User type affected:** Borrower  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** request-form

**Files:** components/RequestForm.tsx
**Line references:** components/RequestForm.tsx:142-146, components/RequestForm.tsx:636-639
**Current behavior:** existingYears = Object.keys(annualIncome) — integer-like JSON keys enumerate in ASCENDING numeric order, so incomeYear1 (rendered under the t('request.currentYear') label) receives the older year (e.g. 2025) and incomeYear2 ('priorYear') gets 2026. The stale comment at line 140 ('default to last 2 years') also doesn't match the code (defaults to ''). The unused `currentYear` const at line 141 hints at abandoned logic.
**Expected behavior:** Newest year under 'current year', older under 'prior year'.
**User impact:** Confusing labels when editing an existing request; risk of users 'correcting' the wrong year's figure.
**Technical cause:** No sort/reverse on Object.keys before assignment.
**Frontend impact:** Sort existingYears descending before assigning.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** const existingYears = Object.keys(...).sort().reverse();
**Suggested test cases:**
- Edit a request with 2025+2026 income → 'current year' select shows 2026

---

### 67. Free-text inputs lack maxLength attributes, so limits surface only as English server errors at final submit

**Severity:** Low  
**Feature area:** Request form validation UX  
**User type affected:** Borrower  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** request-form

**Files:** components/RequestForm.tsx, pages/api/requests/index.ts, lib/validate.ts
**Line references:** components/RequestForm.tsx:552-562, components/RequestForm.tsx:615-625, components/RequestForm.tsx:674-686, components/RequestForm.tsx:875-890, pages/api/requests/index.ts:146-150, lib/validate.ts:123-139
**Current behavior:** city (server max 100), incomeTypeOther/businessType (bounded only by the details 4096 cap), and notes (server max 4000) have no client maxLength or counter. A long Step-3 notes entry fails at submit with English 'notes must be at most 4000 characters'. Note: assertBoundedJson 'bytes' actually measures JSON.stringify UTF-16 length, not bytes — Korean text consumes ~3x more real bytes than the nominal cap implies (harmless, just misnamed).
**Expected behavior:** Inputs enforce limits inline with localized counters.
**User impact:** Users can lose typing effort and see untranslated errors after completing all 3 steps.
**Technical cause:** Server limits never mirrored to input attributes; MAX_REQUEST_NOTES_LENGTH exists in lib/constants.ts:41 but isn't imported by the form.
**Frontend impact:** Add maxLength={4000} to notes, maxLength={100} to city, bounded lengths to detail text fields; import limits from lib/constants.ts.
**Backend impact:** Rename the assertBoundedJson parameter to maxChars or measure Buffer.byteLength.
**Database impact:** None.
**Exact recommended fix:** Share constants between form and API; add maxLength + counters.
**Suggested test cases:**
- Paste 5000 chars in notes → input truncates/blocks at 4000 with counter
- city input caps at 100 chars

---

### 68. Schema v1 rows (if any survive in prod) would render as garbage on the borrower detail page; schemaVersion is never read

**Severity:** Low  
**Feature area:** Schema versioning  
**User type affected:** Both  
**Status:** Needs manual verification  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** request-form

**Files:** pages/borrower/request/[id].tsx, components/broker/RequestDetailBlocks.tsx, prisma/schema.prisma, pages/api/requests/index.ts
**Line references:** pages/borrower/request/[id].tsx:436-441, pages/borrower/request/[id].tsx:452-479, components/broker/RequestDetailBlocks.tsx:63-65, components/broker/RequestDetailBlocks.tsx:138-167, prisma/schema.prisma:106, pages/api/requests/index.ts:208
**Current behavior:** Schema v1 (commit 2f91328) used flat columns (requestType, propertyType, price/income ranges) which were later dropped — the squashed migration 20260413074337 creates the table with schemaVersion default 2 and no legacy columns. No code anywhere branches on schemaVersion (grep: only types/index.ts:27, fixtures, seed, and the POST write at index.ts:208). Defensive remnants exist for string-shaped details (RequestDetailBlocks handles string purposeOfUse/annualIncome; [id].tsx:474-478 renders string corporateAnnualIncome). However borrower [id].tsx:436 calls Object.entries(details.annualIncome || {}) — if a legacy row had annualIncome as a string, this renders one row PER CHARACTER; line 476's template literal `$${...}` is always truthy so '--' fallback never shows ('$undefined' possible).
**Expected behavior:** Either confirm no pre-v2 rows exist in production and delete the dead fallbacks, or branch on schemaVersion consistently.
**User impact:** Only affects users with pre-March-2026 requests, if any survived the migration.
**Technical cause:** Half-removed version-aware rendering.
**Frontend impact:** Delete legacy branches or guard annualIncome with typeof check matching RequestDetailBlocks.
**Backend impact:** Optionally backfill/normalize old rows.
**Database impact:** Run SELECT count(*) FROM borrower_requests WHERE "schemaVersion" < 2 in prod to verify.
**Exact recommended fix:** Verify prod data, then remove dead fallbacks (or fix the Object.entries guard).
**Suggested test cases:**
- Render detail page with details.annualIncome = '100000' (string) → no per-character rows

---

### 69. Admin app has no responsive layout — fixed two-pane grids and wide tables break below ~1024px

**Severity:** Low  
**Feature area:** Admin responsive  
**User type affected:** Admin  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Medium  
**Found by:** ux-states

**Files:** pages/admin/inbox.tsx, pages/admin/reports.tsx, pages/admin/activity.tsx, pages/admin/people.tsx, components/admin/AdminShell.tsx
**Line references:** pages/admin/inbox.tsx:249, pages/admin/reports.tsx:228, pages/admin/activity.tsx:426, pages/admin/people.tsx:427, components/admin/AdminShell.tsx:166
**Current behavior:** Inbox uses grid-cols-[1fr_400px], reports [1fr_440px], activity [1fr_520px], people a 7-column fixed grid; the 72px rail has no mobile collapse. No sm:/md: prefixes exist on these containers, so on a phone the queue column is crushed to near-zero width next to the fixed drawer.
**Expected behavior:** Either documented desktop-only policy or stacked single-column drawers below lg.
**User impact:** Admins cannot triage from a phone (e.g. approving a request while away from desk).
**Technical cause:** Fixed track sizes without breakpoints; appears to be an intentional desktop-first design but is undocumented.
**Frontend impact:** Add lg: prefixes turning drawers into overlay sheets below lg, or document desktop-only.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Lowest cost: render the drawer as a fixed overlay below lg (pattern already exists in broker/messages context panel).
**Suggested test cases:**
- Inbox at 375px: queue rows readable; drawer opens as overlay

---

### 70. Apple sign-in absent from web login/signup despite product spec listing credentials+Google+Apple

**Severity:** Low  
**Feature area:** Auth providers  
**User type affected:** All  
**Status:** Needs manual verification  
**Launch blocker:** No  
**Implementation complexity:** Medium  
**Found by:** ux-states

**Files:** pages/login.tsx, pages/signup.tsx
**Line references:** pages/login.tsx:185-199, pages/signup.tsx:303-330
**Current behavior:** Only a Google button is rendered on web login/signup; Apple appears to exist only via /api/auth/mobile-oauth for the Expo app.
**Expected behavior:** If Apple is supported on web, render the button; if intentionally mobile-only, document it.
**User impact:** Apple-account users who registered on mobile may be unable to sign in on web.
**Technical cause:** Provider button not implemented on web pages; whether the NextAuth Apple provider is configured for web depends on env/provider config not fully visible.
**Frontend impact:** Add Apple button if web Apple OAuth is configured.
**Backend impact:** Verify Apple provider registration in createAuthOptions and Apple service-id redirect URLs.
**Database impact:** None.
**Exact recommended fix:** Confirm intended scope; if mobile-only, ensure web login shows guidance for Apple-mobile users.
**Suggested test cases:**
- Apple-registered user attempts web login → has a working path

---

### 71. New-request page warns on tab close even when the form is untouched

**Severity:** Low  
**Feature area:** Borrower request create  
**User type affected:** Borrower  
**Status:** Confirmed  
**Launch blocker:** No  
**Implementation complexity:** Small  
**Found by:** ux-states

**Files:** pages/borrower/request/new.tsx
**Line references:** pages/borrower/request/new.tsx:34-40
**Current behavior:** beforeunload handler unconditionally calls e.preventDefault(), so closing the tab on a pristine form triggers the browser 'leave site?' dialog.
**Expected behavior:** Warn only when the draft differs from the initial empty state.
**User impact:** Annoying false-positive confirmation dialogs.
**Technical cause:** No dirty check (the sessionStorage draft also persists data anyway).
**Frontend impact:** Track dirty state from the RequestForm snapshot and gate the handler.
**Backend impact:** None.
**Database impact:** None.
**Exact recommended fix:** Gate preventDefault on snapshot?.form differing from defaults.
**Suggested test cases:**
- Open new request, close tab immediately → no dialog
- Type into step 1, close tab → dialog appears

---



## Complete feature map

| Feature | User | Frontend | Backend | DB models | Services | Status | Risk | Notes |
|---|---|---|---|---|---|---|---|---|
| Credentials signup (email/password) | Both | pages/signup.tsx | pages/api/auth/signup.ts<br>lib/normalizeEmail.ts<br>lib/validate.ts<br>+1 more | User | Resend | Complete | Low | Validates name 1-100, loose email regex, password 8-200, role allowlist, legal version; bcrypt hash(password,12); duplicate email to 409; per-IP rate limit 5/60s; creates emailVerified=false + verification code. Email normalized before uniqueness check. |
| Credentials login + brute-force protection | All | pages/login.tsx | pages/api/auth/[...nextauth].ts<br>lib/auth.ts<br>lib/rate-limit.ts | User | Vercel KV | Partial | Medium | Per-IP (30) + per-email (5) caps over 15min gate POST callback/credentials before NextAuth; constant-time dummy-hash compare. Strength depends on KV_REST_API_URL being set in prod (else per-lambda fallback). GOOGLE_ACCOUNT/EMAIL_NOT_VERIFIED branches leak account existence. |
| Google OAuth (web) | Both | pages/login.tsx<br>pages/signup.tsx | lib/auth.ts<br>pages/api/auth/[...nextauth].ts | User | Google OAuth | Complete | Low | signIn callback rejects unverified email (lib/auth.ts:160-164), links by googleId then email, creates BORROWER with needsRoleSelection. Legal-acceptance cookie gate redirects to /signup?legal=required when not accepted. |
| Apple OAuth (web via NextAuth AppleProvider) | Both |  | lib/auth.ts | User | Apple Sign In | Stub | Low | AppleProvider conditionally configured (lib/auth.ts:77-84) but NO Apple sign-in button exists anywhere in the web UI (login.tsx/signup.tsx render only Google). Web Apple path is unreachable; Apple is handled mobile-only via mobile-oauth.ts. |
| Mobile OAuth (Google/Apple native token exchange) | Both |  | pages/api/auth/mobile-oauth.ts | User | Google OAuth, Apple Sign In | Complete | Medium | Verifies id_token audience (Google iOS+web client IDs; Apple comma-separated bundle+services IDs), enforces email_verified, links/creates account, blocks SUSPENDED/BANNED, mints 30d JWT with tokenVersion+status. Audience/issuer correctness is config-dependent; verify env values. |
| OAuth role-selection flow | Both | pages/select-role.tsx | pages/api/auth/select-role.ts<br>lib/auth.ts | User | — | Partial | Medium | Endpoint is first-time-only (blocks ADMIN, 409 if already selected), same-origin CSRF gate, invalidates session DB cache. But nothing FORCES a needsRoleSelection user to /select-role; they default to BORROWER and can use the borrower app directly. |
| Session revocation (tokenVersion + status) | All |  | lib/auth.ts<br>pages/api/admin/users/[id].ts<br>pages/api/admin/users/bulk.ts<br>+2 more | User | — | Complete | Low | session callback re-reads tokenVersion+status (5s cache) and returns null on mismatch/non-ACTIVE/deleted user. Admin suspend/ban + password change/reset bump tokenVersion. Existing sessions invalidated within ~5s; addresses the prior audit's suspended-session concern. |
| Role-based page protection - admin | Admin | pages/admin/inbox.tsx<br>pages/admin/people.tsx<br>pages/admin/activity.tsx<br>+5 more | lib/admin/ssrAuth.ts | User | — | Complete | Low | adminSSR() server-side guard redirects non-ADMIN to /login?callbackUrl=... at render time. Correct pattern. |
| Role-based page protection - borrower/broker | Both | components/borrower/BorrowerShell.tsx<br>components/broker/BrokerShell.tsx<br>components/borrower/BorrowerDataContext.tsx<br>+3 more |  |  | — | Partial | Medium | Client-only guards: pages use getStaticProps or translation-only getServerSideProps; auth/role enforced in useEffect after hydration. No PII leak (all data via withAuth APIs) but no SSR gate; wrong-role/anon users get the HTML shell then a client redirect. |
| Broker onboarding gate (no Broker row yet) | Broker | components/broker/BrokerDataContext.tsx<br>pages/broker/onboarding.tsx | pages/api/brokers/profile.ts | Broker, User | — | Partial | Medium | BrokerDataContext redirects to /broker/onboarding on profile 404 (client-side only). API enforces role BROKER on profile create. A BROKER without a Broker row is gated in UI but the gate is not server-enforced across all broker pages. |
| Logout | All | components/Navbar.tsx<br>components/borrower/BorrowerShell.tsx<br>components/broker/BrokerShell.tsx | pages/api/auth/[...nextauth].ts |  | — | Complete | Low | Confirmation modal then signOut({callbackUrl:'/login'}); deliberately lands on /login to avoid stale-session flash on SSG homepage. |
| Email normalization consistency | All |  | lib/normalizeEmail.ts<br>lib/auth.ts<br>pages/api/auth/signup.ts<br>+4 more | User | — | Complete | Low | normalizeEmail (trim+lowercase) used on signup/login/verify/resend/forgot + Postgres LOWER(email) unique index (migration 20260501000000). OAuth lowercases. Consistent across paths. |
| Rate-limiting infrastructure | All |  | lib/rate-limit.ts<br>lib/withAuth.ts |  | Vercel KV | Partial | Medium | checkRateLimit uses KV INCR+PEXPIRE with non-fail-open in-memory degrade; getClientIp uses x-real-ip / last XFF entry (anti-spoof). Per-lambda fallback multiplies caps when KV unconfigured. Legacy authLimiter/verifyCodeLimiter are dead (tests only). |
| Forgot password (request reset link) | All (credentials accounts) | pages/forgot-password.tsx | pages/api/auth/forgot-password.ts<br>lib/email.ts<br>lib/rate-limit.ts<br>+1 more | User | Resend, Vercel KV | Complete | Low | Strong implementation: 32-byte token, SHA-256 hashed at rest (User.resetToken @unique), 1h expiry, fire-and-forget send plus timing padding (TARGET_RESPONSE_MS=350 + jitter) so existing/missing emails are indistinguishable. Gaps: no per-email cooldown (only 3/min/IP), email locale read from preferences.locale which is never set at signup, reset link has no /en locale prefix, falls back to http://localhost:3000 if NEXTAUTH_URL unset. |
| Reset password (consume token) | All (credentials accounts) | pages/reset-password.tsx | pages/api/auth/reset-password.ts | User | Vercel KV | Complete | Low | Expiry and single-use enforced (token nulled on success), tokenVersion incremented atomically so existing sessions are revoked via lib/auth.ts session callback within SESSION_DB_CACHE_TTL_MS=5000ms; emailVerified intentionally set true (inbox ownership proven). Gaps: no typeof/max-length validation on password (signup caps 8-200), page flashes Invalid Link before router.isReady. |
| Email verification (6-digit code entry) | Borrower and Broker (new credentials signups) | pages/verify-email.tsx | pages/api/auth/verify-email.ts<br>pages/api/auth/signup.ts | User | Vercel KV | Complete | Medium | timingSafeEqual compare, 5-attempt-per-code burn, durable per-email (10/10min) and per-IP (30/h) limits, 10-min code expiry, enumeration-safe generic responses. UX gaps: 429 surfaced as 'Invalid code', no missing-email-param state, unverified users redirected from login face 60s countdown with an expired code and no auto-resend. |
| Resend verification code | Borrower and Broker (unverified accounts) | pages/verify-email.tsx | pages/api/auth/resend-code.ts<br>lib/email.ts | User | Resend, Vercel KV | Partial | Medium | Backend solid: 60s per-account cooldown via verificationCodeSentAt, 3/min/IP limit, attempts reset, generic 200 for unknown/verified emails. Frontend broken: handleResend only checks res.status===429; 400/500/502 (including Resend send failure) display the success message 'New code sent' and start the countdown. |
| Email verification enforcement (login gate) | All | pages/login.tsx | lib/auth.ts<br>pages/api/auth/[...nextauth].ts | User | Vercel KV | Complete | Low | Credentials authorize throws EMAIL_NOT_VERIFIED (lib/auth.ts:122-124) so unverified users can never obtain a session — verification is effectively enforced everywhere downstream. OAuth (Google/Apple) accounts require provider email_verified claim and are created/linked with emailVerified=true. Login page redirects EMAIL_NOT_VERIFIED to /verify-email with email prefilled. |
| Transactional auth emails (verification code + password reset, ko/en) | All |  | lib/email.ts<br>pages/api/auth/forgot-password.ts<br>pages/api/auth/resend-code.ts<br>+1 more | User | Resend | Complete | Low | Both templates fully bilingual (subject + body) with correct expiry copy (10 min code / 1h link) and 'ignore if not requested' footer. Locale selection differs per flow: resend-code/signup take locale from request body; forgot-password reads preferences.locale which is never populated at signup, so reset emails default to Korean for English users. generateVerificationCode uses crypto.randomInt(100000, 999999) — upper bound exclusive, 999999 unreachable (cosmetic). |
| Multi-step request creation form (3 steps: Basics, Details, Review) | Borrower | pages/borrower/request/new.tsx<br>components/RequestForm.tsx<br>components/borrower/RequestFormLayout.tsx<br>+1 more | pages/api/requests/index.ts<br>lib/withAuth.ts<br>lib/validate.ts<br>+2 more | BorrowerRequest, SystemSetting | PostHog (loan_request_submitted event), Vercel KV (rate limit) | Partial | Medium | Happy path works end-to-end; new request gets status PENDING_APPROVAL (schema default, prisma/schema.prisma:104) and the user is told via banner on the detail page. Gaps: blank page for logged-out visitors, missing i18n keys, no per-field validation feedback (Next button silently disabled). |
| Draft persistence (sessionStorage rehydration) | Borrower | components/RequestForm.tsx |  |  | — | Broken | High | Form fields restore, but income/corporate year-select state (incomeYear1/2, corpYear1/2) initializes only from initialValues (RequestForm.tsx:142-153), never from the restored draft — restored income amounts become invisible, get overwritten with empty strings on year re-select, or submit as stale orphaned year entries. |
| Server-side request creation (POST /api/requests) | Borrower |  | pages/api/requests/index.ts<br>lib/validate.ts<br>lib/requestConfig.ts | BorrowerRequest, SystemSetting | Vercel KV | Partial | Medium | Validates category, productTypes (enum per category), province presence, purposeOfUse enum, incomeTypes non-empty, businessType+notes for commercial, max-active cap (default 5 per lib/settings.ts:7), details<=4096 chars. Does NOT validate: desiredTimeline (free string, optional), notes for residential, annualIncome at all, incomeTypes values, province against canonical list, arbitrary extra keys in details. No idempotency; count-then-create race on the cap. |
| Request edit flow (RequestForm edit mode + PATCH /api/requests/[id]) | Borrower | pages/borrower/request/[id].tsx<br>components/RequestForm.tsx | pages/api/requests/[id].ts | BorrowerRequest | — | Broken | High | Client always sends every field; server 409s any non-cosmetic-key payload once the request has a conversation (pages/api/requests/[id].ts:177-191), so editing becomes impossible (even notes) while the Edit button stays visible. PATCH also skips all category-specific details validation and 500s on invalid mortgageCategory / non-array productTypes. |
| Request read-only detail view + PENDING_APPROVAL/REJECTED status communication | Borrower | pages/borrower/request/[id].tsx<br>components/StatusBadge.tsx<br>components/ConsultationStepper.tsx | pages/api/requests/[id].ts | BorrowerRequest, Conversation | — | Partial | Low | Pending/rejected banners localized in both languages. Initial fetch failure leaves an infinite skeleton (error banner unreachable, [id].tsx:141-147). |
| RESIDENTIAL vs COMMERCIAL field branching | Borrower | components/RequestForm.tsx<br>lib/requestConfig.ts | pages/api/requests/index.ts | BorrowerRequest | — | Complete | Low | Category switch resets productTypes + details correctly (RequestForm.tsx:162-172). Server enforces product-category pairing via validateProductTypes. 8 residential + 6 commercial products; broker pages render the same PRODUCT_LABEL_KEYS, all 14 keys present in ko+en. |
| Live summary panel + step rail (3-column layout) | Borrower | components/borrower/RequestFormLayout.tsx |  |  | — | Partial | Low | Works and tested (tests/borrower/RequestFormLayout.test.tsx), but 9 of its translation keys are missing from both locale files, so hardcoded fallbacks leak (including Korean fallbacks shown to English users: '개인정보', '요청 요약'). |
| Province selection | Both | components/RequestForm.tsx<br>pages/broker/requests/index.tsx<br>pages/broker/onboarding.tsx<br>+1 more | pages/api/requests/index.ts | BorrowerRequest, Broker | — | Partial | Medium | Borrower form has all 13 provinces/territories as full English names (RequestForm.tsx:13-27); broker browse filter, onboarding, and profile only list 10 (no NWT/Nunavut/Yukon). Server accepts any string <=100 — no canonical list. Province names are stored in English only and never localized to Korean. |
| Currency input formatting (CAD) | Borrower | components/RequestForm.tsx |  | BorrowerRequest | — | Partial | Medium | Digit-stripping + Number().toLocaleString() per keystroke; '$' prefix; inputMode=numeric. But the formatted DISPLAY string (browser-locale dependent grouping) is what gets stored in details JSON and shown to brokers — not a number. |
| PIPEDA consent at request submission | Borrower | components/RequestForm.tsx | pages/api/requests/index.ts |  | — | Missing | Medium | No consent checkbox exists in the request form (only informational privacy callouts); the server records no consent flag or timestamp; User/BorrowerRequest models have no consent fields. Signup has a client-side terms checkbox but nothing persisted. Retention purge cron exists (PIPEDA Principle 5) but collection consent is not captured. |
| Duplicate-submit protection | Borrower | components/RequestForm.tsx | pages/api/requests/index.ts | BorrowerRequest | — | Partial | Medium | Submit button disabled via submitting state only; no server idempotency key; max-active check is count-then-create (racy). Rapid double-click can create two identical requests. |
| Submission rate limiting | Borrower |  | pages/api/requests/index.ts<br>lib/withAuth.ts<br>lib/rate-limit.ts |  | Vercel KV | Complete | Low | POST limited to 10/min per user (bucket 'requests-create', pages/api/requests/index.ts:223); applies to mutating methods only so GET polling is unaffected. Falls back to per-lambda in-memory if KV_REST_API_URL unset — verify KV is provisioned in production. |
| Schema v1 backward compatibility | All | pages/borrower/request/[id].tsx<br>components/broker/RequestDetailBlocks.tsx | pages/api/requests/index.ts | BorrowerRequest | — | Stub | Low | schemaVersion column exists (always written as 2) but NO code branches on it. v1 legacy columns (requestType, propertyType, price/income ranges per commit 2f91328) were dropped; squashed migrations create the table fresh with default 2. Scattered defensive fallbacks for string-shaped v1 details remain; borrower detail page would render Object.entries() of a string as per-character garbage rows if v1-shaped details rows still exist in prod. |
| Broker onboarding (profile creation) | Broker | pages/broker/onboarding.tsx | pages/api/brokers/profile.ts<br>lib/validate.ts | Broker, User | PostHog | Partial | Medium | Required fields (brokerageName, province, phone) enforced client+server; licenseNumber correctly optional in UI and API since migration 20260511. Defects: error responses read from data.message but API returns {error}; lax phone validation accepts partial numbers (+1416555 passes E.164 regex); province validated only as string<=100, not against the 10-province list. |
| Verification status gating (PENDING/VERIFIED/REJECTED) | Broker | pages/broker/dashboard.tsx<br>pages/broker/requests/index.tsx<br>pages/broker/profile.tsx | pages/api/requests/index.ts<br>pages/api/requests/[id].ts<br>pages/api/conversations/index.ts<br>+1 more | Broker, BorrowerRequest | — | Partial | Medium | Server-side enforced: non-VERIFIED brokers get 403 on browse (requests/index.ts:23-25), detail (requests/[id].ts:67-69), conversation create (conversations/index.ts:239-241), and single mark-seen (mark-seen.ts:24-26). Gaps: bulk mark-requests-seen has no verification check; REJECTED brokers have no re-application path (banner says contact support only); VERIFIED brokers can edit material fields without status reset. |
| Lead inbox / browse requests (filters, table, mobile cards) | Broker | pages/broker/requests/index.tsx | pages/api/requests/index.ts | BorrowerRequest, BrokerRequestSeen, Conversation | — | Partial | High | Province and category filters work via query params; desktop table + mobile card stack both present. Broken: 'Only unresponded' chip filters on req.conversations which the API no longer returns (it returns hasMyConversation, unused); no pagination UI so only the 20 newest OPEN requests are ever visible; no search box despite 'filters/search' expectation; broker profile mortgageCategory/province are NOT applied as default match criteria. |
| Unseen request indicators (BrokerRequestSeen + newCount) | Broker | pages/broker/requests/index.tsx<br>pages/broker/dashboard.tsx<br>components/broker/BrokerShell.tsx<br>+1 more | pages/api/brokers/mark-requests-seen.ts<br>pages/api/brokers/requests/[id]/mark-seen.ts<br>pages/api/requests/index.ts | BrokerRequestSeen, Broker | — | Partial | Low | Per-request dots driven by BrokerRequestSeen; newCount computed server-side at requests/index.ts:47-53. Legacy Broker.lastRequestsSeenAt is written by the bulk endpoint but never read anywhere (dead). Bulk mark-on-unmount marks ALL open requests seen including ones never fetched/rendered (filtered out or beyond page 1). |
| Request detail view (broker) | Broker | pages/broker/requests/[id].tsx<br>components/broker/RequestDetailBlocks.tsx | pages/api/requests/[id].ts | BorrowerRequest, Conversation, Broker | PostHog | Partial | Medium | Shows category, products, region, timeline, notes, residential income table / commercial corporate financials. Amounts render as $<pre-comma'd string> (borrower form stores Number(digits).toLocaleString(), components/RequestForm.tsx:210) so CAD display is acceptable. Gaps: FREE-tier 0-credit broker sees enabled respond CTA with '1 credit will be used' copy then gets an English-only 403; transient wrong no-credits card while profile loads; dates always formatted en-CA; competitor conversations correctly stripped server-side (requests/[id].ts:78-82). |
| Borrower PII masking before credit spend | Both | pages/broker/requests/[id].tsx<br>pages/broker/requests/index.tsx | pages/api/requests/index.ts<br>pages/api/requests/[id].ts | BorrowerRequest | — | Partial | Medium | Borrower name/email/phone are never included (no borrower relation in either GET), which is the masking model. However full financial details JSON and free-text notes are visible to every VERIFIED broker pre-credit; notes are an unmasked channel where a borrower could include contact info, letting brokers bypass the credit paywall. Relies on admin approval screening (requests start PENDING_APPROVAL). Internal borrowerId cuid is also exposed in responses. |
| Broker dashboard (stats, recent requests, conversations widgets) | Broker | pages/broker/dashboard.tsx<br>components/broker/BrokerDataContext.tsx<br>components/broker/ui/index.tsx | pages/api/requests/index.ts | BorrowerRequest, Conversation, Broker | — | Partial | Low | Counters come from a single shared 30s polling loop (requests?limit=5, messages/unread, conversations). Stat labeled 'New requests · this week' actually shows all-time unseen OPEN count. Banner priority logic (verification > credits > free-plan) is sound and matches server gates except FREE tier on detail page. |
| Broker profile editing | Broker | pages/broker/profile.tsx | pages/api/brokers/profile.ts | Broker | — | Partial | Medium | All fields editable incl. license, brokerage, province, category; PUT is partial-update with server-side validation. Defects: error shape mismatch (data.message vs {error}); editing material fields after VERIFIED does not reset verificationStatus; page duplicates the profile fetch BrokerDataContext already performs. |
| Profile photo upload | Broker |  | pages/api/brokers/profile.ts | Broker | — | Missing | Low | Broker.profilePhoto exists in schema and is accepted/validated by the API (assertOptionalHttpsUrl, profile.ts:65-68) but no UI anywhere sets it, no upload mechanism (no storage integration) exists, and nothing renders it — dead field end to end. |
| Public borrower-facing broker profile page | Borrower | pages/borrower/brokers/[requestId].tsx | pages/api/requests/[id].ts | Broker | — | Missing | Medium | No public broker profile/directory route exists under pages/ (verified: only pages/borrower/brokers/[requestId].tsx, which lists brokers who already spent a credit on that request, showing brokerageName/experience/specialties/bio inline). Borrowers cannot view a standalone broker profile, and profilePhoto/areasServed are never shown to them. |
| Broker app shell / navigation / sign-out | Broker | components/broker/BrokerShell.tsx<br>components/broker/BrokerDataContext.tsx<br>pages/broker/index.tsx |  |  | — | Complete | Low | Auth gate redirects non-brokers to /login; missing profile redirects to /broker/onboarding (loop-guarded). All nav targets exist (/broker/dashboard,requests,messages,profile,billing; /login; /broker/onboarding). Entry links from login.tsx:13, select-role.tsx:36/65, index.tsx:23, for-brokers.tsx:12, pricing.tsx:42 all resolve. Cosmetic bug: sidebar tier chip renders '<TIER> · PRO' for every tier. |
| Request context panel (shared with messages) | Broker | components/broker/RequestContextPanel.tsx<br>components/broker/RequestDetailBlocks.tsx | pages/api/conversations/[id].ts | BorrowerRequest, Conversation | — | Complete | Low | Renders full request submission beside threads; empty state, close button, deep link to /broker/requests/[publicId] (exists). Several of its t() keys missing from both locales (broker.requestContext, broker.viewFullRequest, etc.). |
| Automatic broker-request matching (category/province coverage) | Broker | pages/broker/dashboard.tsx | pages/api/requests/index.ts | Broker, BorrowerRequest | — | Missing | Medium | Broker.mortgageCategory (RESIDENTIAL/COMMERCIAL/BOTH) and province are stored but never applied to browse queries or counters — a RESIDENTIAL-only Ontario broker sees and is counted against all categories and provinces. Dashboard copy ('No new requests match your coverage') implies matching that does not exist; filtering is manual-only. |
| Broker-initiated conversation creation (credit spend / tier gating) | Broker | pages/broker/requests/[id].tsx | pages/api/conversations/index.ts | Conversation, Broker, BorrowerRequest, Message, UserBlock | Expo push (lib/push), Supabase Realtime broadcast (lib/realtime) | Complete | Medium | Verified-only + non-FREE tier enforced; Serializable tx prevents credit double-spend (pages/api/conversations/index.ts:294-338); intro message mirrors /api/messages guards. Gap: request.status is never checked, so credits can be spent opening conversations on CLOSED/EXPIRED/REJECTED/PENDING_APPROVAL requests. |
| Borrower-initiated conversation creation | Borrower |  | pages/api/conversations/index.ts | Conversation, Broker, UserBlock | Expo push | Partial | Low | API path exists (requires brokerId, own-request check, block check) but no web frontend calls it — pages/borrower/brokers/[requestId].tsx only links to existing conversations. Presumably mobile-app-only. No tx/unique-violation handling: concurrent duplicates 500 instead of returning existing (lines 194-209). No request.status or broker verification check on this path. |
| Message send (both directions) | Both | pages/borrower/messages.tsx<br>pages/broker/messages.tsx | pages/api/messages/index.ts | Message, Conversation, UserBlock | Expo push, Supabase Realtime broadcast | Partial | Medium | 5000-char cap (app + DB VarChar(5000)), [admin]/[system] prefix spoof-guard, bidirectional block check, broker spam guard via denormalized counters in same tx, 30/min rate limit, banned/suspended senders cut off via session callback (lib/auth.ts:310-323, 5s cache window). Missing: CLOSED-conversation rejection. |
| Supabase Realtime sync + polling fallback | Both | pages/borrower/messages.tsx<br>pages/broker/messages.tsx | lib/realtime.ts<br>lib/supabase.ts | Message, Conversation | Supabase Realtime (anon key, HTTP broadcast + websocket subscribe) | Partial | High | Content-free 'sync' broadcast on topic chat-<internal cuid>; client refetches via authenticated GET. No chat content crosses anon transport — good design. BUT correctness of the deny-all RLS claim and realtime publication membership is Supabase dashboard config, unverifiable in repo. Channels are public broadcast channels (no private-channel auth): anyone with the anon key + a conversation id can subscribe (activity-timing metadata) and broadcast spoofed sync events (forced-refetch amplification). Poll fallback updates messages but NOT conversation status. |
| Unread counts (per-conversation badge + nav badge) | Both | pages/borrower/messages.tsx<br>pages/broker/messages.tsx<br>components/Navbar.tsx | pages/api/conversations/index.ts<br>pages/api/messages/unread.ts | Conversation, Message | — | Partial | Low | Single batched groupBy/count (no N+1). Inconsistencies: gte (list) vs gt (nav) boundary, nav badge counts ACTIVE-only and ignores blocks while list computes for all listed conversations; in-page list badges go stale (no list polling/subscription) while nav badge polls every 30s. |
| Conversation close (borrower manual) | Borrower | pages/borrower/messages.tsx | pages/api/conversations/[id].ts | Conversation | Supabase Realtime broadcast | Complete | Low | Borrower-only, owner-checked, idempotency guard, confirm dialog, realtime nudge to other party. Brokers have no close ability (appears intentional). Closing does not write a system message into the thread (unlike admin/request-close paths). |
| Auto-close cron (inactive 72h / unstarted 7d) | Both |  | pages/api/cron/auto-close-conversations.ts<br>lib/cron.ts<br>lib/constants.ts | Conversation, BorrowerRequest, Message | Vercel cron (12:00 daily) | Partial | Medium | Auth gate (CRON_SECRET + x-vercel-cron) solid and tested; batched pagination bounded. Gaps: closes silently (no system message, no notifyConversations, no push); take:10 unordered message sample for 'borrower engaged' check could misjudge if admin raises broker message limit above ~9; eligible.length===0 page break can strand eligible rows behind a page of ineligible ones (acknowledged in comment, line 57-62). |
| User block / unblock + enforcement | Both |  | pages/api/users/[publicId]/block.ts<br>pages/api/users/blocked.ts<br>pages/api/conversations/index.ts<br>+1 more | UserBlock | — | Complete | Low | Idempotent upsert, self-block rejected, symmetric visibility filtering in list, bidirectional send/create rejection. Blocked list endpoint omits email. Note: blocked users can still GET an existing thread by id (history retention is documented intent); block filtering in the list runs after pagination. |
| Chat disclaimer (both sides) | Both | components/ChatDisclaimer.tsx<br>pages/borrower/messages.tsx<br>pages/broker/messages.tsx |  |  | — | Complete | Low | Role-specific copy, all six i18n keys present in ko+en. Persistence is localStorage-only (re-shown per device/browser; clearable) and acceptance is not server-enforced — a user can send via API without accepting. Acceptable for a disclaimer. |
| Message history pagination | Both | pages/borrower/messages.tsx<br>pages/broker/messages.tsx | pages/api/conversations/[id].ts | Message | — | Partial | Medium | API implements cursor pagination (before + hasMore, [id].ts:13-31,88) but neither frontend uses it — no load-older UI; threads silently show only the latest 50 messages. Conversation list likewise capped at default 50 with no page param sent. |
| System messages (admin/request close notices) | All | pages/borrower/messages.tsx<br>pages/broker/messages.tsx | pages/api/conversations/[id].ts<br>pages/api/admin/conversations/[id].ts<br>pages/api/admin/requests/[id].ts<br>+1 more | Message | — | Broken | Medium | isSystem column exists and is set on creation, but GET /api/conversations/[id] never selects it and neither frontend renders system styling — system messages display as ordinary participant bubbles, misattributed to whoever's senderId was used (admin, or the borrower themself). Bodies are English-only or a single bilingual slash-string. |
| Chat PII retention (message redaction) | All |  | pages/api/cron/purge-expired.ts | Message, BorrowerRequest | Vercel cron (1:30 daily) | Complete | Low | Redacts non-system message bodies for terminal-status requests past the retention window; idempotent and batched. Addresses the prior audit's PII-retention flag for chat. |
| Subscription checkout + upgrade/downgrade (create-checkout) | Broker | pages/broker/billing.tsx | pages/api/stripe/create-checkout.ts<br>lib/stripe.ts<br>lib/origin.ts | Broker, Subscription | Stripe Checkout, Stripe Subscriptions API | Partial | High | Role-gated to BROKER (create-checkout.ts:111), FREE tier rejected (lines 14-16), upgrades immediate with proration (66-75), downgrades stored as pendingTier (76-83). Defects: downgrade cycle billed at old price (see findings); equal-rank tier request is treated as a downgrade (isUpgrade uses strict > at lines 61-63) and would set pendingTier to the current tier — frontend disables the button so unreachable via UI but reachable via direct API call. |
| Stripe webhook processing (subscription lifecycle + credit grants) | Broker |  | pages/api/webhooks/stripe.ts<br>lib/stripe.ts<br>lib/settings.ts | Subscription, Broker, ProcessedStripeEvent | Stripe webhooks, PostHog | Partial | High | bodyParser disabled (lines 7-9), signature verified (59-69), idempotency ledger inserted before handler with rollback-on-error (75-92, 121-145). Handles checkout.session.completed, invoice.paid, invoice.payment_failed, customer.subscription.updated/deleted; others acked 200. Credits OVERWRITE monthly (responseCredits set, not incremented) — unused credits do not roll over and admin grants are wiped at renewal. PREMIUM uses -1 sentinel. Known holes: invoice.paid on EXPIRED sub re-grants credits; pendingTier never cleared on checkout/deletion; crash window drops events. |
| Customer portal (manage/cancel subscription, update payment) | Broker | pages/broker/billing.tsx | pages/api/stripe/create-portal.ts | Broker | Stripe Billing Portal | Complete | Low | BROKER-only, return_url pinned to NEXTAUTH_URL via getSafeRedirectOrigin (create-portal.ts:24-28). 400 when no stripeCustomerId. No test coverage. |
| Invoice history | Broker | pages/broker/billing.tsx | pages/api/stripe/invoices.ts | Broker | Stripe Invoices API | Complete | Low | BROKER-only (invoices.ts:42), returns [] when no customer, maps 8 safe fields, limit 24. Fetch failure on frontend silently shows the 'no billing history' empty state. No test coverage. |
| Billing page UI (plan cards, status banners, downgrade modal) | Broker | pages/broker/billing.tsx<br>components/broker/BrokerShell.tsx<br>components/Skeleton.tsx | pages/api/brokers/profile.ts<br>pages/api/stripe/invoices.ts | Broker, Subscription | Stripe, PostHog | Partial | Medium | Has skeleton loading, PAST_DUE banner, cancelAtPeriodEnd banner, pendingTier banner, checkout=success banner, downgrade confirmation modal, 15s post-upgrade polling. Two banner i18n keys missing from both locales; API errors only console.logged (no user-visible error state); hardcoded 'OFF' string and en-CA date in cancellation banner. |
| Pricing page (public plan comparison + FAQ) | Broker | pages/pricing.tsx<br>components/Navbar.tsx |  |  | — | Complete | Medium | Fully translated, redirects unauthenticated users to /signup?role=broker and borrowers to /borrower/dashboard; all outbound links (/for-brokers, /broker/billing, /signup, /borrower/dashboard) exist. Risk: prices ($29/$69/$129) and credit counts (5/20/unlimited) hardcoded in UI in two places (pricing.tsx + billing.tsx) and must manually match Stripe dashboard prices and the basic_tier_credits/pro_tier_credits SystemSettings; no CAD currency label. ADMIN users see broker CTAs (no redirect for ADMIN role). |
| Response credit spend (broker initiates conversation) | Broker | pages/broker/requests/[id].tsx<br>pages/broker/dashboard.tsx | pages/api/conversations/index.ts | Broker, Conversation, Message | Expo push, Supabase realtime | Complete | Low | Atomic decrement via updateMany where responseCredits gt 0 inside a Serializable transaction (conversations/index.ts:294-338); FREE tier blocked (242-244); PREMIUM skips decrement (282, 302); NO_CREDITS mapped to 403 (362-364). Covered by real-DB concurrency tests (tests/concurrency/credits.test.ts) that assert no double-spend and no negative balances. |
| Admin credit adjustment | Admin | pages/admin/brokers/[id].tsx<br>pages/admin/users/[id].tsx | pages/api/admin/credits.ts | Broker, AdminAction | — | Partial | Medium | Audited via AdminAction, ±10000 cap, non-zero integer validation. Negative-balance guard is read-then-write outside the transaction (credits.ts:23-36 vs 40-49) so concurrent spend can push balance negative; audit previousBalance can be stale. Grants are silently wiped at the broker's next renewal because webhooks overwrite responseCredits. |
| Payment failure / dunning handling | Broker | pages/broker/billing.tsx | pages/api/webhooks/stripe.ts | Subscription, Broker | Stripe | Partial | High | invoice.payment_failed sets PAST_DUE and resets credits to free-tier amount in one transaction (webhook.ts:303-330); successful retry restores via invoice.paid. Hole: subscriptionTier is NOT reset, so PAST_DUE PREMIUM brokers bypass the credit system entirely and keep unlimited conversation creation. Existing conversations are never restricted on lapse for any tier. |
| Free tier behavior | Broker | pages/pricing.tsx<br>pages/broker/billing.tsx<br>pages/broker/dashboard.tsx | pages/api/conversations/index.ts<br>lib/settings.ts<br>lib/stripe.ts | Broker, SystemSetting | — | Complete | Low | free_tier_credits defaults to 0 (settings.ts:10); FREE brokers are hard-blocked from creating conversations regardless of credits (conversations/index.ts:242-244), consistent with pricing copy ('val_none'). No free trial exists despite the stale key name pricing.startFreeTrial (text now says 'Create Broker Account' in both locales — consistent). |
| Admin auth, role enforcement, CSRF and rate limiting (withAdmin + adminSSR) | Admin | lib/admin/ssrAuth.ts<br>components/admin/AdminShell.tsx | lib/admin/withAdmin.ts<br>lib/origin.ts<br>lib/rate-limit.ts | User | @vercel/kv | Complete | Low | All 19 files under pages/api/admin/** wrap handlers in withAdmin (verified via grep -L: zero misses). Mutations gated by isAllowedOrigin (Origin/Referer allowlist from NEXTAUTH_URL + ADDITIONAL_ALLOWED_ORIGINS) and 30/min per-admin KV rate limit; sensitive GETs (users/[id], conversations/[id]) opt into 600/min budget. adminSSR redirects non-admins to /login. |
| Inbox unified moderation queue (approve/reject requests, brokers, reports) | Admin | pages/admin/inbox.tsx<br>lib/admin/inboxQueue.ts<br>lib/admin/AdminDataContext.tsx<br>+1 more | pages/api/admin/queue.ts<br>pages/api/admin/requests/[id].ts<br>pages/api/admin/brokers/[id].ts<br>+1 more | BorrowerRequest, Broker, Report, AdminAction | — | Partial | Medium | Works end-to-end, but the detail drawer renders hardcoded fake 'automated checks' (inbox.tsx:522-559), rejections never collect a reason from this surface, the two-admin 202 response is shown as success, and an UndoToast unmount (page nav) silently drops the pending decision. Export button is a disabled stub. |
| Borrower request approval / rejection / close / delete | Admin | pages/admin/activity.tsx<br>pages/admin/inbox.tsx<br>components/admin/RequestDetails.tsx | pages/api/admin/requests/[id].ts<br>pages/api/admin/requests/index.ts | BorrowerRequest, Conversation, Message, AdminAction | Supabase (realtime notify) | Partial | Medium | Status changes, rejectionReason storage, CLOSED cascade (system message + close conversations + realtime nudge), and audit logging all work. Gaps: rejection reason is optional everywhere and never collected from inbox; borrower receives NO email/notice/push on approval or rejection; no status-transition guard; DELETE endpoint has no UI caller. |
| Broker verification (incl. BROKER_VERIFY_REQUIRES_TWO_ADMINS) | Admin | pages/admin/brokers/[id].tsx<br>pages/admin/inbox.tsx | pages/api/admin/brokers/[id].ts<br>pages/api/admin/brokers/index.ts | Broker, AdminAction | — | Partial | Medium | VERIFIED/REJECTED/PENDING transitions audited. Two-admin gate exists behind env flag but: recommendations never expire or get consumed (one old RECOMMEND row satisfies the gate forever), the 202 PENDING_SECOND_REVIEW response is rendered as a success toast by both UIs, audit rows here skip IP/UA meta, reason is unvalidated, and brokers are never notified of the outcome. |
| User management: list, detail, suspend/ban/reactivate, bulk actions | Admin | pages/admin/people.tsx<br>pages/admin/users/[id].tsx<br>components/admin/CommandPalette.tsx | pages/api/admin/users/index.ts<br>pages/api/admin/users/[id].ts<br>pages/api/admin/users/bulk.ts | User, AdminAction | — | Partial | Medium | Suspend/ban bumps tokenVersion (JWT revoked immediately — verified in lib/auth.ts:312-313), admin/self protections present, bulk endpoint has per-row transactions + bulkActionId. Gaps: no reason ever collected in UI (API supports it); broker users' conversations returned by the API are never rendered; banned borrowers' OPEN requests remain visible/contactable by brokers; 'invite' and CSV buttons are disabled stubs. |
| Credits adjustment | Admin | components/admin/CommandPalette.tsx | pages/api/admin/credits.ts | Broker, AdminAction | — | Broken | Medium | API is sound (non-zero integer, ±10,000 cap, negative-balance guard, audit row with before/after) but NO UI calls it — the command palette 'credits' action navigates to /admin/users/[id] claiming a modal that does not exist. Adjustments are only possible via direct API calls. Audit row lacks IP/UA meta; reason length uncapped; balance check has a minor TOCTOU race. |
| Reports moderation queue | Admin | pages/admin/reports.tsx | pages/api/admin/reports/index.ts<br>pages/api/admin/reports/[id].ts<br>pages/api/admin/reports/summary.ts<br>+1 more | Report, AdminAction | — | Partial | Medium | List/detail/status transitions/notes work; links to targets are correct per tests/admin/reports-link.test.tsx (BROKER → /admin/brokers/:publicId works since that API accepts user publicId). Gaps: detail endpoint's targetDetails lookup never matches publicId-stored targetIds (always null) and the drawer never renders it; notes-only updates produce no audit row; USER target type exists in schema/filters but nothing can create one; no UI to report a conversation; list fetch errors render as empty state. |
| Admin notices to users (send + user-facing dropdown) | Both | components/Navbar.tsx<br>components/admin/CommandPalette.tsx | pages/api/notices.ts | AdminNotice | — | Stub | Medium | Read path complete: /api/notices (withAuth, own rows only) + Navbar bell dropdown polling every 30s + mark-as-read. But NO code path creates AdminNotice rows (grep: only findMany/updateMany/deleteMany) — there is no admin send API or UI; the palette's '관리자 공지 발송' action dead-ends on the user detail page. The dropdown will be empty forever. |
| System settings + maintenance mode | Admin | pages/admin/system.tsx<br>pages/_app.tsx | pages/api/admin/settings.ts<br>pages/api/maintenance.ts<br>lib/settings.ts | SystemSetting, AdminAction | @vercel/kv | Partial | Medium | KV-versioned cross-instance cache invalidation is well built. Gaps: UI renders platform_name/support_email which the API rejects (whole save 400s if touched); broker_initial_message_limit (allowed) and request_retention_days (consumed by purge cron) are not editable anywhere; no per-key type validation server-side (non-integer values make getSettingInt throw later in crons/webhooks); maintenance mode is enforced client-side only in _app.tsx — every API keeps working and content flashes before the check. |
| Audit log (write + viewer) | Admin | pages/admin/system.tsx | lib/admin/audit.ts<br>pages/api/admin/actions.ts | AdminAction | — | Partial | Low | buildAdminActionCreate folds IP/UA into details and is used by requests/users/bulk/conversations/reports/create handlers; brokers, credits, and settings handlers build audit rows manually WITHOUT meta. Viewer shows only latest 25, HH:MM-only timestamps (no date), raw JSON details, no pagination/filter UI although the API supports both. |
| Stats dashboard badges + 30-day trends | Admin | lib/admin/AdminDataContext.tsx<br>pages/admin/system.tsx<br>components/admin/primitives/ASpark.tsx | pages/api/admin/stats.ts<br>pages/api/admin/trends.ts | User, BorrowerRequest, Conversation, Broker, Report | @vercel/kv | Partial | Low | Counts are correct (groupBy + parallel counts; raw SQL column names verified unmapped). Two issues: stats KV cache (60s) is not busted by AdminDataContext.invalidate() so rail badges lag the inbox queue after mutations; trends sets 's-maxage=300' (shared-cache directive) on an auth-gated endpoint — on Vercel's edge this may serve cached admin data without auth (needs dashboard verification). |
| Conversation oversight (view thread, paginate, admin close) | Admin | pages/admin/conversations/[id].tsx<br>pages/admin/activity.tsx | pages/api/admin/conversations/[id].ts<br>pages/api/admin/conversations/index.ts | Conversation, Message, AdminAction | Supabase (realtime notify) | Complete | Low | Cursor pagination, isSystem close message, transaction, audit with meta, realtime nudge, GET rate-limit opt-in all present. Only gap: the system close message body is hardcoded English for a Korean-first user base, and the Activity drawer caps at 50 messages with no load-older control (full page has it). |
| CSV export | Admin | lib/csvExport.ts<br>pages/admin/people.tsx<br>pages/admin/activity.tsx<br>+2 more |  |  | — | Missing | Low | lib/csvExport.ts has zero callers; every '⬇ CSV' / '내보내기' button across admin pages is rendered disabled. No PII export risk today because the feature doesn't function. |
| Command palette (search + quick actions) | Admin | components/admin/CommandPalette.tsx<br>components/admin/AdminShell.tsx | pages/api/admin/users/index.ts | User | — | Partial | Low | Search/nav work with abort-safe debounced fetch. All quick actions (suspend/ban/reactivate/credits/notice) merely navigate to /admin/users/[publicId]; credits and notice claim modals that do not exist there, so those two actions are dead ends. |
| Admin account creation + peer email broadcast | Admin |  | pages/api/admin/users/create.ts<br>lib/email.ts | User, AdminAction | Resend | Partial | Low | Strong controls: typed ack, 12-char min password, 10/min KV limit, audit with meta, per-recipient-resilient notifyAdminsOfNewAdmin broadcast (covered by tests/admin/email-broadcast.test.ts). But no web UI calls it ('+ 초대' button on people.tsx is disabled) — admin creation is curl/mobile-only. |
| User-side report submission (feeds admin queue) | Both | components/ReportButton.tsx<br>pages/broker/requests/[id].tsx<br>pages/borrower/brokers/[requestId].tsx | pages/api/reports.ts | Report | @vercel/kv | Partial | Low | Solid: withAuth, 10/day KV limit, dedupe per (reporter,target), 2000-char cap, enum allowlist excluding USER. Gaps: target existence never validated (orphan reports possible — queue.ts even logs a warning for unresolvable targets); no UI exists to report a CONVERSATION even though API accepts it; fully i18n'd in both locales. |
| i18n infrastructure (next-i18next config, appWithTranslation, serverSideTranslations on all pages incl. adminSSR helper, html lang) | All | next-i18next.config.js<br>next.config.mjs<br>pages/_app.tsx<br>+2 more |  |  | — | Complete | Low | Every page either calls serverSideTranslations directly (sst found in all 32 non-redirect pages) or via adminSSR (lib/admin/ssrAuth.ts:38). borrower/index.tsx and broker/index.tsx are pure redirects. _document.tsx:26 sets <Html lang={locale}>. |
| EN/KO message catalogs (common.json) | All | public/locales/en/common.json<br>public/locales/ko/common.json |  |  | — | Partial | High | 1,819 keys each, 0 keys missing between locales. But 343 keys statically referenced in code are absent from both catalogs (266 admin.*, 77 user-facing); UI relies on inline fallback literals so those strings are single-language. consultation.step1/2/3 contain Korean text in the EN catalog. request.product.commLoc is English in the KO catalog. |
| Locale switching and persistence | All | components/Navbar.tsx<br>pages/login.tsx<br>pages/signup.tsx<br>+2 more | pages/api/stripe/create-checkout.ts<br>pages/api/stripe/create-portal.ts<br>pages/api/auth/forgot-password.ts | User | NextAuth (Google/Apple OAuth), Stripe | Partial | Medium | Navbar toggle works (Navbar.tsx:110-112) and client-side navigation preserves locale, but no NEXT_LOCALE cookie is ever set and localeDetection:false, so the EN choice is lost on any fresh visit. OAuth callbackUrls, signOut callbackUrls, Stripe success/cancel/return URLs, and password-reset email links all omit the /en prefix. |
| Transactional email localization (verification code, password reset) | Both | pages/signup.tsx<br>pages/verify-email.tsx<br>pages/forgot-password.tsx | lib/email.ts<br>pages/api/auth/signup.ts<br>pages/api/auth/resend-code.ts<br>+1 more | User | Resend | Partial | Medium | Verification emails respect client-passed locale (signup.tsx:81, verify-email.tsx:103). Password-reset emails read user.preferences.locale (forgot-password.ts:66) which NO code path ever writes — EN users always receive Korean reset emails. notifyAdminsOfNewAdmin is English-only (acceptable, internal). |
| Push notification localization | Both |  | lib/push.ts | DeviceToken | Expo Push | Complete | Low | All templates carry en+ko variants; delivery picks per-device DeviceToken.locale (lib/push.ts:57, schema default ko). Privacy-safe generic bodies. One acknowledged future TODO at lib/push.ts:116. |
| In-chat system message localization | Both | pages/borrower/messages.tsx<br>pages/broker/messages.tsx | pages/api/requests/[id].ts<br>pages/api/admin/requests/[id].ts<br>pages/api/admin/conversations/[id].ts<br>+1 more | Message, Conversation | Supabase Realtime | Partial | Medium | Three inconsistent strategies: borrower close writes a bilingual concatenated string (requests/[id].ts:124), admin closes write English-only strings (admin/requests/[id].ts:110, admin/conversations/[id].ts:118), and the auto-close cron writes no message at all. Messages are stored as final strings in the DB so the renderer cannot localize them per viewer. |
| API error / validation message localization | Both | pages/reset-password.tsx<br>pages/forgot-password.tsx<br>pages/borrower/profile.tsx<br>+5 more | lib/validate.ts<br>pages/api/messages/index.ts |  | — | Missing | Medium | All ValidationError messages are English developer-style strings ("field must be at most N characters"); 8 user-facing pages surface err.message/data.error verbatim before falling back to a translated generic. |
| Enum label localization (status, product types, income types, timelines) | All | components/StatusBadge.tsx<br>lib/requestConfig.ts<br>components/RequestForm.tsx |  |  | — | Complete | Low | All statusLabel.*, request.product.*, request.incomeTypes.*, request.timeline* keys verified present in both catalogs. Exception: province names render raw English constants (RequestForm.tsx:13-27,546) in both locales — likely acceptable for Canadian addresses but untranslated; request.product.commLoc untranslated in ko. |
| Date/number/currency localization | All | pages/broker/billing.tsx<br>pages/broker/messages.tsx<br>pages/borrower/messages.tsx<br>+7 more |  |  | — | Partial | Medium | Split-brain: dashboards and invoice dates switch ko-KR/en-CA correctly, but 7 sites hardcode en-CA so Korean users see English month names. billing.tsx mixes both on one page (line 389 hardcoded vs 410 locale-aware). Relative-time helper duplicated inline in 4 pages. |
| SEO/meta localization (titles, descriptions, hreflang, og:locale) | All | components/SEO.tsx<br>pages/index.tsx<br>pages/pricing.tsx<br>+6 more |  |  | — | Complete | Low | All SEO usages pass t() keys; SEO.tsx emits correct per-locale canonical, hreflang pairs, x-default, and og:locale ko_KR/en_CA. |
| Admin console localization | Admin | pages/admin/inbox.tsx<br>pages/admin/reports.tsx<br>pages/admin/activity.tsx<br>+10 more |  |  | — | Partial | Low | Effectively Korean-only: 266 admin.* keys referenced but absent from catalogs (Korean fallbacks), plus dozens of raw hardcoded Korean strings outside t() entirely (inbox.tsx:45-47,391,484-489,507-543,601-631; reports.tsx:295,353-357,375; system.tsx:40-43; people.tsx:549-550; UndoToast.tsx:72; ADrawerError.tsx:20,28). Acceptable if admins are Korean-speaking by policy, but the EN locale toggle produces a mixed-language admin UI. |
| Email verification code (signup + resend) | Both | pages/signup.tsx<br>pages/verify-email.tsx | lib/email.ts<br>pages/api/auth/signup.ts<br>pages/api/auth/resend-code.ts | User | Resend | Complete | Low | Bilingual (ko/en) inline HTML, locale passed from client (router.locale). Failure handling: signup catches and returns emailSent:false (signup.ts:101-108); resend-code returns 502 on send failure (resend-code.ts:73-78). 60s per-user resend cooldown + IP rate limit. No retry queue. |
| Password reset email | All | pages/forgot-password.tsx<br>pages/reset-password.tsx | lib/email.ts<br>pages/api/auth/forgot-password.ts | User | Resend | Partial | Medium | Works, but locale is read from User.preferences.locale (forgot-password.ts:66) which the web app never writes — English-locale web users get a Korean email. Fire-and-forget send with constant-time response padding (anti-enumeration). |
| Admin new-admin broadcast email | Admin |  | lib/email.ts<br>pages/api/admin/users/create.ts | User, AdminAction | Resend | Complete | Low | Fan-out one send per admin via Promise.allSettled; failures don't abort batch or block creation (create.ts:107-125). HTML-escaped. English-only (acceptable, admin-facing). Tested in tests/admin/email-broadcast.test.ts. |
| Expo push for chat events (new message, borrower inquiry, broker intro) | Both |  | lib/push.ts<br>pages/api/messages/index.ts<br>pages/api/conversations/index.ts | DeviceToken, Conversation, Message | Expo Push | Partial | Medium | Per-device locale (en/ko), pushEnabled + mutedUntil respected, content-free body for privacy. Gaps: Expo receipts never fetched (only tickets checked), ticket-to-message index misalignment when a chunk errors, fire-and-forget after response on Vercel, English-only fallback names interpolated into ko bodies. |
| Device token registration / unregistration API | Both |  | pages/api/notifications/register-device.ts | DeviceToken | Expo Push | Complete | Low | withAuth-gated, Expo token format validated, platform allowlist, token-hijack guard returns 409 if token belongs to another user, DELETE scoped to owner. No caller in this repo (mobile app is external) so mobile contract is unverifiable here. Re-registration forcibly sets pushEnabled:true (line 59). |
| In-app notices (AdminNotice bell) | Both | components/Navbar.tsx | pages/api/notices.ts | AdminNotice | — | Stub | Medium | Read path complete (GET capped at 50, PUT mark-read scoped to owner, Navbar bell + unread badge + 30s polling). Write path does not exist: the only adminNotice.create in the repo is prisma/seed.ts:438. dedupeKey column (schema.prisma:340) is never used. Bell is permanently empty in production. |
| Notification preferences / mute | All |  | pages/api/preferences.ts<br>lib/push.ts<br>lib/email.ts | User, DeviceToken | — | Stub | Medium | PUT /api/preferences validates and stores emailNotifications/pushNotifications booleans (preferences.ts:23-28) but nothing ever reads them — lib/push.ts filters only on DeviceToken.pushEnabled/mutedUntil and lib/email.ts checks nothing. No endpoint sets pushEnabled=false or mutedUntil, and no web UI calls /api/preferences. Opt-out is effectively impossible except deleting the device token. |
| Lifecycle event notifications (request approved/rejected/expired, broker verified, payment failed, new lead, auto-close) | Both |  | pages/api/admin/requests/[id].ts<br>pages/api/admin/brokers/[id].ts<br>pages/api/webhooks/stripe.ts<br>+2 more | BorrowerRequest, Broker, Subscription, Conversation | Resend, Expo Push | Missing | High | None of these events sends any email, push, or AdminNotice. Users discover state changes only by visiting their dashboards. PostHog analytics events fire on subscription changes but nothing user-facing. |
| Homepage (hero, live activity summary card, marquee, ISR) | All | pages/index.tsx<br>components/LiveActivityMarquee.tsx<br>components/LiveActivityCard.tsx | pages/index.tsx (getStaticProps, prisma query) | BorrowerRequest | — | Complete | Medium | Marquee/summary card use REAL BorrowerRequest rows (status OPEN/IN_PROGRESS, id sha256-hashed, take 20, revalidate 300s) — not fabricated. Risk comes from static '500+/50+/95%' stats rendered inside the LIVE card (see findings) and hardcoded 'LIVE · N OPEN' / 'Disclaimer:' strings. |
| Pricing page | Broker | pages/pricing.tsx | lib/stripe.ts<br>lib/settings.ts<br>pages/api/conversations/index.ts | Subscription, Broker, SystemSetting | Stripe | Partial | High | Credit counts (5/20/unlimited) match lib/settings.ts DEFAULTS and lib/stripe.ts getCreditsForTier. But PRO 'New request notifications' and PREMIUM 'Real-time message alerts' have no backend implementation; page is auth-gated (logged-out → /signup?role=broker) yet listed in sitemap; static HTML prerenders as null (no meta). Dollar prices hardcoded in frontend; actual Stripe amounts live in dashboard price IDs (STRIPE_PRICE_BASIC/PRO/PREMIUM). |
| How It Works page (incl. #faq anchor) | All | pages/how-it-works.tsx |  |  | — | Complete | Low | All keys present in ko+en; #faq anchor target exists (line 131); CTA /borrower/request/new resolves (auth-gated via BorrowerShell). |
| For Borrowers page | Borrower | pages/for-borrowers.tsx |  |  | — | Complete | Low | Stats row values/labels diverge between ko and en (statAnonymousValue '0%' ko vs '0' en; statFree/statNoCost labels mean different things per locale) — see i18nGaps. |
| For Brokers page | Broker | pages/for-brokers.tsx |  |  | — | Complete | Low | All links resolve (/signup?role=broker, /broker/dashboard). |
| Contact page | All | pages/contact.tsx |  |  | — | Complete | Low | No contact form and no /api/contact endpoint — mailto:support@mortly.ca only, plus link to /how-it-works#faq (valid). Acceptable but record as product gap. |
| Terms of Service page | All | pages/terms.tsx | lib/legal.ts | User (preferences JSON) | — | Complete | Low | 18 sections fully translated in ko+en incl. Privacy & Data Protection, Governing Law; 'Last Updated: April 6, 2026' matches CURRENT_LEGAL_VERSION '2026-04-06'. |
| Privacy / Trust page (PIPEDA disclosure) | All | pages/privacy.tsx | lib/legal.ts |  | Stripe, Google, Resend, Supabase, PostHog, Vercel Analytics | Partial | Medium | Bilingual, discloses data categories, all 5 service providers, access/correction/deletion via support email, generic retention language. Missing: effective/last-updated date (terms has one), specific 180-day retention disclosure (settings request_retention_days), disclosure that anonymized request data appears on the public homepage, OPC complaint avenue. |
| Legal consent versioning at signup (credentials + OAuth) | Both | pages/signup.tsx | lib/legal.ts<br>pages/api/auth/signup.ts<br>pages/api/auth/[...nextauth].ts<br>+1 more | User | — | Complete | Low | signup.ts rejects when legalVersion !== CURRENT_LEGAL_VERSION (line 55) and stores createLegalAcceptanceMetadata() in preferences (line 89); OAuth path reads LEGAL_ACCEPTANCE_COOKIE in [...nextauth].ts lines 53-58 and passes to createAuthOptions. Unit + integration tests exist (tests/unit/lib/legal.test.ts, tests/integration/api/auth/signup.test.ts). |
| 404/500 error pages | All | pages/404.tsx<br>pages/500.tsx |  |  | — | Complete | Low | Localized via getStaticProps. 404 links / and /borrower/request/new (auth-gated; logged-out users bounce to /login without return URL). |
| Global layout / Navbar / Footer (notices badge, unread badge, locale switcher, logout modal) | All | components/Layout.tsx<br>components/Navbar.tsx<br>components/Footer.tsx<br>+1 more | pages/api/notices.ts<br>pages/api/messages/unread.ts<br>lib/getDashboardPath.ts | AdminNotice, Conversation, Message | — | Complete | Low | All nav/footer hrefs resolve to real pages (verified against pages/ tree; /admin redirects to /admin/inbox via next.config.mjs:39). API contracts match (GET /api/notices → array; PUT {id} → {ok}; GET /api/messages/unread → {unread}). 30s polling for notices/unread. |
| SEO infrastructure (SEO component, sitemap, robots.txt, hreflang, JSON-LD) | All | components/SEO.tsx<br>next-sitemap.config.js<br>public/robots.txt<br>+2 more |  |  | — | Broken | High | Per-page localized titles/descriptions and canonical/hreflang in <head> work. Broken: default og:image 404s on every page; generated sitemap includes /en-prefixed auth-only routes and emits /en/en/* hreflang alternates; robots.txt doesn't block /en/ variants of private routes; WebSite SearchAction JSON-LD malformed. |
| PWA (manifest + service worker) | All | public/manifest.json<br>public/sw.js<br>pages/_app.tsx (useServiceWorker)<br>+1 more |  |  | — | Partial | Low | Network-first fetch, API routes bypassed. CACHE_NAME 'mortly-v1' never versioned; '/' precached only at first install and never refreshed — offline fallback can serve arbitrarily stale homepage HTML. Manifest English-only. |
| Analytics (PostHog client+server, Vercel Analytics) + consent | All | instrumentation-client.ts<br>pages/_app.tsx | lib/posthog-server.ts<br>next.config.mjs (/ingest rewrites) |  | PostHog, Vercel Analytics | Partial | Medium | PostHog init unconditional with non-null-asserted NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN, capture_exceptions:true, reverse-proxied via /ingest. No consent banner/opt-out component exists anywhere (grep over components/ and pages/). Privacy page does disclose PostHog+Vercel Analytics. |
| Maintenance mode gate | All | pages/_app.tsx (MaintenanceGate) | pages/api/maintenance.ts<br>lib/settings.ts | SystemSetting | Vercel KV | Complete | Low | Admins/auth routes/API bypass; content flashes before the async check resolves; fetch failure fails open silently. |
| Security headers / CSP / redirects (next.config.mjs) | All | next.config.mjs |  |  | Stripe, PostHog, Supabase | Complete | Low | HSTS (2y, preload), X-Frame-Options DENY, frame-ancestors 'none', nosniff, Referrer-Policy, COOP, Permissions-Policy, CSP with documented 'unsafe-inline'/'unsafe-eval' in script-src (known weakness, commented as future hardening). Legacy-route redirects all target existing pages. |
| CI pipeline (.github/workflows/test.yml) + Playwright config | Admin | playwright.config.ts | .github/workflows/test.yml<br>package.json |  | GitHub Actions | Partial | Medium | PRs run Vitest (unit+integration+component, coverage artifact). E2E runs only on main pushes or PRs labeled 'run-e2e' (chromium only, workers:1). No lint, no tsc --noEmit, no production build step in CI; tsc passes clean today (verified locally, exit 0). |
| Database schema + migrations pipeline | All |  | prisma/schema.prisma<br>prisma/migrations/20260413074337_remove_introductions/migration.sql<br>prisma/migrations/20260501000000_security_hardening_phase_2/migration.sql<br>+2 more | User, UserBlock, DeviceToken, BorrowerRequest, Broker, BrokerRequestSeen, Conversation, Message, ProcessedStripeEvent, Subscription, Report, AdminNotice, AdminAction, SystemSetting | PostgreSQL | Broken | High | Every model/index/enum matches migrations EXCEPT User.appleId (+ its unique index): present in schema.prisma:17, absent from all 9 migrations. prisma migrate deploy on a fresh DB omits the column; Apple OAuth queries then fail at runtime. |
| Seed tooling (mock/empty/clean modes) | Admin |  | prisma/seed.ts | User, Broker, BorrowerRequest, Conversation, Message, Report, AdminAction, AdminNotice, SystemSetting | — | Complete | Low | Prod guard (NODE_ENV=production refuses unless ALLOW_PROD_SEED=1). clearAll misses ProcessedStripeEvent. Production code never depends on seeded rows (settings have code DEFAULTS), but seeded credit values (3/15/40) contradict code DEFAULTS (0/5/20). |
| Public ID generation (users/requests/conversations) | All |  | lib/publicId.ts | User, BorrowerRequest, Conversation | — | Complete | Low | crypto.randomInt CSPRNG, 9-digit (≈29.7 bits), 10-retry collision loop against unique index. Not guessable in practice; all publicId lookups sit behind auth/ownership checks. |
| System settings service (cached, KV cross-instance invalidation) | Admin | pages/admin/system.tsx | lib/settings.ts<br>pages/api/admin/settings.ts | SystemSetting | @vercel/kv | Partial | Medium | Cache + version-bump design is solid. But PUT accepts any string ≤500 (empty/non-numeric values later make getSettingInt throw inside Stripe webhook and crons); request_retention_days is not in ALLOWED_KEYS so the PIPEDA window is not admin-adjustable; GET returns only DB rows so effective code DEFAULTS are invisible in the UI. |
| Cron: expire-requests (daily 0:00) | Both |  | pages/api/cron/expire-requests.ts<br>lib/cron.ts<br>vercel.json | BorrowerRequest | Vercel Cron | Partial | Medium | Expires OPEN + PENDING_APPROVAL after request_expiry_days (default 30) from createdAt. Does NOT close attached conversations, does NOT notify the borrower (no email/push/notice), and expires requests that have active paid broker conversations because nothing flips them to IN_PROGRESS. |
| Cron: auto-close-conversations (daily 12:00) | Both |  | pages/api/cron/auto-close-conversations.ts | Conversation, BorrowerRequest, Message | Vercel Cron | Partial | Medium | Closes after 72h inactivity or 7d without borrower reply. Engagement filter excludes senderId="SYSTEM" (no such user exists; should filter isSystem) and reads take:10 messages with no orderBy; no system message or notification is written into auto-closed threads; request cascade only fires for IN_PROGRESS, which nothing sets automatically. |
| Cron: purge-expired PII retention (daily 1:30) | Both |  | pages/api/cron/purge-expired.ts | BorrowerRequest, Conversation, Message | Vercel Cron | Complete | Medium | Anonymizes details/notes + redacts non-system message bodies for EXPIRED/CLOSED/REJECTED requests older than request_retention_days (180). Idempotent and batched. Zero test coverage; privacy policy text never states the 180-day schedule; province/city/desiredTimeline/rejectionReason are retained. |
| Cron authentication (CRON_SECRET + x-vercel-cron) | All |  | lib/cron.ts |  | Vercel Cron | Complete | Low | Constant-time Bearer compare AND (x-vercel-cron header OR ALLOW_NONVERCEL_CRON=1). Correct, with tests. Depends on CRON_SECRET being set in Vercel env and the platform stripping inbound x-vercel-* headers — both unverifiable from code. |
| Account deletion data cascade (DELETE /api/users/me) | Both | components/DeleteAccountSection.tsx | pages/api/users/me.ts | User, Message, Conversation, BorrowerRequest, BrokerRequestSeen, Report, Subscription, Broker, AdminNotice, DeviceToken, UserBlock | — | Complete | Medium | Delete order correctly satisfies every RESTRICT FK (messages→conversations→requests→broker→user); UserBlock/DeviceToken cascade. Gap: Report rows targeting the deleted user/conversation/request remain orphaned (targetId is not an FK). No integration test. |
| Admin notices (bell inbox) | All | components/Navbar.tsx<br>components/admin/CommandPalette.tsx | pages/api/notices.ts | AdminNotice | — | Partial | Medium | Read + mark-read works (Navbar). But NO code path anywhere creates an AdminNotice (only seed mock data); the dedupeKey idempotency column from migration 20260501010000 is dead; CommandPalette advertises a 'send notice' quick action that routes to a detail page with no composer. |
| Admin credit adjustment | Admin | components/admin/CommandPalette.tsx<br>pages/admin/users/[id].tsx | pages/api/admin/credits.ts | Broker, AdminAction | — | Broken | Medium | POST /api/admin/credits is implemented and audited but has ZERO frontend consumers; CommandPalette's 'credit adjust' action routes to /admin/users/[id], which only displays the balance. Negative-balance guard is read-then-write outside the transaction (race). |
| Maintenance mode | All | pages/_app.tsx<br>pages/admin/system.tsx | pages/api/maintenance.ts<br>lib/settings.ts | SystemSetting | — | Partial | Low | Client-side overlay only; APIs deliberately stay open (comment in _app.tsx:93). Fetch failure silently disables maintenance display (fail-open). |
| User preferences API (locale/theme/notification toggles) | Both |  | pages/api/preferences.ts | User | — | Complete | Low | Zero web consumers — presumably used by the Expo mobile app (not in this repo; verify). Error shape uses {message} instead of the platform-wide {error} key. |
| CSV export helper | Admin | lib/csvExport.ts |  |  | — | Stub | Low | downloadCSV is implemented (BOM + escaping, browser-only) but imported by nothing. Dead file. |
| Request product/timeline config + validation | Both | components/RequestForm.tsx<br>pages/borrower/dashboard.tsx<br>pages/broker/dashboard.tsx<br>+2 more | lib/requestConfig.ts<br>lib/validate.ts | BorrowerRequest | — | Complete | Low | validateProductTypes/category mapping fine. getRequestTitle returns hardcoded English shown on the ko-default UI; assertBoundedJson measures UTF-16 chars while claiming bytes (Korean payloads pass at up to ~3x the stated byte cap — harmless for JSONB, misleading name). |
| Public marketing pages (home, how-it-works, for-borrowers, for-brokers, contact, privacy, terms) | All | pages/index.tsx<br>pages/how-it-works.tsx<br>pages/for-borrowers.tsx<br>+8 more | pages/api/maintenance.ts | BorrowerRequest | Vercel ISR | Complete | Low | SSG + serverSideTranslations everywhere; live-request widget degrades gracefully when DB unreachable. Minor hardcoded strings (Disclaimer:, LIVE · n OPEN). |
| Auth flows (login, signup, verify-email, forgot/reset password, select-role) | All | pages/login.tsx<br>pages/signup.tsx<br>pages/verify-email.tsx<br>+3 more | pages/api/auth/[...nextauth].ts<br>lib/auth.ts<br>pages/api/auth/signup.ts<br>+5 more | User | Google OAuth, Resend, @vercel/kv | Partial | Medium | Solid pending states and rate-limit handling, but raw English authorize() errors shown verbatim, resend-code reports failure as success on non-429 errors, reset-password flashes Invalid Link before router.query hydrates, and Apple sign-in (claimed in product spec) is absent from web login/signup. |
| Borrower dashboard | Borrower | pages/borrower/dashboard.tsx<br>components/borrower/BorrowerShell.tsx<br>components/borrower/BorrowerDataContext.tsx | pages/api/requests/index.ts<br>pages/api/conversations/index.ts<br>pages/api/messages/unread.ts<br>+1 more | BorrowerRequest, Conversation, Message, User | — | Partial | Medium | Error banner is dead code (error hardcoded null); context swallows fetch failures so API outages render the 'no requests' empty state. Most UI strings rely on missing i18n keys (fallbacks shown in both locales). |
| Borrower request create/edit/delete | Borrower | pages/borrower/request/new.tsx<br>pages/borrower/request/[id].tsx<br>components/RequestForm.tsx<br>+1 more | pages/api/requests/index.ts<br>pages/api/requests/[id].ts | BorrowerRequest | PostHog | Complete | Medium | Excellent draft persistence (sessionStorage), step validation, double-submit guards. Detail page shows infinite skeleton on fetch error; beforeunload warns even on pristine forms. |
| Borrower broker comparison | Borrower | pages/borrower/brokers/[requestId].tsx<br>components/ReportButton.tsx | pages/api/requests/[id].ts | Conversation, Broker | — | Complete | Low | Loading/error/empty all handled; sort chips have 44px touch targets. |
| Borrower chat | Borrower | pages/borrower/messages.tsx<br>components/broker/RequestContextPanel.tsx<br>components/broker/MessagesSkeletons.tsx<br>+1 more | pages/api/conversations/index.ts<br>pages/api/conversations/[id].ts<br>pages/api/messages/index.ts | Conversation, Message | Supabase Realtime (content-free sync nudge), 5s poll fallback | Complete | Medium | Good mobile list/chat toggle, optimistic send with rollback, unread rollback on failure. Dates/times hardcoded en-CA; 5s poll merges messages but not status changes (closed state delayed without Realtime). |
| Borrower profile + account deletion | Borrower | pages/borrower/profile.tsx<br>components/DeleteAccountSection.tsx | pages/api/borrowers/profile.ts<br>pages/api/users/me.ts | User | — | Complete | Low | Two-step delete confirm + password re-auth path. Member-since date hardcoded en-CA. |
| Broker dashboard | Broker | pages/broker/dashboard.tsx<br>components/broker/BrokerShell.tsx<br>components/broker/BrokerDataContext.tsx<br>+1 more | pages/api/brokers/profile.ts<br>pages/api/requests/index.ts<br>pages/api/conversations/index.ts<br>+1 more | Broker, BorrowerRequest, Conversation | — | Partial | Medium | Priority action banner system is well designed; but most strings are missing i18n keys, sidebar shows '<TIER> · PRO' for all tiers, and context fetch failures silently keep stale/empty data. |
| Broker browse requests | Broker | pages/broker/requests/index.tsx | pages/api/requests/index.ts<br>pages/api/brokers/mark-requests-seen.ts | BorrowerRequest, BrokerRequestSeen | — | Complete | Low | Best page in the sweep: explicit NOT_VERIFIED state, LOAD_FAILED banner, skeletons matched to layout, separate desktop table + mobile card stack. Province filter omits the 3 territories that borrowers can submit. |
| Broker request detail + respond (credit spend) | Broker | pages/broker/requests/[id].tsx<br>components/broker/RequestDetailBlocks.tsx | pages/api/requests/[id].ts<br>pages/api/conversations/index.ts<br>pages/api/brokers/requests/[id]/mark-seen.ts | BorrowerRequest, Conversation, Broker | PostHog | Partial | High | FREE-tier brokers see the normal respond CTA ('1 credit will be used. 0 remaining.') but the API blocks them with an untranslated English 403. Error/loading/already-responded states otherwise complete. |
| Broker chat | Broker | pages/broker/messages.tsx<br>components/broker/RequestContextPanel.tsx<br>components/ChatDisclaimer.tsx | pages/api/conversations/[id].ts<br>pages/api/messages/index.ts | Conversation, Message | Supabase Realtime, 5s poll fallback | Complete | Medium | Hardcoded 'No messages yet', 'Dismiss', English 'in', raw status enum badge; no close-conversation control (borrower-only by design?). |
| Broker billing / subscriptions | Broker | pages/broker/billing.tsx<br>pages/pricing.tsx | pages/api/stripe/create-checkout.ts<br>pages/api/stripe/create-portal.ts<br>pages/api/stripe/invoices.ts<br>+1 more | Subscription, Broker, ProcessedStripeEvent | Stripe | Partial | High | Webhook-propagation polling after upgrade is thoughtful, but checkout/portal failures are console-only (no user feedback), invoice fetch failure renders the 'no billing history' empty state, and '41% OFF' badge text is hardcoded English. |
| Broker onboarding + profile | Broker | pages/broker/onboarding.tsx<br>pages/broker/profile.tsx | pages/api/brokers/profile.ts | Broker | PostHog | Complete | Low | Phone masking, pending-state messaging, profile-gate banner all work. Province list limited to 10 (no territories). |
| In-app notifications (AdminNotice bell) | Both | components/Navbar.tsx | pages/api/notices.ts | AdminNotice | — | Broken | High | Dropdown renders only inside the desktop-only (hidden md:flex) container; the mobile menu's notifications button toggles state but nothing ever displays — feature unreachable on mobile. Also note the bell only exists in the marketing Navbar, which is not mounted on /borrower/* or /broker/* shell pages, so logged-in users rarely see it at all. |
| Admin inbox (approve/reject queue) | Admin | pages/admin/inbox.tsx<br>components/admin/AdminShell.tsx<br>lib/admin/AdminDataContext.tsx<br>+2 more | pages/api/admin/queue.ts<br>pages/api/admin/requests/[id].ts<br>pages/api/admin/brokers/[id].ts<br>+2 more | BorrowerRequest, Broker, Report, AdminAction | — | Partial | High | Undo-toast commit pattern and keyboard shortcuts are excellent; error banner surfaced via shared context. But the '자동 체크' (automated checks) panel shows hardcoded fake results, and the export button is a permanently disabled stub. Desktop-only fixed 1fr_400px grid. |
| Admin people (user management + bulk actions) | Admin | pages/admin/people.tsx<br>pages/admin/users/[id].tsx | pages/api/admin/users/index.ts<br>pages/api/admin/users/[id].ts<br>pages/api/admin/users/bulk.ts | User, Broker, AdminAction | — | Partial | Medium | SWR error is never destructured/rendered — list failures look like 'no users match'. CSV and Invite buttons are disabled stubs. Bulk flow with partial-failure toast is good. |
| Admin activity feed + drawers | Admin | pages/admin/activity.tsx<br>components/admin/RequestDetails.tsx | pages/api/admin/requests/index.ts<br>pages/api/admin/conversations/index.ts<br>pages/api/admin/conversations/[id].ts<br>+1 more | BorrowerRequest, Conversation, Message | — | Complete | Medium | Drawer error states via useDrawerResource are well handled; list fetch failures fall back to empty data silently. FLAGGED status filter parsed but has no UI chip. |
| Admin reports moderation | Admin | pages/admin/reports.tsx | pages/api/admin/reports/index.ts<br>pages/api/admin/reports/[id].ts<br>pages/api/admin/reports/summary.ts | Report | — | Complete | Medium | List load failure silently shows the 'no reports' empty state; drawer has proper error/retry. |
| Admin system (settings, audit log, trends, manual) | Admin | pages/admin/system.tsx | pages/api/admin/settings.ts<br>pages/api/admin/actions.ts<br>pages/api/admin/trends.ts | SystemSetting, AdminAction | — | Partial | Medium | Manual tab is an explicit placeholder stub; settings/audit fetch failures are silent (blank fields / misleading empty state); audit timestamps show HH:MM only with no date. |
| Admin conversation full-page viewer | Admin | pages/admin/conversations/[id].tsx | pages/api/admin/conversations/[id].ts | Conversation, Message | — | Complete | Low | Marked 'scheduled for deletion in Phase 2' in brokers/[id].tsx comments but still linked from the activity drawer; cursor pagination for older messages works with error toasts. |
| Maintenance mode gate + error boundary + 404/500 | All | pages/_app.tsx<br>pages/404.tsx<br>pages/500.tsx | pages/api/maintenance.ts | SystemSetting | — | Complete | Low | 404/500 are localized, styled, link to existing routes. Maintenance check failure fails open (no gate), which is reasonable. |
| Broker profile photo (Broker.profilePhoto) | Broker | pages/broker/profile.tsx<br>pages/broker/onboarding.tsx<br>components/broker/BrokerDataContext.tsx<br>+1 more | pages/api/brokers/profile.ts<br>lib/validate.ts | Broker | — | Stub | Low | Write path exists (POST/PUT /api/brokers/profile accepts profilePhoto via assertOptionalHttpsUrl, pages/api/brokers/profile.ts:65-68; column at prisma/schema.prisma:136) but no form field on pages/broker/profile.tsx (form state lines 46-56) or pages/broker/onboarding.tsx (lines 35-45), and zero render sites — repo-wide grep finds no <img> except the logo (components/BrandMark.tsx:48-49). Borrower-facing API omits the field (pages/api/requests/[id].ts:32-48). Settable only by hand-crafted API call; value is then invisible to everyone. CreateBrokerProfileInput (types/index.ts:76-86) doesn't even include it. |
| Chat attachments / in-platform document exchange | Both | pages/borrower/messages.tsx<br>pages/broker/messages.tsx | pages/api/messages/index.ts | Message, Conversation | Supabase (Realtime only — no Storage usage anywhere) | Missing | Medium | Message model is body-only (prisma/schema.prisma:201-221, body VarChar(5000)); POST /api/messages accepts only {conversationId, body} (pages/api/messages/index.ts:12-30); composers are plain text inputs (pages/borrower/messages.tsx:776-792, pages/broker/messages.tsx:677-679); bodies render as plain text, not linkified (pages/borrower/messages.tsx:741-743, pages/broker/messages.tsx:633-634). Repo-wide grep: no type="file", multipart, formidable, busboy, or supabase storage.from anywhere. Mortgage document exchange is forced off-platform. |
| Document collection in borrower request flow | Borrower | components/RequestForm.tsx<br>pages/borrower/request/new.tsx | pages/api/requests | BorrowerRequest | — | Missing | Low | Request form collects structured fields + free-text notes only (components/RequestForm.tsx:874-893); no file inputs. Appears intentional — no copy promises document upload. Privacy note about free-text fields exists (request.privacyNote). |
| PII retention / chat redaction (mitigation for typed-in-chat sensitive data) | All |  | pages/api/cron/purge-expired.ts<br>lib/settings.ts<br>lib/cron.ts | BorrowerRequest, Message, Conversation, SystemSetting | Vercel cron | Complete | Medium | purge-expired (pages/api/cron/purge-expired.ts:27-77) nulls financial fields and redacts non-system message bodies for terminal-status requests older than request_retention_days=180 (lib/settings.ts:15). Works as designed for in-platform data, but anything exchanged off-platform (the only way to move documents) is outside its reach. No test coverage (no tests match *purge* in tests/). |
| Legal/marketing copy on document handling | All | pages/privacy.tsx<br>pages/terms.tsx<br>public/locales/en/common.json<br>+1 more |  |  | — | Complete | Low | Verified no false promises: locale-wide regex for document/upload/attachment/paperwork/encrypt/서류/첨부/업로드 matched only the dead broker.introMessageHint key. Terms/privacy acknowledge off-platform identifying-info sharing as user's choice (en common.json:1492 privacy.step3Desc, 1859 terms.s10p2) but never address documents specifically, and no retention period is disclosed. |
| Borrower credentials signup (role pre-lock, legal acceptance, email verification trigger) | Borrower | pages/signup.tsx | pages/api/auth/signup.ts | User | Resend (verification email), PostHog, @vercel/kv (rate limit) | Complete | Low | Rate-limited (5/min/IP), legal version enforced, locale passed to verification email. posthog.identify uses raw email as distinct id (signup.tsx:94). |
| Email verification (6-digit code + resend) | Both | pages/verify-email.tsx | pages/api/auth/verify-email.ts<br>pages/api/auth/resend-code.ts | User | Resend, @vercel/kv | Partial | Medium | Verify path solid (timing-safe compare, attempt caps, enumeration-safe). But the resend handler treats any non-429 response (400/500/502) as success, and the page has no state for a missing ?email= query param. |
| Borrower login + role-based redirect | Both | pages/login.tsx | pages/api/auth/[...nextauth].ts<br>lib/auth.ts | User | NextAuth, @vercel/kv, PostHog | Complete | Low | BORROWER → /borrower/dashboard, email prefilled after verification, brute-force limits present ([...nextauth].ts:13-50). Raw English error prose (suspended/banned/invalid) displayed verbatim in Korean UI (login.tsx:73). |
| OAuth first-run (Google/Apple → select-role) | Both | pages/select-role.tsx | pages/api/auth/select-role.ts<br>lib/auth.ts | User | Google OAuth, Apple OAuth | Partial | Medium | Role selection is one-time-guarded and CSRF-gated. Gap: Apple users created with name null (lib/auth.ts:221) are never prompted for a name on web — session.user.needsNameEntry (lib/auth.ts:333) has no web consumer; only the mobile PATCH /api/users/me flow clears it. |
| Borrower onboarding wizard (equivalent of /broker/onboarding) | Borrower |  |  |  | — | Missing | Low | Intentional zero-onboarding: pages/borrower/onboarding does not exist; api/auth/signup.ts:110 comment scopes onboarding to BROKER only; User model has no phone column (prisma/schema.prisma:11-50) and the request form collects everything brokers need, with chat as the contact channel. Design is coherent — the gaps are in the surrounding funnel, not the absence of a wizard. |
| Borrower first-run dashboard (empty state + CTAs) | Borrower | pages/borrower/dashboard.tsx<br>components/borrower/BorrowerShell.tsx<br>components/borrower/BorrowerDataContext.tsx | pages/api/borrowers/profile.ts<br>pages/api/requests/index.ts<br>pages/api/conversations/index.ts<br>+1 more | User, BorrowerRequest, Conversation, Message | — | Partial | Medium | Empty state and CTA targets are correct for an authenticated borrower. But ~34 i18n keys are missing from both locales (mixed-language UI), error state is hardcoded null (dashboard.tsx:72), context swallows API failures so failures render as the 'No requests yet' empty state, and Btn-as-anchor CTAs drop the /en locale prefix. |
| New request entry point auth gate (/borrower/request/new) | Borrower | pages/borrower/request/new.tsx<br>pages/index.tsx<br>pages/how-it-works.tsx<br>+1 more | pages/api/requests/index.ts | BorrowerRequest | PostHog | Broken | High | Blank page for logged-out and non-borrower visitors (new.tsx:51 returns null without mounting BorrowerShell), and homepage + how-it-works CTAs send logged-out traffic straight into it. for-borrowers.tsx:12 is the only correctly-gated CTA. |
| Borrower profile management (name, password, account deletion) | Borrower | pages/borrower/profile.tsx<br>components/DeleteAccountSection.tsx | pages/api/borrowers/profile.ts<br>pages/api/users/me.ts | User | — | Complete | Low | Only name + password are editable (no phone field exists by design; email locked). Password change bumps tokenVersion. Minor: change-password form shown to OAuth-only accounts that can never succeed; _count.reviews in the page type is never returned by the API; member-since date hardcoded en-CA. |
| User preferences (locale/theme/email+push notification toggles) | All |  | pages/api/preferences.ts | User | — | Stub | Medium | GET/PUT /api/preferences is validated and functional but has zero callers in this repo (web). No UI surfaces locale/theme/notification toggles anywhere (Navbar switchLocale only does router.push, never persists). Because preferences.locale is never written, forgot-password.ts:66 always falls back to 'ko' — password-reset emails are Korean for every web user. Mobile app usage cannot be verified from this repo. |
| Borrower chat (two-pane messages page with mobile pane switching + context drawer) | Borrower | pages/borrower/messages.tsx<br>components/broker/RequestContextPanel.tsx<br>components/broker/MessagesSkeletons.tsx<br>+2 more | pages/api/conversations/index.ts<br>pages/api/conversations/[id].ts<br>pages/api/messages/index.ts | Conversation, Message, Broker, BorrowerRequest, User | Supabase Realtime (content-free sync broadcast), Vercel KV | Partial | Medium | Mobile pane stacking verified correct (messages.tsx:453-457 left panel w-full + hidden md:flex toggle; 569-572 right panel; 607-625 md:hidden back button). Context panel reachable via lg:hidden toggle (676-699) opening fixed drawer (815-835). Gaps: iOS keyboard zoom risk (14px input), error toast unconstrained width, several missing locale keys, dates always en-CA. |
| Broker chat (two-pane messages page with mobile pane switching + context drawer) | Broker | pages/broker/messages.tsx<br>components/broker/RequestContextPanel.tsx<br>components/broker/RequestDetailBlocks.tsx<br>+1 more | pages/api/conversations/index.ts<br>pages/api/conversations/[id].ts<br>pages/api/messages/index.ts | Conversation, Message, Broker, BorrowerRequest | Supabase Realtime | Partial | Medium | Mobile view switching works (messages.tsx:354-357, 473-476, 508-531 back button). Context drawer works (756-776). Defects: conflicting width classes w-80 vs w-full + invalid lg:md:w-96 variant (355-357); list-load errors invisible (error UI only inside active-chat branch 655-666); raw ACTIVE/CLOSED enum chip (561); multiple hardcoded English strings. |
| Request context panel (chat third column / mobile drawer) | Both | components/broker/RequestContextPanel.tsx<br>components/broker/RequestDetailBlocks.tsx | pages/api/conversations/[id].ts | BorrowerRequest, Conversation | — | Partial | Low | Internally scrollable (flex h-full + flex-1 overflow-y-auto at lines 86-91), close button when onClose passed (212-233), single-column detail grid (160). 6 of its locale keys (broker.requestContext, broker.noRequestContext, broker.detailsEyebrow, broker.viewFullRequest, broker.noFullRequestLink, common.close) missing from both common.json files, producing mixed KO/EN copy. |
| Borrower broker-comparison page | Borrower | pages/borrower/brokers/[requestId].tsx<br>components/Skeleton.tsx<br>components/ReportButton.tsx | pages/api/requests/[id].ts | Conversation, Broker, BorrowerRequest | — | Complete | Low | Mobile-safe: single-column card grid (line 160), wrapping sort controls with 44px touch targets (129-149), loading skeleton (96-102), empty (152-158) and error (122-126) states all present. Vestigial empty template interpolation at 167-169. |
| Request form 3-column layout with live summary (mobile collapse) | Borrower | components/borrower/RequestFormLayout.tsx<br>components/RequestForm.tsx<br>pages/borrower/request/new.tsx | pages/api/requests/index.ts | BorrowerRequest | — | Partial | Low | Verified: grid collapses to grid-cols-1 (line 59) and the SAME LiveSummary component renders on all widths (62, 182-199) — mobile shows identical data, just stacked below the form. Step rail collapses to STEP n/total indicator (105-113). Gaps: privacy callout is hidden lg:block (162) so mobile loses it (review step has its own reminder at RequestForm.tsx:893-900); 11 locale keys missing (English/Korean defaults leak cross-locale); summary sits below the submit button in mobile DOM order. |
| Broker billing page (plan cards, subscription banners, invoice history) | Broker | pages/broker/billing.tsx<br>components/Skeleton.tsx | pages/api/stripe/create-checkout.ts<br>pages/api/stripe/create-portal.ts<br>pages/api/stripe/invoices.ts<br>+1 more | Broker, Subscription, ProcessedStripeEvent | Stripe, PostHog | Partial | Medium | Mobile layout OK: plan grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 (451), invoice table wrapped in overflow-x-auto (556), banners stack flex-col sm:flex-row (362,422). Defects: success banner renders raw i18n keys after upgrade (255,290 — keys missing from both locales); checkout/portal failures only console.error with no UI; invoice fetch failure masquerades as empty history; '{discount} OFF' hardcoded; cancel-date always en-CA. |
| Pricing page (broker plan marketing + comparison table + FAQ) | Broker | pages/pricing.tsx<br>components/Layout.tsx |  |  | — | Complete | Low | Mobile-safe: cards grid sm:grid-cols-2 lg:grid-cols-4 (161), comparison table in overflow-x-auto (247). Page is auth-gated: unauthenticated visitors are redirected to /signup?role=broker and borrowers to their dashboard (30-39) — render returns null during loading (45-47) so there is a blank flash. animate-fade-in-up uses 'forwards' fill (tailwind.config line 105) and prefers-reduced-motion shortens duration (globals.css:214-219) so opacity-0 content still becomes visible. |
| Marketing Navbar (locale switcher, unread badge, notices bell, auth buttons, mobile menu) | All | components/Navbar.tsx | pages/api/notices.ts<br>pages/api/messages/unread.ts | AdminNotice, Message | — | Partial | Medium | No horizontal overflow risk found: below md everything collapses behind the hamburger (345-358); at md+ the locale switcher + bell + settings + sign-out icons coexist comfortably inside max-w-7xl (151-342). Defects: mobile notifications button toggles a dropdown that only exists inside the hidden md:flex desktop container (dead, 455-470 vs 184/241); mobile menu renders Dashboard and Messages twice (371-385 then 417-451); menu max-h-[500px] (366) is close to authed-broker content height. |
| Authed app shells with mobile nav drawer (BorrowerShell / BrokerShell) | Both | components/borrower/BorrowerShell.tsx<br>components/broker/BrokerShell.tsx |  |  | — | Complete | Low | h-[100dvh] overflow-hidden app frame (BorrowerShell:126, BrokerShell:151) with md:hidden top bar + hamburger slide-over (143-191 / 170-222); Escape + route-change close handled. Minor: BrokerShell:292 renders '<TIER> · PRO' for every tier (a FREE broker sees 'FREE · PRO'); shells have no notifications bell so AdminNotices are invisible inside the authed app. |
| Borrower dashboard (stats, activity feed, request list, status banners) | BORROWER | pages/borrower/dashboard.tsx<br>components/borrower/BorrowerDataContext.tsx<br>components/borrower/BorrowerShell.tsx<br>+1 more | pages/api/requests/index.ts | BorrowerRequest, Conversation, User | — | Partial | Medium | Works for happy path; no error state (error hardcoded null at dashboard.tsx:72), context swallows fetch failures, list silently capped at 20 by API pagination. |
| Request detail view / edit / delete | BORROWER | pages/borrower/request/[id].tsx<br>components/ConsultationStepper.tsx | pages/api/requests/[id].ts | BorrowerRequest, Conversation, Message | — | Partial | Medium | Ownership enforced server-side (IDOR safe). Edit/delete buttons match API status gates (OPEN/PENDING_APPROVAL) but not the conversations-exist gates (409s surface raw English API errors). Infinite skeleton on load error. |
| Request close/cancel flow | BORROWER |  | pages/api/requests/[id].ts | BorrowerRequest, Conversation, Message | — | Missing | High | PUT /api/requests/[id] {status:CLOSED} fully implemented (closes conversations, posts system message) but zero frontend callers — borrowers cannot close a request from any UI. |
| Broker responses comparison page | BORROWER | pages/borrower/brokers/[requestId].tsx | pages/api/requests/[id].ts | Conversation, Broker, User | — | Complete | Low | Real data, not a stub: lists brokers who started conversations on the request (from request.conversations), with sort by fastest/most-experienced, verified badge, report button, link to messages. It does NOT browse/match all brokers — naming ('brokers') slightly oversells. |
| Borrower profile (name + password change) | BORROWER | pages/borrower/profile.tsx | pages/api/borrowers/profile.ts | User | — | Complete | Low | Password change bumps tokenVersion (good). Name has no server-side max length (users/me PATCH caps at 100). Sidebar name stale until next context poll after rename. |
| Account deletion (PIPEDA / App Store 5.1.1(v)) | BORROWER | components/DeleteAccountSection.tsx | pages/api/users/me.ts | User, BorrowerRequest, Conversation, Message, Report, AdminNotice, DeviceToken, Broker, Subscription, BrokerRequestSeen | — | Complete | Low | True hard delete in a transaction; manual cascade covers all required FKs (no onDelete on most relations) so deletion will not throw. Residuals: Reports targeting the user (targetType USER/REQUEST/CONVERSATION) and AdminAction audit rows remain. |
| User preferences API | BORROWER |  | pages/api/preferences.ts | User | — | Stub | Low | Well-validated GET/PUT (locale/theme/notification booleans, 10KB cap) but no consumer anywhere in pages/components/lib — possibly used only by the mobile app (x-mortly-mobile pattern exists elsewhere). |
| Borrower navigation shell + auth gate | BORROWER | components/borrower/BorrowerShell.tsx<br>pages/borrower/index.tsx |  |  | — | Complete | Low | Client-side-only auth gate (useEffect redirect to /login); all data behind authed APIs so no leak. /borrower index redirects to dashboard. All nav links point to real routes. |


## Frontend/backend mismatch table

| Area | Frontend | Backend | Problem |
|---|---|---|---|
| Login rate-limit 429 response shape | signIn('credentials',{redirect:false}) in pages/login.tsx expects next-auth to parse data.url and surface result.error==='RATE_LIMITED'. | pages/api/auth/[...nextauth].ts:46-49 hand-crafts a 429 body {url:'/login?error=RATE_LIMITED', error:'...'} specifically so next-auth's client parses the error code from data.url. | Functional but tightly coupled to next-auth v4's internal signIn url-parsing behavior; a next-auth upgrade could break the RATE_LIMITED branch. Not covered by any test. |
| Login custom error-code propagation | pages/login.tsx:49-73 branches on result.error === 'EMAIL_NOT_VERIFIED' / 'GOOGLE_ACCOUNT' / 'RATE_LIMITED', else displays result.error verbatim. | lib/auth.ts authorize() throws new Error('EMAIL_NOT_VERIFIED'/'GOOGLE_ACCOUNT'/...) relying on next-auth v4 forwarding the thrown message as the client error code. | Depends on next-auth v4 passing the raw thrown message through to signIn; version-sensitive and untested. If it instead returns 'CredentialsSignin', users would see that raw code as the error text. |
| Signup → verify-email handoff | pages/signup.tsx:86-102 reads only res.ok and redirects to /verify-email unconditionally on 201 | pages/api/auth/signup.ts:112 returns { user, requiresVerification: true, emailSent } where emailSent=false when sendVerificationCode threw (lines 102-108) | The emailSent flag is never consumed — users whose verification email failed to send are redirected to the code-entry screen with no indication that nothing was sent, compounding the resend false-success bug. |
| Resend verification code | pages/verify-email.tsx:100-115 handles only res.status === 429; all other statuses fall through to the success path | pages/api/auth/resend-code.ts returns 400 ('Email is required'), 502 ('Failed to send verification email...'), and 500, each with a message body | Backend error statuses/bodies are silently discarded; frontend reports success ('New code sent.') for failed sends. |
| Verify email code submission | pages/verify-email.tsx:77-85 branches only on data.expired, mapping everything else to auth.invalidCode | pages/api/auth/verify-email.ts:52-54 returns 429 {message:'Too many attempts. Please wait and try again.'}; lines 97-99 return 400 {message:'Too many attempts. Request a new code.', expired:true} | 429 rate-limit responses are presented as 'invalid code' (wrong instruction), and the attempt-exhaustion case is presented as 'code expired'; the status-code/flag contract is only partially honored. |
| Auth API error message contract | pages/forgot-password.tsx:29 and pages/reset-password.tsx:46 display data.message verbatim; pages/verify-email.tsx ignores message entirely and substitutes translation keys | All four handlers return human-readable English message strings rather than machine-readable error codes (only verify-email.ts adds an expired boolean; [...nextauth].ts:46-49 uses a url-embedded RATE_LIMITED code) | No consistent error-code contract: some pages render raw English strings (untranslatable), others guess from status/flags — any backend copy change silently alters user-facing text in one flow and is invisible in another. |
| Request edit | pages/borrower/request/[id].tsx handleEdit PATCHes the FULL CreateRequestInput (every key defined) built by components/RequestForm.tsx | pages/api/requests/[id].ts:177-191 returns 409 unless mortgageCategory/productTypes/province/city/details are all === undefined when the request has any conversation | Every UI edit of a request with conversations fails with 409, even notes-only changes the server explicitly intends to allow; English-only error shown in ko UI |
| desiredTimeline | Required (isStep2Valid, components/RequestForm.tsx:254) and restricted to 5 enum values via <select> (lines 777-789) | pages/api/requests/index.ts:148 — assertOptionalString max 200: optional and any string accepted; TIMELINE_OPTIONS export never used by the API | Server accepts requests with missing or arbitrary timeline that the UI then renders via raw-string fallback |
| notes (residential) | Required for BOTH categories (textarea required + submit disabled unless notes.trim(), components/RequestForm.tsx:885,909) | pages/api/requests/index.ts:177-179 requires notes only for COMMERCIAL | API-created residential requests can have no notes; client and server disagree on the contract |
| Residential annualIncome | isStep2Valid requires a selected year with a non-empty amount (components/RequestForm.tsx:255-263) | pages/api/requests/index.ts validates details only as bounded JSON; annualIncome shape/values entirely unvalidated | Server accepts residential requests with no income data; brokers see empty income tables |
| Commercial income/expense year pairing | handleSubmit enforces income year ⇄ expense year matching client-side (components/RequestForm.tsx:301-321) | No equivalent check in POST or PATCH | Business rule exists only in the browser |
| province | Fixed 13-name list (components/RequestForm.tsx:13-27); broker filter uses a different 10-name list with exact-equality matching (pages/broker/requests/index.tsx:22-33, pages/api/requests/index.ts:32-34) | assertString max 100 — any value accepted (pages/api/requests/index.ts:146) | Three divergent contracts: territory requests unfilterable by brokers; API accepts non-Canadian values |
| Error response shape | pages/borrower/request/new.tsx:60-63 and RequestForm display `json.error` verbatim, preferring it over localized fallback | Free-text English `error` strings; 429 message embeds req.method + req.url (lib/withAuth.ts:101-103) | No machine-readable error codes; raw English (and internal route info) leaks to end users in both locales |
| PATCH malformed input status codes | Edit UI expects 4xx with {error} for invalid input | pages/api/requests/[id].ts:194-201,224 — non-array productTypes throws TypeError and invalid mortgageCategory throws Prisma error → both become 500 'Internal server error' | Validation failures surface as 500s instead of 400s |
| Broker browse list response shape | pages/broker/requests/index.tsx:125-134 filters on req.conversations[].broker.userId; BrokerDataContext.tsx:97 types conversations on cached requests | pages/api/requests/index.ts:62-74 deliberately omits the conversations include and instead returns hasMyConversation:boolean (line 115) | Frontend consumes a removed field; the API's replacement flag is unused — 'Only unresponded' filter is a no-op (see High finding) |
| Broker profile create/update error envelope | pages/broker/onboarding.tsx:96 and pages/broker/profile.tsx:148 read data.message | lib/withAuth.ts:113 and pages/api/brokers/profile.ts:93,101,109 emit { error: string } | Server validation/conflict messages are never displayed; users always see the generic fallback |
| GET /api/requests mortgageCategory query param status code | Filter chip sends RESIDENTIAL/COMMERCIAL only, expects 200 or 403 | pages/api/requests/index.ts:35-37 passes arbitrary strings to a Prisma enum column → PrismaClientValidationError → 500 | Client-input error surfaces as 500 instead of 400 for non-enum values |
| Dashboard 'new requests' metric semantics | pages/broker/dashboard.tsx:260 labels counters.newRequests as 'New requests · this week' | pages/api/requests/index.ts:44-53 newCount = all-time unseen OPEN requests (no time bound) | Label promises a 7-day window the backend doesn't implement |
| Verification gate parity across seen-tracking endpoints | Browse page calls both endpoints interchangeably (index.tsx:116-123, [id].tsx:86-90) | pages/api/brokers/requests/[id]/mark-seen.ts:24-26 requires VERIFIED; pages/api/brokers/mark-requests-seen.ts:14-20 does not | Inconsistent authorization between the single and bulk variants of the same operation |
| System message flag | Prisma-derived Message type (types/index.ts re-export) includes isSystem; neither messages page reads or renders it | GET /api/conversations/[id] message select (lines 32-41) omits isSystem entirely, contradicting prisma/schema.prisma:207-211 which mandates rendering from the column | isSystem is undefined at runtime in the frontend; system messages indistinguishable from user messages |
| Unread counting | Both badges presented as the same 'unread' concept | pages/api/conversations/index.ts:101 uses createdAt gte lastReadAt; pages/api/messages/unread.ts:45 uses gt; unread.ts additionally filters status:'ACTIVE' (line 25) and ignores UserBlock while the list endpoint filters blocked counterparts after counting | Nav badge and list badges can disagree on the same data |
| GET /api/conversations/[id] response typing | pages/borrower/messages.tsx types the response as ConversationWithParticipants whose request is Pick<BorrowerRequest,'id'/'province'/'city'/'mortgageCategory'/'productTypes'/'schemaVersion'> (types/index.ts:23-27) — lacks publicId/status/notes/desiredTimeline/details | API returns request with publicId, status, desiredTimeline, details, notes, createdAt ([id].ts:57-71) and the page passes them to RequestContextPanel (publicId drives the 'view full request' link) | Type lies in both directions (fields used at runtime aren't in the type; typed schemaVersion isn't returned); compiles only via structural leniency, hides contract drift |
| Error body shape on send | handleSend reads data.error // data.message (borrower:320, broker:299) | /api/messages and withAuth only ever emit { error } — no message field anywhere | Dead fallback branch suggesting a contract that doesn't exist |
| Pagination contract | Neither page sends page/limit (list) or before/limit (thread), and hasMore in the [id] response is never read | Both endpoints implement and document pagination (conversations/index.ts:54-55, [id].ts:13-14,88) | Server contract exists but is entirely unused — data silently truncates at 50 items in both views |
| Scheduled downgrade pricing | broker.planScheduled / broker.pendingDowngrade banners and pricing.faq1A (both locales) promise the plan 'will change to {{tier}} at the start of your next billing cycle' — implying the new (lower) price is charged from that date | pages/api/webhooks/stripe.ts:246-258 swaps the Stripe price only AFTER the renewal invoice is paid at the old higher price, while granting the lower tier's credits for that cycle | User is charged the old price for the first cycle of the downgraded tier; UI promise and billing reality diverge |
| No-credits dashboard banner copy | pages/broker/dashboard.tsx:148-152 default copy says 'Upgrade your plan or buy more credits to continue responding' | No credit-purchase endpoint exists anywhere (credits come only from subscription webhooks and POST /api/admin/credits); only plan upgrades are user-accessible | Copy advertises a 'buy more credits' feature that is not implemented |
| Payment-failure access cut (PREMIUM) | billing.tsx PAST_DUE banner (lines 360-378) implies the subscription is restricted until payment is updated | pages/api/webhooks/stripe.ts:303-330 resets responseCredits but not subscriptionTier; pages/api/conversations/index.ts:282 grants PREMIUM-tier brokers unlimited creation regardless of credits or status | PAST_DUE PREMIUM brokers retain full paid functionality despite the failed payment |
| create-checkout equal-tier request | billing.tsx disables the current plan's button (line 530), so it never sends tier === currentTier | pages/api/stripe/create-checkout.ts:61-63 treats an equal-rank tier as a downgrade (isUpgrade uses strict >) and would persist pendingTier equal to the current tier via direct API call | Backend accepts and schedules a no-op 'downgrade' the frontend can never produce; combined with the stale-pendingTier bug this can cause a spurious price swap at the next renewal |
| System settings | pages/admin/system.tsx SETTING_FIELDS sends platform_name and support_email in PUT /api/admin/settings body (lines 28-37, 111-121) | pages/api/admin/settings.ts ALLOWED_KEYS (lines 22-30) rejects unknown keys with 400 'Unknown setting: …' before applying any updates | Editing either visible field aborts the entire batched save; the fields also always render empty (no DB row/default). Conversely broker_initial_message_limit is accepted by the API but absent from the UI. |
| Broker verification two-admin flow | pages/admin/inbox.tsx:115 and pages/admin/brokers/[id].tsx:122 treat any r.ok response as success ('승인됨'/'변경 완료') | pages/api/admin/brokers/[id].ts:110-114 returns 202 {status:'PENDING_SECOND_REVIEW', message} when BROKER_VERIFY_REQUIRES_TWO_ADMINS=true | 202 is truthy ok — the recorded-recommendation contract is invisible to the UI; broker stays PENDING while admin is told it succeeded. |
| Admin user detail (broker conversations) | pages/admin/users/[id].tsx renders user.conversations only (line 277-281); UserDetail.broker interface omits conversations | pages/api/admin/users/[id].ts:52-65 returns broker.conversations specifically so the page can show broker-side threads | Response field is silently dropped; broker users always show an absent conversations section. |
| Command palette quick actions | components/admin/CommandPalette.tsx:171-174 routes 'credits' and 'notice' to /admin/users/[publicId] 'where the existing modal lives' | POST /api/admin/credits exists with no UI consumer; no notice-creation endpoint exists at all | Both actions dead-end on a page without the promised modals. |
| Activity status filter | pages/admin/activity.tsx:33,124-127 accepts ?status=FLAGGED as a filter value | No FLAGGED status exists on BorrowerRequest or Conversation (enums in handlers: requests PENDING_APPROVAL/OPEN/…, conversations ACTIVE/CLOSED) | Deep-linking ?status=FLAGGED silently filters everything out; also no chips exist for real statuses OPEN/PENDING_APPROVAL/EXPIRED/REJECTED so those can't be filtered. |
| Report detail target resolution | components/ReportButton.tsx call sites store 9-digit publicIds as targetId (broker/requests/[id].tsx:217, borrower/brokers/[requestId].tsx:216); pages/admin/reports.tsx declares detail.targetDetails | pages/api/admin/reports/[id].ts:31-50 resolves targetDetails via findUnique on internal id columns only (no publicId branch, unlike reports/index.ts:39 and queue.ts:70) | targetDetails is always null for web-created reports; list and detail endpoints disagree on targetId resolution (list rewrites cuids to publicIds, detail returns raw). |
| Badge counts vs inbox queue freshness | lib/admin/AdminDataContext.tsx invalidate() refetches both streams expecting fresh data after a mutation | pages/api/admin/stats.ts serves from KV for 60s (+ Cache-Control private max-age=30) with no mutation-side invalidation; /api/admin/queue is no-store | Right after an approve/reject the queue updates but rail badges/headline counts stay stale up to ~90s. |
| Inbox brokers vs API lookup key | pages/admin/inbox.tsx:104 PUTs to /api/admin/brokers/${row.id} (broker internal id); GET on /admin/brokers/[id] page may arrive with a user publicId from reports links | pages/api/admin/brokers/[id].ts GET accepts publicId or broker id (lines 11-48) but PUT only does findUnique({where:{id}}) (line 69-72) | Works today because the page PUTs broker.id from the GET response, but a PUT with a publicId (e.g., scripted from a report link) 404s — asymmetric contract. |
| Auth email locale | pages/signup.tsx:81 and pages/verify-email.tsx:103 send body.locale; pages/forgot-password.tsx:24 sends only { email } (no locale) | POST /api/auth/signup and /api/auth/resend-code consume body.locale for the email only and never persist it; POST /api/auth/forgot-password ignores body entirely for locale and reads user.preferences.locale (pages/api/auth/forgot-password.ts:66) which no endpoint ever writes | The locale contract is split across two incompatible conventions (request-scoped vs persisted-preference); the persisted path has no writer, so password-reset emails are always Korean |
| API error display | 8 user-facing pages display the API `error` string verbatim as user copy (e.g. pages/borrower/messages.tsx:331 setError(err.message)) | lib/validate.ts and handlers emit untranslated English developer-style messages in the error field (e.g. pages/api/messages/index.ts:23 "Message must be between 1 and 5000 characters") | Frontend treats error as localized display text; backend treats it as an English diagnostic — no error-code contract exists for client-side translation |
| Broker billing success copy | pages/broker/billing.tsx:255,290 expect catalog keys broker.planUpdating and broker.planUpdatePending with {{tier}} interpolation | public/locales/en/common.json and ko/common.json define broker.planScheduled and broker.planUpgraded but not the two keys used | Code/catalog contract drift causes raw key strings in the payment flow |
| Admin conversation close notification | pages/admin/activity.tsx:554 dialog tells admins "양 당사자에게 관리자 종료 메시지가 전달됩니다" (both parties receive an admin closure message) | pages/api/admin/conversations/[id].ts:117-119 writes that message in English only, and pages/api/cron/auto-close-conversations.ts writes no message at all for cron closures | The promise made in the admin UI does not match what (or in which language) the backend actually delivers |
| Unread message counting | Navbar badge uses GET /api/messages/unread which counts messages with createdAt strictly greater than lastReadAt (pages/api/messages/unread.ts:45, `gt`). | GET /api/conversations computes per-conversation unreadCount with createdAt greater-or-equal (pages/api/conversations/index.ts:101, `gte`). | gt vs gte boundary inconsistency: a message timestamped exactly at lastReadAt counts as unread in the conversation list but not in the navbar badge, so the two unread indicators can disagree. |
| API error body shape across notification-adjacent endpoints | Clients must branch per endpoint to display errors. | Auth/email endpoints return { message: string } (signup.ts:25,32; resend-code.ts:24,56; forgot-password.ts:31) while notices.ts, register-device.ts, messages, conversations return { error: string }. | Inconsistent error envelope ({message} vs {error}) across the same product area; a shared client error handler will miss one shape. |
| Pricing features | pages/pricing.tsx tiers[] claims PRO/PREMIUM 'New request notifications' (notifications:true, lines 92/108) and PREMIUM 'Real-time message alerts' (realtimeAlerts:true, line 109); ko copy explicitly promises EMAIL alerts. | lib/email.ts implements only verification-code, admin-new-admin, and password-reset emails; sendPushToUsers is called only for chat messages/inquiries (pages/api/messages/index.ts:142, pages/api/conversations/index.ts:217,344) for all tiers; subscriptionTier gates only credits (conversations/index.ts:242,282). | Advertised paid features have zero backend implementation and no tier gating exists for any notification. |
| Pricing amounts | pages/pricing.tsx hardcodes $0/$29/$69/$129 plus strikethrough anchors $49/$99/$199 (lines 53-104). | lib/stripe.ts:19-23 charges whatever the Stripe dashboard prices behind env STRIPE_PRICE_BASIC/PRO/PREMIUM are — no runtime link to the displayed numbers. | No single source of truth; if dashboard prices change, the page silently misstates the charge (needs manual verification against Stripe dashboard). |
| SEO crawler contract | pages/pricing.tsx client-redirects anonymous visitors and prerenders empty HTML (lines 30-47); /borrower/* and /broker/* pages client-redirect to /login. | public/sitemap-0.xml advertises /pricing, /en/pricing, /en/borrower/dashboard, /en/login etc. with changefreq=daily; robots.txt allows all /en/ variants. | Sitemap/robots promise crawlable content that resolves to blank redirect shells; /en pages carry invalid /en/en hreflang alternates. |
| Open Graph image | components/SEO.tsx:21 emits og:image=${SITE_URL}/og-default.png on every page (no page overrides it). | public/ root only contains og-default-1.png; the actual asset lives at public/logo/og-default.png. | og:image / twitter:image URL 404s site-wide. |
| Stripe API version (observed while cross-checking pricing) | n/a | lib/stripe.ts:8-14 — comment instructs 'Avoid *.clover preview tags — they get sunset… and break webhook handlers' immediately above apiVersion: "2026-02-25.clover". | Code contradicts its own guard comment; webhook handlers are pinned to a preview API tag. |
| Error response shape | Clients generally read `data.error` (e.g. components/Navbar.tsx, admin pages via jsonOrThrow) | pages/api/preferences.ts returns `{ message: ... }` for 400/405 (lines 46, 51, 62, 83) while every other route returns `{ error: ... }` | A consumer using the platform-wide `error` key gets undefined for preferences failures; inconsistent contract. |
| Admin settings: displayed vs effective values | pages/admin/system.tsx renders only what GET /api/admin/settings returns (DB rows) | lib/settings.ts:5-16 applies hardcoded DEFAULTS (free=0, basic=5, pro=20, expiry=30, retention=180, max_requests=5) whenever a row is absent; prisma/seed.ts:458-468 seeds different values (free=3, basic=15, pro=40, max_requests=10) | Three sources of truth disagree; on an unseeded prod DB the admin UI shows blanks while crons/webhooks silently run on code defaults, and request_retention_days is not even editable (absent from ALLOWED_KEYS at pages/api/admin/settings.ts:22-30). |
| Admin quick actions (credits / notice) | components/admin/CommandPalette.tsx:171-174 routes 'credit adjust' and 'send notice' to /admin/users/[id] saying 'these require modal inputs' | POST /api/admin/credits exists but is unconsumed; no notice-create endpoint exists at all (pages/api/notices.ts is GET/PUT only) | The promised modals do not exist on pages/admin/users/[id].tsx — both quick actions dead-end; one backend route is orphaned, the other is missing. |
| Documented limits vs enforced limits | - | lib/constants.ts documents SIGNUP_PER_IP_PER_MIN=5, MAX_MESSAGE_LENGTH=5000, MAX_ADMIN_CREDIT_DELTA=10000, MAX_REQUEST_NOTES_LENGTH=4000 etc., but handlers hardcode their own copies (pages/api/auth/signup.ts:21, pages/api/messages/index.ts:22, pages/api/admin/credits.ts:19, pages/api/requests/index.ts:149-150) | Constants module claims to be the single source of truth; actual behavior is governed by duplicated inline literals that can drift. |
| System-message sender semantics | - | pages/api/cron/auto-close-conversations.ts:9,41 assumes system messages have senderId="SYSTEM"; the actual write paths (pages/api/requests/[id].ts:122-124, pages/api/admin/conversations/[id].ts:111-116) set isSystem=true with REAL user ids (including the borrower's) | Cron's engagement filter contract doesn't match how system messages are actually stored — filter is a no-op and can misclassify borrower engagement. |
| Route↔consumer map (full sweep result) | All fetch targets in pages/, components/, lib/ resolve to existing route files (incl. NextAuth's built-in /api/auth/session); /admin redirects to /admin/inbox via next.config.mjs:39 so getDashboardPath('ADMIN')='/admin' is valid | Routes with zero in-repo consumers: GET /api/admin/brokers, POST /api/admin/credits, POST /api/admin/users/create, /api/preferences, /api/notifications/register-device, /api/users/[publicId]/block, /api/users/blocked, /api/auth/mobile-oauth, PATCH /api/users/me (crons + /api/webhooks/stripe are externally invoked by design) | Orphans are a mix of dead routes (admin brokers list, credits) and presumed-mobile-app consumers that cannot be verified from this repo. |
| Broker respond CTA vs conversation creation | pages/broker/requests/[id].tsx:339-340 gates only BASIC/PRO with 0 credits; FREE tier gets the active 'start conversation' CTA with credit copy | pages/api/conversations/index.ts:242-243 returns 403 'Free plan brokers cannot message clients. Please upgrade your plan.' for all FREE brokers | UI promises an action the API always rejects for FREE tier; rejection message is English-only and rendered verbatim. |
| Province option lists | components/RequestForm.tsx:13-27 offers 13 provinces/territories to borrowers; pages/broker/requests/index.tsx:22-33, pages/broker/onboarding.tsx:15-26, pages/broker/profile.tsx:20-31 offer only 10 (no NT/NU/YT) | BorrowerRequest.province stores any of the 13 values | Territory requests exist in the marketplace but brokers cannot register in or filter by those territories. |
| Resend verification code response handling | pages/verify-email.tsx:100-115 treats any non-429 response as success (sets 'code sent' + 60s cooldown) | /api/auth/resend-code can return 4xx/5xx error JSON | Error responses surfaced as success feedback; status codes other than 429 ignored. |
| Credentials login error contract | pages/login.tsx:50-73 expects coded errors (EMAIL_NOT_VERIFIED, GOOGLE_ACCOUNT, RATE_LIMITED) and displays anything else raw | lib/auth.ts:111-131 throws a mix of codes and human English sentences | Inconsistent error contract → untranslated English sentences shown in the ko UI. |
| Stripe checkout error shape | pages/broker/billing.tsx:240-243 reads data.error but only logs it to console | /api/stripe/create-checkout returns { error } with non-200 status | Backend error payload exists but is never rendered to the user. |
| Broker profile create/update error shape | pages/broker/profile.tsx:147-148 and pages/broker/onboarding.tsx:95-96 read data.message from non-OK JSON | pages/api/brokers/profile.ts returns { error: string } on 403/404/405/409 (lines 93, 101, 109, 128, 141) and lib/withAuth.ts:113 maps ValidationError to { error: message } | data.message is always undefined, so specific validation/conflict messages never reach the user; only generic fallback text is shown. |
| Broker profile request body shape | CreateBrokerProfileInput (types/index.ts:76-86) — the client contract — has no profilePhoto field and no form collects one | pages/api/brokers/profile.ts:65-68 accepts and persists an optional profilePhoto HTTPS URL on POST/PUT | Backend accepts a field the frontend can never send; the column is populated only via hand-crafted API calls and is invisible everywhere, i.e. silent contract drift around a dead feature. |
| Borrower profile | pages/borrower/profile.tsx:19-24 — BorrowerProfile interface requires _count.reviews: number | pages/api/borrowers/profile.ts:17-23 — GET selects only _count.borrowerRequests and _count.conversations; no reviews field exists anywhere in prisma/schema.prisma | Response type lies about the payload; any future code reading profile._count.reviews gets undefined at runtime despite passing TypeScript. |
| Login error contract | pages/login.tsx:49-73 — expects sentinel codes (EMAIL_NOT_VERIFIED, GOOGLE_ACCOUNT, RATE_LIMITED) and otherwise renders result.error raw | lib/auth.ts:93,111,119,127,131 — throws a mix of sentinel codes and human English sentences; pages/api/auth/[...nextauth].ts:46-49 returns 429 with a NextAuth-shaped url for RATE_LIMITED | Half-sentinel/half-prose contract: untranslated English prose reaches the UI for invalid-credentials/suspended/banned; only three cases are mapped. |
| Resend verification code | pages/verify-email.tsx:100-115 — treats every non-429 response as success (sets 'code sent' message) | pages/api/auth/resend-code.ts:31 (400), :77 (502), :83 (500) — returns failure statuses with {message} | Status-code contract ignored; send failures are reported to the user as success. |
| API error-shape inconsistency across the borrower journey | pages/borrower/request/new.tsx:62 reads json.error; pages/borrower/profile.tsx:82 reads data.message | /api/requests returns { error } (pages/api/requests/index.ts:129-191); /api/borrowers/profile and all /api/auth/* return { message } | Two different error envelope shapes ({error} vs {message}) across endpoints consumed in the same user flow — each page must know which shape its endpoint uses; shared error handling is impossible. |
| Forgot-password locale | pages/forgot-password.tsx:21-25 posts only { email } (router.locale available but not sent); signup (signup.tsx:81) and resend-code (verify-email.tsx:103) DO send locale | pages/api/auth/forgot-password.ts:63-67 ignores any request locale and reads user.preferences.locale, which is never written | Inconsistent locale-passing convention across the three auth-email endpoints; the one endpoint that relies on stored preferences gets a value that never exists → email always Korean. |
| Conversation list last-message preview | pages/borrower/messages.tsx:495 reads conv.messages[0] as the latest message; pages/broker/messages.tsx:403-404 reads conv.messages[conv.messages.length - 1] for the same payload | pages/api/conversations/index.ts:65-68 returns messages with orderBy createdAt desc, take: 1 | The two pages assume opposite orderings and only agree because the API caps at one message; raising `take` or changing the order would silently show wrong previews on one side. |
| Conversation list item request shape | pages/broker/messages.tsx:35-47 types ConversationListItem.request with details, notes, desiredTimeline, createdAt | pages/api/conversations/index.ts:85 selects only id, publicId, province, city, status, mortgageCategory, productTypes for list items (rich fields come only from /api/conversations/[id], and only for VERIFIED brokers per [id].ts:107-122) | Frontend type overstates the list payload; any code reading details/notes off list items would get undefined at runtime while type-checking fine. |
| Request close | No close-request control exists on any borrower page | PUT /api/requests/[id] {status:CLOSED} fully implemented (pages/api/requests/[id].ts:87-141) and DELETE's 409 message instructs the user to close instead | API-supported transition unreachable from UI; borrowers with responded requests are stuck |
| Request editing with conversations | Full edit form shown for any OPEN/PENDING_APPROVAL request (request/[id].tsx:149,306-313) | PATCH 409s material edits when _count.conversations > 0 (pages/api/requests/[id].ts:177-191) | User can fill and submit edits the server will reject, with an untranslated error |
| Request deletion with conversations | Delete button shown for all OPEN/PENDING_APPROVAL requests (request/[id].tsx:215-220) | DELETE 409s when conversations exist (pages/api/requests/[id].ts:258-263) | Button visible for an operation that will fail |
| Request list pagination | BorrowerDataContext fetches /api/requests with no params and documents 'no pagination' (BorrowerDataContext.tsx:87,149) | GET /api/requests paginates with default limit 20 (pages/api/requests/index.ts:40-42) | Silent truncation of requests >20; counters computed from partial data |
| IN_PROGRESS status | Dashboard/sidebar treat IN_PROGRESS as a normal active state (dashboard.tsx:76-100) | No non-admin code path ever sets IN_PROGRESS; conversation creation leaves status OPEN | Documented lifecycle stage unreachable organically; auto-close cron (targets IN_PROGRESS) mostly inert |
| Report targetId convention | ReportButton passes broker.user.publicId as targetId (brokers/[requestId].tsx:216) | Account-deletion cleanup deletes reports where targetId = broker.id (users/me.ts:147) | Inconsistent target identifier for BROKER reports means deletion cleanup may miss rows — verify which convention /api/reports stores |
| Profile name validation | Only HTML required on the name input (profile.tsx:209-216) | /api/borrowers/profile: non-empty only (no max); /api/users/me PATCH: max 100 | Inconsistent server limits and no client max length |


## Dead code and unused routes

- **authLimiter and verifyCodeLimiter (legacy in-memory limiters)** (lib/rate-limit.ts) — Exported at lib/rate-limit.ts:47-55 but referenced only by tests (tests/unit/lib/rate-limit.test.ts). All production auth/verify flows now use checkRateLimit (signup, login wrapper, verify-email, resend-code, forgot-password, reset-password). The two limiters are unused in app code.
- **AppleProvider web configuration** (lib/auth.ts) — AppleProvider is conditionally registered in NextAuth (lib/auth.ts:77-84) but no Apple sign-in button exists anywhere in the web UI (login.tsx/signup.tsx render only a Google button). Web Apple OAuth is unreachable; Apple is handled solely via the mobile-oauth endpoint. Harmless but currently dead on web.
- **authLimiter and verifyCodeLimiter legacy in-memory limiter exports** (lib/rate-limit.ts, tests/unit/lib/rate-limit.test.ts) — Exported at lib/rate-limit.ts:47-55 with a comment claiming they are 'kept for auth/verify flows', but no production code imports them — all four auth handlers use checkRateLimit. Only tests/unit/lib/rate-limit.test.ts references them, so the tests exercise dead code paths while the live checkInMemory/checkKv paths are what production uses.
- **Unused `currentYear` constant in RequestForm component body** (components/RequestForm.tsx) — Declared at line 141 (`const currentYear = new Date().getFullYear();`) and never referenced; getYearOptions() (lines 53-56) computes its own. The adjacent comment ('default to last 2 years') describes behavior that no longer exists.
- **Legacy string-shaped details fallbacks (schema v1 rendering)** (pages/borrower/request/[id].tsx, components/broker/RequestDetailBlocks.tsx) — [id].tsx:452-479 (non-object corporateAnnualIncome branch incl. t('request.corporateIncome')/t('request.corporateExpenses') keys used nowhere else), RequestDetailBlocks.tsx:63-65 (string purposeOfUse) and 163-167 (string annualIncome). All writes set schemaVersion 2 with object-shaped maps; squashed migrations contain no v1 columns. Dead unless unverified pre-v2 prod rows exist.
- **schemaVersion column written but never branched on** (prisma/schema.prisma, pages/api/requests/index.ts, types/index.ts) — Written as literal 2 at pages/api/requests/index.ts:208 and selected into ConversationWithParticipants (types/index.ts:27), but no rendering or API code reads it for version dispatch (verified via repo-wide grep).
- **`void PROVINCES;` no-op statement** (pages/broker/requests/index.tsx) — Lines 314-316: a void expression with a comment claiming it keeps the module-level const 'usable via closure' — module-scope consts need no such statement; pure dead code.
- **timelineLabels map duplicating TIMELINE_LABEL_KEYS** (components/RequestForm.tsx, lib/requestConfig.ts) — RequestForm.tsx:373-379 rebuilds the exact mapping already exported as TIMELINE_LABEL_KEYS (lib/requestConfig.ts:78-84) and already imported by RequestFormLayout/borrower detail/broker pages; redundant divergence risk.
- **Broker.lastRequestsSeenAt (legacy timestamp)** (prisma/schema.prisma, pages/api/brokers/mark-requests-seen.ts, tests/fixtures/users.ts) — Written at mark-requests-seen.ts:37 and :54 ('legacy fallback' per schema comment at prisma/schema.prisma:154) but grep across the repo shows no reader — newCount is computed solely from BrokerRequestSeen (pages/api/requests/index.ts:47-53). Pure write-only column.
- **Broker.profilePhoto field + assertOptionalHttpsUrl validation branch** (prisma/schema.prisma, pages/api/brokers/profile.ts, components/broker/BrokerDataContext.tsx) — Accepted/validated at pages/api/brokers/profile.ts:65-68 and typed at BrokerDataContext.tsx:39, but no UI sends it, no upload mechanism exists, and nothing ever renders it to brokers or borrowers.
- **BrokerNavKey 'settings' variant** (components/broker/BrokerShell.tsx) — Declared in the BrokerNavKey union (BrokerShell.tsx:26-32) but has no NAV_ITEMS entry and no /broker/settings page exists.
- **`void PROVINCES;` statement** (pages/broker/requests/index.tsx) — Lines 314-316: a no-op `void PROVINCES;` with a comment claiming it keeps the constant usable in a closure — module-scope import already does that; the statement is dead.
- **BrokerCachedRequest.conversations / BrokerRequest.conversations fields** (components/broker/BrokerDataContext.tsx, pages/broker/requests/index.tsx) — BrokerDataContext.tsx:97 and requests/index.tsx:45 type a conversations array that the broker GET /api/requests response no longer includes (replaced by hasMyConversation at pages/api/requests/index.ts:115); the only consumer is the broken only-unresponded filter.
- **Hidden index span in dashboard request rows** (pages/broker/dashboard.tsx) — Lines 378-380 render `<span className="hidden" aria-hidden>{i}</span>` — an invisible row index serving no purpose.
- **Unread-badge rollback .catch() handler in selectConversation** (pages/borrower/messages.tsx) — pages/borrower/messages.tsx:289-296 — unreachable: fetchActiveConversation (lines 163-176) catches internally and never rethrows, so its promise always resolves; the rollback the adjacent comment describes can never execute.
- **isSelectingRef gating in the broker page poll path** (pages/broker/messages.tsx) — isSelectingRef (line 122) is only consulted inside the realtime sync handler (line 204); the 5s poll ignores it — partially vestigial coordination flag (borrower page same pattern, lines 133/214).
- **free_tier_credits system setting (lib/settings.ts:10, lib/stripe.ts:36-40)** (lib/settings.ts, lib/stripe.ts, pages/api/conversations/index.ts) — FREE-tier brokers are unconditionally blocked from creating conversations (conversations/index.ts:242-244), so credits granted from free_tier_credits can never be spent; the setting only matters as the reset value on lapse and is hard-defaulted to 0. If an admin raised it, the credits would be unusable — config knob with no effective behavior.
- **ProcessedStripeEvent @@index([createdAt])** (prisma/schema.prisma) — Index exists solely to support a time-based purge that no cron implements (schema.prisma:232); currently unused by any query.
- **pricing.startFreeTrial key name** (pages/pricing.tsx, public/locales/en/common.json, public/locales/ko/common.json) — Key name references a free trial that does not exist (no trial_period_days anywhere in checkout); both locale values now say 'Create Broker Account' / '모기지 전문가 계정 만들기'. Stale naming only — rename for clarity.
- **lib/csvExport.ts (downloadCSV)** (lib/csvExport.ts) — Zero callers anywhere in pages/components/lib/tests (grep confirmed). Every admin '⬇ CSV' / '내보내기' button (people.tsx:307-309, activity.tsx:435-438, reports.tsx:245-248, inbox.tsx:222-225) is rendered with disabled, so the export feature is unreachable.
- **DELETE handler in /api/admin/requests/[id]** (pages/api/admin/requests/[id].ts) — Lines 157-211 implement full request deletion with cascade + audit, but no admin UI issues a DELETE to this route (grep for method: "DELETE" in pages/admin and components/admin returns nothing). Reachable only via direct API calls.
- **POST /api/admin/users/create (web UI path)** (pages/api/admin/users/create.ts, pages/admin/people.tsx) — No frontend caller; the '+ 초대' button on people.tsx:310-312 is disabled. Endpoint is fully built (ack, rate limit, broadcast) but only reachable via curl/mobile — verify whether the mobile admin client uses it.
- **toneForReportStatus** (components/admin/primitives/tones.ts) — Exported at tones.ts:88-101 but unused — pages/admin/reports.tsx defines its own local STATUS_TONE map (reports.tsx:51-56).
- **AEmpty primitive** (components/admin/primitives/AEmpty.tsx) — No usage outside the primitives barrel; admin pages hand-roll their empty states.
- **ReportTargetType.USER paths** (prisma/schema.prisma, pages/api/admin/reports/index.ts, pages/api/admin/queue.ts) — Schema enum includes USER (schema.prisma:279) and admin list/queue endpoints handle USER targetIds (reports/index.ts:18, queue.ts:103-114), but /api/reports excludes USER from allowedTypes (reports.ts:45-49) and no creation path exists — the resolution branches are unreachable.
- **targetDetails computation in GET /api/admin/reports/[id]** (pages/api/admin/reports/[id].ts, pages/admin/reports.tsx) — Computed at lines 29-52 but never matches publicId-stored targetIds (always null for web-created reports) and the ReportDrawer never renders detail.targetDetails — wasted query both broken and unused.
- **CacheEntry.versionStamp field** (lib/settings.ts) — Stored on every cache entry (settings.ts:22, 72) but never read — invalidation works by clearing the whole Map on version change.
- **Catalog keys home.title1After and home.title3 (empty-string values in both locales, no references in pages/components/lib)** (public/locales/en/common.json, public/locales/ko/common.json) — Values are "" in both catalogs and grep finds zero t("home.title1After") / t("home.title3") call sites — leftover from a previous hero layout.
- **Catalog key misc.in (en="in", ko="")** (public/locales/en/common.json, public/locales/ko/common.json) — No t("misc.in") reference anywhere; empty ko value would render nothing if it were used.
- **~1,025 of 1,819 catalog keys have no static t() reference** (public/locales/en/common.json, public/locales/ko/common.json) — Static extraction matched only 794 catalog keys; many of the rest resolve through dynamic keys (statusLabel.*, request.product.*, manual.*, terms.s*, privacy.* loops) so this is an upper bound, not a deletion list — needs a dynamic-key-aware audit before pruning.
- **AdminNotice.dedupeKey column** (/Users/hyunseokcho/Documents/GitHub/mortly/prisma/schema.prisma) — Defined with unique constraint and an idempotency design comment (schema.prisma:336-340) but never referenced by any code — no adminNotice.create exists outside prisma/seed.ts.
- **DeviceToken.mutedUntil column** (/Users/hyunseokcho/Documents/GitHub/mortly/prisma/schema.prisma, /Users/hyunseokcho/Documents/GitHub/mortly/lib/push.ts) — Read in the sendPushToUsers filter (lib/push.ts:42) but no endpoint or code path ever writes it, so the mute branch is unreachable.
- **AdminNotice write path / Navbar bell content** (/Users/hyunseokcho/Documents/GitHub/mortly/pages/api/notices.ts, /Users/hyunseokcho/Documents/GitHub/mortly/components/Navbar.tsx) — Read/mark-read API and bell UI are live code, but with no production writer the feature is functionally dead — every user polls an always-empty table every 30 seconds.
- **messagePush/brokerInquiryPush unused content parameters** (/Users/hyunseokcho/Documents/GitHub/mortly/lib/push.ts) — `_body` (push.ts:123) and `_firstMessage` (push.ts:136) are accepted and passed by callers (messages/index.ts:144, conversations/index.ts:346-349) but intentionally ignored for privacy; signature could be simplified once pushPreviewEnabled lands.
- **components/TrendChart.tsx + recharts dependency** (components/TrendChart.tsx, package.json) — Repo-wide grep finds zero imports of TrendChart (only its own definition at lines 12 and 19); recharts (package.json:53) is imported nowhere else, so a heavy charting library ships in node_modules solely for an unused component.
- **app.json (empty Expo config)** (app.json) — Contains only {"expo": {}} — Expo leftover at the web repo root; the web app uses expo-server-sdk (server push) which does not need app.json.
- **pages/fonts/GeistVF.woff and pages/fonts/GeistMonoVF.woff** (pages/fonts/GeistVF.woff, pages/fonts/GeistMonoVF.woff) — create-next-app leftovers sitting inside pages/ (not routable, not referenced — grep for GeistVF/GeistMono across ts/tsx/css/mjs returns nothing; the site uses Outfit + Pretendard via _document.tsx).
- **public/og-default-1.png (orphaned asset)** (public/og-default-1.png, components/SEO.tsx) — Nothing references og-default-1.png; SEO.tsx:21 references /og-default.png which does not exist at the public root — one of the two should be renamed/removed (see og:image finding).
- **components/Pagination.tsx** (components/Pagination.tsx) — Zero importers across pages/, components/, lib/ — admin pages implement their own load-more pagination.
- **components/RequestCard.tsx** (components/RequestCard.tsx, pages/borrower/dashboard.tsx, pages/broker/requests/index.tsx) — Zero importers; pages/borrower/dashboard.tsx:537 defines its own local RequestCard and broker requests page defines RequestCardMobile locally.
- **components/Tooltip.tsx** (components/Tooltip.tsx) — Zero importers (the only 'Tooltip' references are the recharts Tooltip inside TrendChart.tsx, itself dead).
- **20 of 25 exports in lib/constants.ts** (lib/constants.ts) — MOBILE_SESSION_MAX_AGE_SECONDS, VERIFICATION_CODE_TTL_MS, PASSWORD_RESET_TTL_MS, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MESSAGES_PAGE_SIZE, ADMIN_LIST_PAGE_SIZE, all 10 rate-limit constants, MAX_MESSAGE_LENGTH, MAX_REQUEST_NOTES_LENGTH, MAX_REQUEST_DETAILS_BYTES, BROKER_INITIAL_MESSAGE_LIMIT, MAX_ADMIN_BULK_TARGETS, MAX_ADMIN_CREDIT_DELTA, FORGOT_PASSWORD_RESPONSE_TARGET_MS are imported nowhere; values exist as inline magic numbers at the real call sites.
- **CacheEntry.versionStamp in lib/settings.ts** (lib/settings.ts) — Written at lib/settings.ts:72 but never read; invalidation works via cache.clear() alone.
- **SYSTEM_USER_ID filter in auto-close cron** (pages/api/cron/auto-close-conversations.ts) — `senderId: { not: "SYSTEM" }` (lines 9, 41) can never exclude a row — no user has id "SYSTEM"; system messages are flagged via Message.isSystem with real sender ids.
- **GET /api/admin/brokers (list route)** (pages/api/admin/brokers/index.ts) — Zero frontend consumers — admin UI lists brokers via /api/admin/queue and /api/admin/users; only the [id] detail route is fetched.
- **POST /api/admin/credits** (pages/api/admin/credits.ts, components/admin/CommandPalette.tsx) — Zero frontend consumers; CommandPalette's 'credit adjust' action routes to /admin/users/[id], which has no adjust UI. Also hardcodes 10_000 instead of MAX_ADMIN_CREDIT_DELTA.
- **Web-orphan mobile routes: /api/preferences, /api/notifications/register-device, /api/users/[publicId]/block, /api/users/blocked, /api/auth/mobile-oauth, PATCH /api/users/me** (pages/api/preferences.ts, pages/api/notifications/register-device.ts, pages/api/users/[publicId]/block.ts, pages/api/users/blocked.ts, pages/api/auth/mobile-oauth.ts, pages/api/users/me.ts) — Zero references in this repo's frontend; presumed consumers are the Expo mobile app (not in repo) — verify against the app codebase before deleting. Note the web UI offers NO user-block feature even though chat exists on web.
- **POST /api/admin/users/create** (pages/api/admin/users/create.ts) — Zero frontend consumers — admin creation is curl-only by design per comments; flagging for awareness, not deletion.
- **components/ui Banner export** (components/ui/Banner.tsx, components/ui/index.ts, tests/ui/Banner.test.tsx) — Exported from components/ui/index.ts:46 but imported only by its own tests; no app page/component uses it.
- **Repo hygiene: tracked non-source files** (mortly.pptx, posthog-setup-report.md, test-results/.last-run.json) — mortly.pptx (157KB binary deck) and posthog-setup-report.md are committed; test-results/.last-run.json is tracked despite /test-results being gitignored (added before the rule). coverage/ (4.8MB) and tsconfig.tsbuildinfo (1.5MB) exist locally but are correctly gitignored/untracked.
- **seed clearAll does not clear processed_stripe_events** (prisma/seed.ts) — clearAll (lines 124-141) wipes every other table but leaves ProcessedStripeEvent rows; 'All tables cleared' log is inaccurate. Dev-only impact.
- **Borrower dashboard error banner + hardcoded `const error: string | null = null`** (pages/borrower/dashboard.tsx) — error is hardcoded null at line 72, so the role=alert banner at lines 154-161 can never render; should be wired to a real context error state instead of removed.
- **Activity StatusFilter "FLAGGED"** (pages/admin/activity.tsx) — Parsed in the enum at lines 33 and 124-128 but no FilterChip renders it and no row carries that status.
- **Permanently disabled stub buttons: inbox '내보내기' export, people '⬇ CSV' and '+ 초대', reports/activity '⬇ CSV'** (pages/admin/inbox.tsx, pages/admin/people.tsx, pages/admin/reports.tsx, pages/admin/activity.tsx) — inbox.tsx:222-224, people.tsx:306-313, reports.tsx:244-248, activity.tsx:434-438 — rendered disabled with no handler; either implement (lib/csvExport.ts exists) or remove before launch.
- **lib/fonts.ts** (lib/fonts.ts) — 2-line comment-only module; fonts load via _document.tsx CDN links.
- **Broker.profilePhoto column + API write path** (prisma/schema.prisma, pages/api/brokers/profile.ts, components/broker/BrokerDataContext.tsx) — schema.prisma:136 column; pages/api/brokers/profile.ts:65-68 accepts it; BrokerDataContext.tsx:39 types it. No form sets it, no component renders it, borrower-facing selects omit it (pages/api/requests/[id].ts:32-48), seed.ts never populates it.
- **assertHttpsUrl / assertOptionalHttpsUrl validators** (lib/validate.ts) — lib/validate.ts:100-117; only consumer in the entire repo is the dead profilePhoto branch (pages/api/brokers/profile.ts:67). Becomes fully dead if profilePhoto is removed.
- **Locale keys broker.introMessageLabel / introMessageHint / introMessageTip / introMessagePlaceholder** (public/locales/en/common.json, public/locales/ko/common.json) — Present at lines 492-495 in both files; zero t() references anywhere in pages/, components/, lib/, or tests/. Leftover from a removed broker intro-message composer (current flow at pages/broker/requests/[id].tsx:94-132 starts the chat directly). Verify the Expo mobile app (separate repo) does not consume these before deleting.
- **/api/preferences endpoint (GET/PUT locale/theme/emailNotifications/pushNotifications)** (/Users/hyunseokcho/Documents/GitHub/mortly/pages/api/preferences.ts) — Zero callers in pages/, components/, or lib/ (repo-wide grep; only .next build validators reference the route). No UI reads or writes these preferences; preferences.locale consequently is never set, which causes the always-Korean password-reset email. Possible mobile-app caller cannot be verified from this repo (app.json is an empty Expo stub) — verify before deleting.
- **Unreachable error banner on borrower dashboard** (/Users/hyunseokcho/Documents/GitHub/mortly/pages/borrower/dashboard.tsx) — dashboard.tsx:72 hardcodes `const error: string | null = null;`, making the role=alert banner at lines 154-161 dead — no code path can set it.
- **_count.reviews in borrower profile types** (/Users/hyunseokcho/Documents/GitHub/mortly/pages/borrower/profile.tsx, /Users/hyunseokcho/Documents/GitHub/mortly/components/borrower/BorrowerDataContext.tsx) — profile.tsx:22 requires _count.reviews and BorrowerDataContext.tsx:33 declares reviews?: number, but /api/borrowers/profile (pages/api/borrowers/profile.ts:17-23) only selects borrowerRequests + conversations counts; no Review model exists in prisma/schema.prisma. Vestige of a removed reviews feature; the stats grid is also grid-cols-3 (profile.tsx:157) with only 2 cards, leaving an empty column.
- **session.user.needsNameEntry on the web client** (/Users/hyunseokcho/Documents/GitHub/mortly/lib/auth.ts) — Computed into the JWT/session (lib/auth.ts:260, 333) but no web page or component consumes it (grep: only api/users/me.ts and api/auth/mobile-oauth.ts reference it). Dead weight on web until a name-entry step is built (see finding).
- **Mobile notifications toggle button whose dropdown can never render below md** (/Users/hyunseokcho/Documents/GitHub/mortly/components/Navbar.tsx) — Navbar.tsx:455-470 toggles noticeOpen, but the dropdown (241-293) lives inside the `hidden items-center gap-1 md:flex` wrapper (184); on mobile the button is functionally dead UI.
- **Empty template interpolation `${""}` in broker card className** (/Users/hyunseokcho/Documents/GitHub/mortly/pages/borrower/brokers/[requestId].tsx) — Lines 167-169: className={`card-elevated hover:shadow-xl ... ${""}`} — vestigial conditional left as an empty string interpolation.
- **Redundant double-stacked responsive variant lg:md:w-96** (/Users/hyunseokcho/Documents/GitHub/mortly/pages/broker/messages.tsx) — Line 357: `lg:md:w-96` compiles to nested min-width queries equivalent to the already-present base `lg:w-96` (line 355); pure noise.
- **components/RequestCard.tsx (entire component)** (/Users/hyunseokcho/Documents/GitHub/mortly/components/RequestCard.tsx) — No imports anywhere in pages/components (grep verified); dashboard defines its own inline RequestCard. Its detail link points to /requests/${publicId} (RequestCard.tsx:116) — no pages/requests route exists, so it would 404 if ever revived.
- **Dashboard error-banner branch** (/Users/hyunseokcho/Documents/GitHub/mortly/pages/borrower/dashboard.tsx) — error is hardcoded null at dashboard.tsx:72, making the alert at lines 154-161 unreachable.
- **ConsultationStepper hasActiveConversation branch** (/Users/hyunseokcho/Documents/GitHub/mortly/components/ConsultationStepper.tsx) — Lines 24-31: both the hasActiveConversation and plain hasConversation branches return identical tuples; the parameter is effectively unused.
- **/api/preferences endpoint (web)** (/Users/hyunseokcho/Documents/GitHub/mortly/pages/api/preferences.ts) — No fetch('/api/preferences') consumer in pages/components/lib (grep verified). May serve the mobile app (x-mortly-mobile pattern exists in users/me.ts) — verify before removing.
- **BorrowerProfile._count.reviews field** (/Users/hyunseokcho/Documents/GitHub/mortly/pages/borrower/profile.tsx, /Users/hyunseokcho/Documents/GitHub/mortly/components/borrower/BorrowerDataContext.tsx) — Declared in interfaces (profile.tsx:22, BorrowerDataContext.tsx:33) but /api/borrowers/profile never selects it; no Review model exists in schema.prisma.


## Missing UX states inventory

| Page | Missing state |
|---|---|
| pages/login.tsx | No error state if the post-login GET /api/auth/session fails or returns no role; the user is silently routed to '/' instead of a dashboard (lines 78-88). Loading and form-error states exist. |
| pages/signup.tsx | No warning/error UI when the API returns emailSent=false (verification email send failed); the page redirects to /verify-email unconditionally (lines 86-102). |
| pages/borrower/* and pages/broker/* (BorrowerShell/BrokerShell) | Auth gate is client-side: an anonymous/wrong-role user sees a generic 'Loading...' state then a redirect; no SSR not-authorized/redirect state and no distinct empty/error state for the guard itself (BorrowerShell.tsx:104-118, BrokerShell.tsx:132-143). |
| pages/select-role.tsx | Has loading spinner and error banner (acceptable). No explicit state for a stale-session race after update() (relies on push to dashboard). |
| pages/reset-password.tsx | No router.isReady guard (line 92): 'Invalid Link' error card flashes on every load — including valid token links — until router.query hydrates; no loading state for that window. |
| pages/verify-email.tsx | No state for a missing email query param (line 11): direct navigation renders the form with a blank email in the subtitle and every submission fails with a generic 'Invalid code' — no redirect or guidance. |
| pages/verify-email.tsx | No error state for non-429 resend failures (lines 100-115): 400/500/502 from /api/auth/resend-code display the success banner 'New code sent.' instead of an error. |
| pages/verify-email.tsx | No distinct UI for 429 rate-limit on code submission (lines 77-85): throttled responses are rendered as 'Invalid code. Try again.', encouraging more attempts. |
| pages/forgot-password.tsx | No localized rate-limit state: a 429 surfaces as the raw English server message in the generic error box (lines 27-34); otherwise loading/success/error states are present. |
| /borrower/request/new | Unauthenticated / wrong-role state: page returns null (blank screen) instead of redirecting — BorrowerShell's /login redirect never mounts (pages/borrower/request/new.tsx:51) |
| /borrower/request/new | No per-field validation feedback on steps 1-2: the Next button is silently disabled with no message indicating which required field is missing |
| /borrower/request/[id] | Initial-load error state: fetch failure (non-404) leaves a permanent skeleton; the error banner at line 188 is unreachable because of the early return at lines 141-147; no retry affordance |
| /borrower/request/new | No offline/network-failure differentiation on submit — generic banner only; draft is preserved (good) but the user isn't told it was |
| /broker/requests/[id] (pages/broker/requests/[id].tsx:64-92,145-169) | 403 (unverified broker) is collapsed into the generic 'request not found' error — no verification-required state like the browse page has; also no distinct 404-vs-network-error differentiation |
| /broker/requests (pages/broker/requests/index.tsx) | No pagination/'load more'/'showing X of Y' state although the API returns pagination metadata; list silently truncates at 20 |
| /broker/requests/[id] CTA region (pages/broker/requests/[id].tsx:339-422) | No loading state while broker profile resolves — defaults (BASIC/0 credits) can flash the wrong 'no credits' card |
| /broker/profile (pages/broker/profile.tsx:96-100,189-204) | On profile load failure the editable form still renders with empty fields plus an enabled Save button (server rejects with 400, but no retry affordance or read-only/blocked state) |
| /broker/dashboard (pages/broker/dashboard.tsx via BrokerDataContext.tsx:210-212) | Counter/list fetch failures are swallowed (catch keeps previous/zero values) — no error state or stale-data indicator; a broker with a dead network sees zeros labeled 'All caught up' |
| /broker/onboarding (pages/broker/onboarding.tsx:82-116) | No duplicate-submit protection beyond the disabled flag if the 409 'profile already exists' path hits (error shape mismatch means the 409 reason is never shown); no unsaved-changes guard |
| /borrower/messages | Failed thread fetch renders null in the chat pane (line 796 ternary fallback) — no inline error/retry UI, only a transient dismissible toast |
| /borrower/messages | Conversation-list fetch failure leaves conversations=[] and renders the 'no conversations' empty state — error indistinguishable from genuinely having no conversations (toast aside) |
| /broker/messages | Conversation-list fetch failure renders the 'no conversations' empty state (same pattern); thread fetch failure shows the 'noMessages' empty state alongside the error banner |
| /borrower/messages and /broker/messages | No 'load older messages' state for threads exceeding 50 messages (API hasMore unused); no list pagination beyond 50 conversations |
| /borrower/messages and /broker/messages | No realtime-disconnected/offline indicator — silent degradation to 5s polling with no user-visible signal |
| /borrower/messages and /broker/messages | No per-message send-failure state (failed sends restore the input text but the user sees no inline failed-message indicator); message restore overwrites anything typed since the failed send (borrower:331, broker:311) |
| pages/broker/billing.tsx | Error state for failed POST /api/stripe/create-checkout — non-ok response and network throw are console.error only (lines 240-243, 299-303); user clicks Upgrade and nothing happens |
| pages/broker/billing.tsx | Error state for failed GET /api/brokers/profile — catch silently renders the page as FREE tier with 0 credits (lines 179-184), misrepresenting a paying broker's plan |
| pages/broker/billing.tsx | Distinct error state for failed GET /api/stripe/invoices — failure is indistinguishable from the genuine 'no billing history' empty state (lines 187-196, 597-609) |
| pages/pricing.tsx | Loading state during auth redirect — returns null (line 45-47) producing a blank page flash for unauthenticated/borrower visitors before redirect completes |
| /admin (root) | No index page or redirect — typing /admin yields a 404; all links target /admin/inbox directly. |
| /admin/people | Error state: SWR error is never destructured/rendered (people.tsx:124-137); list-fetch failure shows the '조건에 맞는 사용자가 없습니다' empty state. |
| /admin/activity | Error state: fetchPage maps !res.ok to {data:[]} (activity.tsx:175-176) so failures render the empty-feed message; no retry control. |
| /admin/reports | Error state for the list and the summary chips: load() returns silently on !r.ok (reports.tsx:116) and refreshSummary likewise (reports.tsx:135-138); failures look like zero reports. |
| /admin/system | Error state for settings fetch (system.tsx:74-87 swallows failure → blank values rendered as if real) and audit fetch (89-103 → misleading 'no admin actions yet' empty state). Audit tab also lacks pagination/loading-more states beyond the first 25 rows. |
| /admin/activity conversation drawer | No 'load older messages' control — drawer shows at most the latest 50 (API returns hasMore/nextCursor which the drawer ignores; only /admin/conversations/[id] paginates). |
| /admin/inbox | No feedback state for the two-admin 202 PENDING_SECOND_REVIEW response — rendered as plain success; row silently reappears. |
| MaintenanceGate (_app.tsx:74-115) | No loading state: real page content renders until `checked` becomes true, flashing the app to users before the maintenance screen replaces it. |
| pages/_app.tsx (MaintenanceGate) | Error state: fetch("/api/maintenance").catch(() => {}) silently swallows failures and treats them as 'not in maintenance' — no retry/error handling, and children render before the check resolves (checked flag gates only the maintenance branch) |
| pages/broker/billing.tsx | The webhook-timeout state exists (15s poll) but its user-facing message renders a raw i18n key (broker.planUpdatePending missing from catalogs), so the fallback state is effectively unreadable |
| pages/admin/system.tsx (manual tab) | Manual tab has no content — permanent placeholder text instead of an empty/coming-soon state component (line 327) |
| components/Navbar.tsx (notices bell dropdown) | No loading state while /api/notices is fetched (dropdown shows 'No notifications' during first load) and no error state — fetch failures are silently swallowed (Navbar.tsx:62-64), so a 500 looks identical to 'no notifications'. Mark-as-read failures are also silent with optimistic UI never rolled back (Navbar.tsx:95-106). |
| components/Navbar.tsx (notices bell dropdown) | No overflow handling: GET /api/notices caps at 50 with no pagination and there is no 'view all notifications' page; older notices become unreachable. |
| pages/pricing.tsx | Returns null (blank white page, no spinner/skeleton) while session status==='loading' and during the redirect for logged-out/borrower visitors (lines 45-47); also the SSG HTML is empty so first paint is always blank. |
| pages/_app.tsx (MaintenanceGate) | App content renders before the async /api/maintenance check resolves (flash of full app during maintenance); fetch failure is swallowed and fails open with no indicator (lines 81-97). |
| components/Navbar.tsx | Notices/unread fetch failures are silently swallowed (lines 62-64) — no error or retry state for the notification dropdown; markAsRead failure leaves optimistic state permanently (lines 95-106). |
| pages/index.tsx | Live summary card empty state is a bare '—' glyph (lines 141-145) with no explanatory text; if the build-time DB query fails (lines 349-351) the marquee section silently disappears with no fallback content. |
| pages/contact.tsx | No contact form at all (mailto link only) — no submit/loading/success/error states exist; there is also no /api/contact endpoint. |
| pages/admin/system.tsx (settings form) | When system_settings table has no rows (e.g. clean-seeded production), GET /api/admin/settings returns {} and the form renders blank values — the effective code DEFAULTS from lib/settings.ts:5-16 are never shown, and saving the blanks would persist invalid empty strings. |
| pages/borrower/messages.tsx and pages/broker/messages.tsx (cron-closed threads) | Conversations closed by /api/cron/auto-close-conversations contain no isSystem explanation message and trigger no notification, so the thread just appears CLOSED with no reason shown (manual closes do insert a system message). |
| pages/borrower/dashboard.tsx (expired requests) | No state/explanation for requests flipped to EXPIRED by cron — they silently drop out of the 'active' count (lines 79-97) with no banner, notification, or re-open CTA. |
| pages/_app.tsx maintenance gate | Fail-open on fetch error (lines 82-87: .catch(() => {}) leaves maintenance=false) — if /api/maintenance errors during an actual maintenance window, users see the broken app instead of the maintenance screen. No retry/stale indicator. |
| pages/borrower/dashboard.tsx | Error state — banner exists but is unreachable (error hardcoded null at line 72); API failure renders 'no requests' empty state. Loading and empty states present. |
| pages/borrower/request/[id].tsx | Error state — non-404 fetch failure leaves infinite skeleton (line 141 guard); error markup at 188 unreachable when request is null. |
| pages/borrower/messages.tsx | Conversation status (CLOSED) not refreshed by the 5s poll, only by Realtime sync — stale 'send' input possible when Realtime is unconfigured; deep-link selection does not update the URL when clicking the list. |
| pages/broker/messages.tsx | Same poll/status gap as borrower messages; list-selection unread rollback on fetch failure not implemented (borrower side has it, broker selectConversation lines 263-279 lacks the rollback). |
| pages/broker/billing.tsx | Error state for checkout/portal mutations (console-only); invoices fetch failure shows 'no billing history' empty state. |
| pages/broker/requests/[id].tsx | FREE-tier gating state (upgrade card) — shows enabled respond CTA with wrong copy. |
| pages/verify-email.tsx | Error state for resend failures other than 429 — reported as success. |
| pages/reset-password.tsx | router.isReady loading guard — 'Invalid Link' flashes for valid tokens. |
| pages/pricing.tsx | Logged-out state — page redirects unauthenticated visitors to /signup?role=broker and renders null during auth resolution (no public pricing view; confirm intentional). |
| pages/admin/people.tsx | Error state — SWR error not destructured; failures render 'no users match' empty state. Mobile layout (fixed 7-col grid). |
| pages/admin/reports.tsx | List error state — load() returns silently on !ok showing 'no reports' empty state; summary fetch failure leaves zeroed counts. Mobile layout (1fr_440px grid). |
| pages/admin/activity.tsx | List error state — failed streams coerced to empty arrays → 'no activity' empty state. Mobile layout (1fr_520px grid). |
| pages/admin/system.tsx | Settings/audit fetch error states (blank fields / 'no actions recorded' on failure); audit timestamps lack dates (HH:MM only); Manual tab is a stub. |
| pages/admin/inbox.tsx | Mobile layout — fixed grid-cols-[1fr_400px] with always-mounted drawer; export button disabled stub. Loading/error/empty all present. |
| components/Navbar.tsx | Mobile presentation for the notifications dropdown (dead button); mark-as-read failure silently keeps optimistic read state. |
| pages/_app.tsx (MaintenanceGate) | None notable — fetch failure fails open by design; maintenance screen localized. |
| pages/404.tsx / pages/500.tsx | None — localized, styled, valid links. |
| pages/broker/profile.tsx | Dedicated fetch-failure state: when GET /api/brokers/profile fails (lines 96-100 set error only), the editable form still renders beneath the banner with all-blank values, inviting an accidental overwrite save; no retry affordance. |
| pages/borrower/brokers/[requestId].tsx | On fetch error (lines 122-126) the 'no introductions yet' empty state (lines 152-158) also renders because conversations stays [], showing contradictory error + empty messaging; no retry button. |
| pages/borrower/messages.tsx and pages/broker/messages.tsx (chat composer) | No affordance or advisory for the document-exchange case: no attach control, no warning state when users are about to share sensitive material, and pasted document links render as non-clickable plain text (borrower:741-743, broker:633-634) with no preview/link state. |
| /borrower/request/new (pages/borrower/request/new.tsx:51) | Unauthenticated / wrong-role state: returns bare null → permanently blank page; no redirect, no message (BorrowerShell never mounts to perform its redirect). |
| /borrower/dashboard (pages/borrower/dashboard.tsx:72,154-161,214-230) | Error state: error is hardcoded null so the banner is unreachable; API failures render the misleading 'No requests yet' empty state because BorrowerDataContext swallows fetch errors (BorrowerDataContext.tsx:181-183) and sets loaded=true regardless (line 200). |
| /verify-email (pages/verify-email.tsx:11,106-115,159) | (1) No state for missing ?email= query param — subtitle interpolates an empty string and submit posts email=undefined yielding a generic 'invalid code' error. (2) Resend failure state: any non-429 error (400/500/502) is rendered as the 'code sent' success message. |
| /borrower/profile (pages/borrower/profile.tsx:256-330) | OAuth-only account state: the Change Password form renders for Google/Apple accounts with no passwordHash; submission always fails with an untranslated 400 ('Password change not available for this account', api/borrowers/profile.ts:68). Should be hidden or replaced with an explanatory state. |
| /borrower/profile (pages/borrower/profile.tsx:156-167) | Stats grid declares grid-cols-3 but renders only 2 cards (requests, conversations) — third column permanently empty (leftover from removed reviews stat). |
| pages/broker/messages.tsx | Error state for conversation-list load failure: setError at 137-138 is only rendered inside the open-thread pane (655-666); with no thread open (default, and the entire mobile list view) a failed fetch displays the 'no conversations' empty state (375-399) instead of an error. |
| pages/broker/billing.tsx | Error states for checkout (240-243, 299-301) and customer-portal (317-319) failures — only console.error, no user-visible feedback; spinner simply stops. |
| pages/broker/billing.tsx | Distinct error state for invoice fetch failure: silent catch (193-195) makes a 500 render the 'no billing history' empty state (597-609). |
| pages/pricing.tsx | Loading state: returns null during auth resolution and redirects (45-47), giving a blank white page flash for unauthenticated/borrower visitors before redirect completes. |
| pages/borrower/messages.tsx | Error toast (436-448) has no max-width/wrap constraint — fixed top-24 left-1/2 element can exceed a 360px viewport for long error strings. |
| components/borrower/RequestFormLayout.tsx | Mobile users never see the privacy callout (line 162: hidden ... lg:block); only the step-3 inline reminder (RequestForm.tsx:893-900) survives below lg. |
| /borrower/dashboard | Error state for failed data fetch (error hardcoded null; API failure renders the 'no requests' empty state instead) |
| /borrower/request/[id] | Load-error state — any non-404 failure (403/500/network) leaves an infinite skeleton; also no 'closed/expired' explanatory state beyond the badge |
| /borrower/brokers/[requestId] | Distinct not-found/forbidden state (generic 'failed to load' shown alongside the empty 'no intros yet' block); no pending-approval context if request not yet OPEN |
| /borrower/profile | Retry affordance after profile fetch failure (error banner renders but form shows empty values with no reload action) |


## i18n gap list

- `pages/login.tsx:64-68 (key auth.tooManyAttempts)` — Used for the RATE_LIMITED error message but missing from BOTH public/locales/ko/common.json and en/common.json. Renders via the inline English fallback, so Korean users see English text on rate-limit. *(affects: ko+en (key absent; English fallback only))*
- `components/Layout.tsx:26, components/borrower/BorrowerShell.tsx:132, components/broker/BrokerShell.tsx:157 (key misc.skipToContent)` — Skip-to-content a11y link key missing from both locale files; falls back to English 'Skip to content' for Korean users. *(affects: ko+en (key absent; English fallback only))*
- `components/borrower/BorrowerShell.tsx:318,396 and components/broker/BrokerShell.tsx:362,444 (key nav.loggingOut)` — Sign-out progress label key missing from both locale files; falls back to English 'Signing out...' for Korean users. *(affects: ko+en (key absent; English fallback only))*
- `public/locales/ko/common.json + public/locales/en/common.json (key auth.tooManyAttempts, used at pages/login.tsx:66)` — Key missing from BOTH locale files; the inline English default 'Too many sign-in attempts...' renders even in the Korean UI when login is rate-limited. *(affects: ko+en)*
- `pages/forgot-password.tsx:29,34 and pages/reset-password.tsx:46 displaying raw API messages from pages/api/auth/forgot-password.ts:31,77 and pages/api/auth/reset-password.ts:28,32,41,67` — API error messages are hardcoded English strings ('Too many requests. Please try again later.', 'Invalid or expired reset token', 'Password must be at least 8 characters', 'Internal server error') and both pages render data.message verbatim — Korean users see untranslated English errors for 400/429/500 cases. *(affects: ko)*
- `pages/api/auth/forgot-password.ts:63-67 + pages/api/auth/signup.ts:89` — Password reset email locale comes from preferences.locale, which is never written at signup (only legal metadata) and the API ignores the requester's site locale — English-site users receive the Korean email template by default. *(affects: en)*
- `pages/api/auth/forgot-password.ts:58` — Reset URL has no /en locale prefix; with defaultLocale 'ko', English users always land on the Korean /reset-password page from the email link. *(affects: en)*
- `pages/login.tsx:73 (errors thrown from lib/auth.ts:93,111,115,119,127,131)` — setError(result.error) renders raw English NextAuth authorize errors ('Invalid email or password', 'Your account has been suspended...', 'Your account has been banned.') untranslated in the Korean UI — affects the unverified/credentials flow feeding into this area. *(affects: ko)*
- `pages/borrower/request/new.tsx:90 and components/borrower/RequestFormLayout.tsx:108` — Key request.stepLabel missing from BOTH public/locales/ko/common.json and en/common.json; hardcoded fallback 'STEP {{n}} / {{total}}' renders in both languages
- `components/borrower/RequestFormLayout.tsx:89` — Key request.stepBasicsHint missing from both locales; English fallback 'Category & products' shown to Korean users
- `components/borrower/RequestFormLayout.tsx:93` — Key request.stepDetailsHint missing from both locales; English fallback 'Location, income, timeline' shown to Korean users
- `components/borrower/RequestFormLayout.tsx:97` — Key request.stepReviewHint missing from both locales; English fallback 'Confirm and post' shown to Korean users
- `components/borrower/RequestFormLayout.tsx:164` — Key request.privacyEyebrow missing from both locales; KOREAN fallback '개인정보' is shown to English users *(affects: en)*
- `components/borrower/RequestFormLayout.tsx:167-170` — Key request.privacy missing from both locales; English fallback 'Your contact details are never shared. All chat stays on mortly.' shown to Korean users *(affects: ko)*
- `components/borrower/RequestFormLayout.tsx:188` — Key request.summary missing from both locales; KOREAN fallback '요청 요약' is shown to English users *(affects: en)*
- `components/borrower/RequestFormLayout.tsx:192-195` — Key request.summaryNote missing from both locales; English fallback 'This summary updates as you fill out the form.' shown to Korean users *(affects: ko)*
- `components/borrower/RequestFormLayout.tsx:204-207` — Key request.summaryPlaceholder missing from both locales; English fallback shown to Korean users *(affects: ko)*
- `components/borrower/RequestFormLayout.tsx:246` — Key request.locationSection missing from both locales; English fallback 'Location' shown to Korean users *(affects: ko)*
- `components/borrower/RequestFormLayout.tsx:252` — Key request.timelineSection missing from both locales; English fallback 'Timeline' shown to Korean users *(affects: ko)*
- `public/locales/ko/common.json key request.product.commLoc` — Value is untranslated English 'Line of Credit' (identical to en) — only request.* key with identical ko/en values; shown in the commercial product checklist *(affects: ko)*
- `lib/validate.ts:30-36, pages/api/requests/index.ts:142-194, pages/api/requests/[id].ts:186-190, lib/withAuth.ts:101-103 → rendered via pages/borrower/request/new.tsx:62 and components/RequestForm.tsx:337` — All server error strings (validation messages, max-active-requests cap, 409 edit lockdown, 429 rate limit) are hardcoded English and displayed verbatim in the form's error banner in the Korean UI *(affects: ko)*
- `components/RequestForm.tsx PROVINCES (13-27) and broker province lists` — Province names are English-only literals used as both value and label; never localized to Korean despite ko being the default locale *(affects: ko)*
- `public/locales/en/common.json + public/locales/ko/common.json (verified programmatically)` — 49 broker-area keys missing from BOTH files, so inline code fallbacks render regardless of locale: broker.brokerFallback, broker.actionRequired, broker.rejectedTitle, broker.rejectedDesc, broker.noCreditsSubtitle, broker.dashboardEyebrow, broker.welcomeTo, broker.welcomeSuffix, broker.findRequests, common.dismiss, broker.newRequestsWeek, broker.tapToReview, broker.unreadAwaiting, broker.noUnread, broker.latestRequests, broker.newRequestsTitle, broker.seeAll, broker.allCaughtUpDesc, broker.goToRequests, broker.respond, messages.loadingConversations, broker.activeEyebrow, broker.requestsEyebrow, broker.newCount, common.refresh, broker.includeResponded, broker.col.id, broker.col.type, broker.col.region, broker.col.timeline, broker.col.responses, broker.col.posted, broker.onlyUnresponded, broker.openForResponse, broker.responsesSuffix, broker.detailsEyebrow, broker.requestDetailsTitle, broker.respondEyebrow, broker.startDirectThread, broker.unlimitedPlanRespond, broker.creditWillBeDeducted, broker.backToList, misc.skipToContent, nav.loggingOut, broker.requestContext, broker.noRequestContext, broker.viewFullRequest, broker.noFullRequestLink, common.close
- `pages/broker/dashboard.tsx:184-189, 288-295, 376-377; pages/broker/requests/[id].tsx:152, 302, 372, 399, 408; components/broker/RequestContextPanel.tsx:159, 186` — Korean inline fallbacks ('전문가 대시보드', '오늘도 반갑습니다,', '님.', '상담 찾기', '최신 요청', '새로운 상담 요청', '모두 보기', '상담 시작', '상담 요청', '상세 정보', '응답하기', '목록으로', '전체 요청 보기') render verbatim in the English locale because the keys are missing from en/common.json *(affects: shown to EN users)*
- `pages/broker/requests/index.tsx:228, 268, 282-288, 376, 485, 548-549; pages/broker/requests/[id].tsx:374-389; pages/broker/dashboard.tsx:260-279` — English inline fallbacks ('Refresh', table headers ID/Type/Region/Timeline/Responses/Posted, 'Only unresponded', 'Include requests I've responded to', 'Open', 'responses', '1 credit will be used. {{remaining}} remaining.', 'Start a direct conversation', 'New requests · this week', '{{count}} unread messages') render verbatim in the Korean (default) locale because the keys are missing from ko/common.json *(affects: shown to KO users)*
- `components/broker/BrokerShell.tsx:292` — Hardcoded template `${subscriptionTier} · PRO` — untranslated and incorrect for non-PRO tiers
- `components/broker/BrokerShell.tsx:184 and :296` — aria-label="Broker navigation" hardcoded English (not via t()) in both the mobile dialog and nav element *(affects: en only)*
- `pages/broker/requests/index.tsx:465; pages/broker/dashboard.tsx:344` — aria-label="New" on the unseen-dot indicator hardcoded English *(affects: en only)*
- `pages/broker/profile.tsx:299` — Phone placeholder "(416) 555-1234" hardcoded; onboarding.tsx uses t('onboarding.placeholderPhone') for the same field *(affects: en only)*
- `pages/broker/requests/[id].tsx:30-36` — formatDate always uses toLocaleDateString('en-CA') — posted dates render in English month format even in the Korean locale (relativeTime is locale-aware but its >7-day fallback in dashboard.tsx/requests pages is locale-aware while the detail page's formatDate is not)
- `pages/broker/onboarding.tsx:15-26, pages/broker/profile.tsx:20-31, pages/broker/requests/index.tsx:22-33` — Province names (Ontario, British Columbia, …) shown untranslated in Korean UI dropdowns/filters *(affects: en only)*
- `pages/api/conversations/index.ts:243 (and other API error strings surfaced raw, e.g. requests/[id].tsx:108 setError(data.error))` — Server error messages ('Free plan brokers cannot message clients. Please upgrade your plan.', validation messages) are English-only and displayed verbatim to Korean users in the detail-page error alert *(affects: en only)*
- `pages/broker/requests/index.tsx:58-60 vs pages/broker/dashboard.tsx:33-35` — Inconsistent English relative-time suffixes between duplicated relativeTime helpers ('3m'/'3h' on browse vs '3m ago'/'3h ago' on dashboard/detail)
- `pages/borrower/messages.tsx:683-684, components/broker/RequestContextPanel.tsx:61,87,211` — Key borrower.requestContext / broker.requestContext missing from BOTH public/locales/ko/common.json and en/common.json — English fallback 'Request context' shown to Korean users *(affects: ko)*
- `pages/borrower/messages.tsx:819, pages/broker/messages.tsx:761, components/broker/RequestContextPanel.tsx:216` — Key common.close missing from both locale files — fallback 'Close' shown to Korean users (aria-labels) *(affects: ko)*
- `components/broker/RequestContextPanel.tsx:65-68` — Key broker.noRequestContext missing from both locales — English fallback 'Select a conversation to see the request behind it.' shown to Korean users *(affects: ko)*
- `components/broker/RequestContextPanel.tsx:159` — Key broker.detailsEyebrow missing from both locales — KOREAN fallback '상세 정보' shown to English users *(affects: en)*
- `components/broker/RequestContextPanel.tsx:186` — Key broker.viewFullRequest missing from both locales — KOREAN fallback '전체 요청 보기' shown to English users *(affects: en)*
- `components/broker/RequestContextPanel.tsx:190-193` — Key broker.noFullRequestLink missing from both locales — English fallback shown to Korean users *(affects: ko)*
- `pages/broker/messages.tsx:460-462` — Hardcoded English string 'No messages yet' (not via t()) in conversation list preview *(affects: ko)*
- `pages/broker/messages.tsx:663` — Hardcoded English string 'Dismiss' in error banner (borrower page uses t('misc.dismiss')) *(affects: ko)*
- `pages/broker/messages.tsx:85` — formatRelativeTime returns hardcoded 'now' (borrower page uses t('chat.justNow')) *(affects: ko)*
- `pages/broker/messages.tsx:451-453 and 544-545` — Hardcoded English connector ' in ' between request title and province ('Residential Request in BC') *(affects: ko)*
- `pages/broker/messages.tsx:553-562` — Raw ConversationStatus enum value rendered untranslated ('ACTIVE'/'CLOSED') in the chat-header status chip *(affects: ko)*
- `lib/requestConfig.ts:105-111 (used by both messages pages)` — getRequestTitle returns hardcoded English 'Commercial Request'/'Residential Request' — appears in conversation list rows and chat headers for Korean users *(affects: ko)*
- `pages/borrower/messages.tsx:61-74, pages/broker/messages.tsx:62-75` — Dates/times formatted with hardcoded 'en-CA' locale (toLocaleDateString/TimeString) — English month names ('Jun 13, 2026') in date dividers and timestamps regardless of UI language *(affects: ko)*
- `pages/api/admin/requests/[id].ts:110 and pages/api/admin/conversations/[id].ts:117-120` — System message bodies stored English-only ('This request/conversation has been closed by an administrator.') — Korean recipients see English in-thread notices *(affects: ko)*
- `pages/api/requests/[id].ts:124` — System message stored as combined bilingual string 'This request has been closed. / 이 요청이 종료되었습니다.' — both audiences see both languages instead of locale-appropriate text *(affects: ko)*
- `pages/broker/billing.tsx:255` — t("broker.planUpdating", { tier }) — key missing from BOTH public/locales/en/common.json and ko/common.json; raw key renders in the post-upgrade success banner *(affects: ko+en)*
- `pages/broker/billing.tsx:290` — t("broker.planUpdatePending", { tier }) — key missing from BOTH locales; raw key renders when webhook propagation exceeds 15s after an upgrade *(affects: ko+en)*
- `pages/broker/billing.tsx:474` — Hardcoded English string '{plan.discount} OFF' on plan cards; pricing.tsx correctly uses t("misc.off") for the same badge — Korean users see English 'OFF' on the billing page *(affects: ko)*
- `pages/broker/billing.tsx:388-394` — Cancellation banner date is formatted with hardcoded locale "en-CA" (English month names shown to Korean users); the pendingDowngrade banner two blocks below correctly uses router.locale (lines 410-413) *(affects: ko)*
- `pages/broker/billing.tsx:577` — Raw Stripe invoice status string ('paid', 'open', etc.) rendered untranslated in the billing-history table *(affects: ko)*
- `pages/broker/dashboard.tsx:146` — t("broker.actionRequired", "Action required") — key missing from both locale files; English inline default shows for Korean users *(affects: ko)*
- `pages/broker/dashboard.tsx:148-152` — t("broker.noCreditsSubtitle", "Upgrade your plan or buy more credits...") — key missing from both locale files; English default shows for Korean users, and the copy promises a 'buy more credits' flow that does not exist *(affects: ko)*
- `pages/admin/** + components/admin/** + lib/admin/** (systemic)` — 289 of the 318 t() keys used by the admin UI are missing from BOTH public/locales/ko/common.json and en/common.json (full scripted diff: all admin.inbox.*, admin.people.*, admin.activity.*, admin.userDetail.*, admin.brokerDetail.*, admin.conversationDetail.*, admin.reports.* (page-level), admin.system.* (new keys), admin.palette.*, admin.nav.*, admin.commandHint, admin.systemStatus, admin.dataStale, admin.shell.signOut, admin.request.field.*, plus common.retry, common.close, request.incomeTypeOther). Inline Korean fallbacks render in every locale — the admin panel is Korean-only even under /en. *(affects: both)*
- `lib/admin/inboxQueue.ts:162-171 (formatAge)` — Hardcoded Korean relative-time units '방금/분/시간/일' (used on inbox, activity, reports pages with hardcoded ' 전' suffix at inbox.tsx:387, activity.tsx:626/661, reports.tsx:295/375). *(affects: en)*
- `components/admin/UndoToast.tsx:72` — Hardcoded '실행 취소' undo button label, not via t(). *(affects: en)*
- `components/admin/primitives/AConfirmDialog.tsx:48,129-133` — Default cancelLabel hardcoded '취소'; the '(선택)'/'optional' suffix is chosen by string-comparing cancelLabel === '취소' — a locale-detection hack instead of t(). *(affects: both)*
- `pages/admin/inbox.tsx:44-48,390-398,483-516,522-577,601-632` — Hardcoded Korean throughout: KIND_META labels (상담/전문가/신고), row buttons '✓ 승인', broker field labels (브로커리지/지역/라이선스/티어/경력), report labels (신고자/신고 대상/사유), all DetailChecks and RecommendedAction copy, and summarize* strings (상업용/주거용/신규/우선/긴급 etc.) — none via t(). *(affects: en)*
- `pages/admin/people.tsx:372,544-550` — Hardcoded '명' counter suffix, activity summary '크레딧 N' / 'N 요청 · N 대화', and English literal 'Platform Admin' as a role subline. *(affects: both)*
- `pages/admin/activity.tsx:618-626,654-661,741,768` — Hardcoded 'N 전문가 응답', '상업용/주거용', 'N 메시지', '… 전', '신청인' label in the request drawer. *(affects: en)*
- `pages/admin/system.tsx:28-44` — SETTING_FIELDS labels are hardcoded English ('Platform name', 'FREE monthly', 'Expiry (days)' …) used as t() fallbacks for admin.setting_* keys (those keys DO exist in both locales), while GROUP_LABEL_KO is hardcoded Korean and the admin.system.group.* keys are missing from both locale files — mixed-language settings panel. *(affects: both)*
- `pages/api/admin/conversations/[id].ts:117-119 and pages/api/admin/requests/[id].ts:110` — User-facing system chat messages ('This conversation/request has been closed by an administrator.') stored as hardcoded English in Message.body — Korean borrowers/brokers see English administrative notices. *(affects: ko)*
- `components/admin/AdminShell.tsx:174,237,314` — Hardcoded 'ADMIN' rail label, '{name} · ADMIN' badge, and 'Admin' menu subtitle (English literals). *(affects: ko)*
- `public/locales/en/common.json (keys consultation.step1, consultation.step2, consultation.step3)` — EN catalog values are Korean: "상담 대기중" / "상담 진행중" / "상담완료" — only Hangul values in the entire EN file; rendered on borrower request detail via components/ConsultationStepper.tsx:109-122 *(affects: en)*
- `public/locales/ko/common.json (key request.product.commLoc)` — KO value is English "Line of Credit" while sibling personalLoc is translated ("개인용 LOC") — commercial product picker shows English in Korean UI *(affects: ko)*
- `pages/broker/dashboard.tsx:184-415 (~25 keys: broker.dashboardEyebrow, broker.welcomeTo, broker.findRequests, broker.seeAll, broker.respond, broker.latestRequests, broker.newRequestsTitle, broker.activeEyebrow, broker.activeConvos …)` — Keys absent from both catalogs; Korean inline fallbacks render in EN locale *(affects: en)*
- `pages/broker/requests/index.tsx:154,491 and pages/broker/requests/[id].tsx:152,302,372,399,408` — broker.requestsEyebrow/detailsEyebrow/respondEyebrow/backToList/respond missing from catalogs; Korean fallbacks shown in EN locale *(affects: en)*
- `pages/broker/requests/index.tsx:282-287,376,485,548` — broker.col.id/type/region/timeline/responses/posted, broker.onlyUnresponded, broker.openForResponse, broker.responsesSuffix missing; English fallbacks shown in KO locale (request table headers untranslated) *(affects: ko)*
- `pages/borrower/dashboard.tsx:185,206,240,487,590-594` — request.viewDetails, borrowerDashboard.noActive, status.title, borrowerDashboard.response(sPlural), common.open missing; English fallbacks shown in KO locale (catalog has these under different parents, e.g. borrowerDashboard.viewDetails — namespace drift) *(affects: ko)*
- `pages/borrower/dashboard.tsx:129-143,167,280-287,366-367,409,479,495,512-524` — borrower.dashboardEyebrow/welcome/actionRequired/activityEyebrow/… missing; Korean fallbacks shown in EN locale *(affects: en)*
- `pages/borrower/messages.tsx:683-684,819 and pages/broker/messages.tsx:573-574,761` — borrower.requestContext / broker.requestContext / common.close missing; English fallbacks ("Request context", "Close") shown in KO locale *(affects: ko)*
- `pages/broker/dashboard.tsx:236,260-277,320,406,415` — common.dismiss, broker.newRequestsWeek, broker.tapToReview, broker.unreadAwaiting, broker.noUnread, broker.goToRequests, messages.loadingConversations missing; English fallbacks shown in KO locale *(affects: ko)*
- `components/DeleteAccountSection.tsx:170,184` — settings.deleteAccountPasswordTitle/Placeholder missing; English-only fallbacks ("Confirm with your password", "Current password") in the account-deletion flow for KO users *(affects: ko)*
- `components/Layout.tsx:26, components/borrower/BorrowerShell.tsx:132, components/broker/BrokerShell.tsx:157` — misc.skipToContent missing; English-only "Skip to content" skip-link in KO locale *(affects: ko)*
- `components/borrower/BorrowerShell.tsx:318,396` — nav.loggingOut missing; English-only "Signing out…" in KO locale *(affects: ko)*
- `components/borrower/RequestFormLayout.tsx:89-97,108,164,188,246,252` — request.stepBasicsHint/stepDetailsHint/stepReviewHint/stepLabel/privacyEyebrow/summary/locationSection/timelineSection missing; English fallbacks in the KO request wizard *(affects: ko)*
- `components/RequestCard.tsx:112` — borrowerDashboard.response/responsesPlural missing at this call site; English fallback "response(s)" in KO locale *(affects: ko)*
- `266 admin.* keys across pages/admin/*.tsx and components/admin/* (e.g. pages/admin/activity.tsx:424-485, pages/admin/reports.tsx:227-468, pages/admin/system.tsx:126-151, components/admin/AdminShell.tsx:34-38,249)` — Keys missing from both catalogs; Korean fallbacks render in EN locale (admin.dataStale has English fallback rendering in KO) *(affects: both)*
- `pages/admin/inbox.tsx:45-47,387,391,484-489,507-543,565-631; pages/admin/reports.tsx:295,353-357,375; pages/admin/system.tsx:40-43; pages/admin/activity.tsx:618,621,626,650,661,741,768; pages/admin/people.tsx:372,549-550` — Raw hardcoded Korean strings outside t() entirely (badge labels, '… 전' suffixes, '✓ 승인', drawer field labels, static check labels) — untranslatable *(affects: en)*
- `components/admin/UndoToast.tsx:72; components/admin/primitives/ADrawerError.tsx:20,28; components/admin/primitives/AConfirmDialog.tsx:48,131` — Hardcoded Korean ("실행 취소", "불러올 수 없습니다", "다시 시도", default cancelLabel "취소") plus a cancelLabel==='취소' language-sniffing hack *(affects: en)*
- `lib/admin/inboxQueue.ts:165-170` — formatAge returns Korean-only relative time (방금/분/시간/일) regardless of locale *(affects: en)*
- `lib/admin/format.ts:34,73` — Admin date formatting hardcodes toLocaleString("en-US") *(affects: ko)*
- `pages/api/auth/forgot-password.ts:63-67` — Password-reset email locale read from user.preferences.locale which is never written anywhere (signup.ts:89 writes only legal metadata) — EN users always receive Korean reset emails; frontend pages/forgot-password.tsx:24 also omits locale from the POST body *(affects: en)*
- `pages/api/auth/forgot-password.ts:58` — resetUrl has no /en locale prefix — EN users land on the Korean reset-password page from the email link *(affects: en)*
- `pages/api/admin/requests/[id].ts:110` — System chat message "This request has been closed by an administrator." stored English-only; Korean users see English *(affects: ko)*
- `pages/api/admin/conversations/[id].ts:117-119` — System chat message "This conversation has been closed by an administrator. Reason: …" English-only with admin-typed (Korean) reason appended — mixed language for everyone *(affects: ko)*
- `pages/api/requests/[id].ts:124` — System chat message stored as concatenated bilingual string "This request has been closed. / 이 요청이 종료되었습니다." — both languages always shown instead of per-viewer localization *(affects: both)*
- `pages/api/cron/auto-close-conversations.ts:65-68` — Auto-close writes no system message in any language despite admin UI (pages/admin/activity.tsx:554) telling admins a closure message is delivered *(affects: both)*
- `lib/validate.ts:26-80 surfaced at pages/reset-password.tsx:51, pages/forgot-password.tsx:34, pages/broker/messages.tsx:310, pages/broker/requests/[id].tsx:108, pages/borrower/profile.tsx:87, pages/borrower/brokers/[requestId].tsx:82, pages/borrower/messages.tsx:331, pages/borrower/request/[id].tsx:135` — English-only API validation/error strings shown verbatim to KO users via setError(err.message)/data.error *(affects: ko)*
- `pages/borrower/messages.tsx:69, pages/broker/messages.tsx:70, pages/broker/requests/[id].tsx:31, pages/borrower/profile.tsx:236, pages/borrower/request/[id].tsx:20, components/RequestCard.tsx:24, pages/broker/billing.tsx:389` — toLocaleDateString("en-CA") hardcoded — English month-name dates in Korean UI (billing.tsx:410 on the same page is correctly locale-aware) *(affects: ko)*
- `pages/broker/dashboard.tsx:344, pages/broker/requests/index.tsx:465, components/Tooltip.tsx:50, components/ui/Banner.tsx:79, components/Toast.tsx:98, components/broker/BrokerShell.tsx:184,296, components/borrower/BorrowerShell.tsx:156,249` — Hardcoded English aria-label attributes ("New", "More information", "Dismiss", "Broker/Borrower navigation") — not localized for screen readers *(affects: ko)*
- `pages/login.tsx:188 and pages/signup.tsx:314-318` — signIn("google", { callbackUrl: "/select-role" }) without locale prefix — EN users land on Korean select-role after OAuth *(affects: en)*
- `components/Navbar.tsx:554, components/broker/BrokerShell.tsx:282, components/admin/AdminShell.tsx:287, components/borrower/BorrowerShell.tsx:233, components/DeleteAccountSection.tsx:53` — signOut callbackUrl "/login" or "/" without locale prefix — EN users dropped back to Korean *(affects: en)*
- `pages/api/stripe/create-checkout.ts:100-101 and pages/api/stripe/create-portal.ts:28` — Stripe success/cancel/return URLs `${origin}/broker/billing` lack the /en prefix; checkout session also doesn't set Stripe's locale param — EN brokers return from payment to Korean pages *(affects: en)*
- `components/Navbar.tsx:110-112 + next-i18next.config.js:6` — switchLocale never sets a NEXT_LOCALE cookie and localeDetection is false — EN choice does not persist across sessions or non-prefixed entry URLs *(affects: en)*
- `components/Navbar.tsx:278` — AdminNotice title/body rendered as stored — notices are single-language content shown to all users regardless of locale (authoring policy unverifiable from code) *(affects: both)*
- `lib/email.ts:83-126 (notifyAdminsOfNewAdmin)` — Admin-alert email is English-only (acceptable for internal admins, but inconsistent with Korean-only admin console) *(affects: ko)*
- `public/locales/ko/common.json (key footer.copyright)` — Value "mortly All rights reserved." identical English string in KO catalog — likely intentional brand line, flagged for review *(affects: ko)*
- `pages/api/messages/index.ts:137-141` — Push title fallback names 'Client' and 'Broker' are hardcoded English; a ko-locale device whose counterpart has no name set receives a Korean body under an English title. *(affects: ko)*
- `pages/api/conversations/index.ts:347` — Fallback brokerage name 'A broker' is English-only and interpolated into the Korean push body, producing mixed-language text like 'A broker에서 요청에 대해 메시지를 보냈습니다.' *(affects: ko)*
- `lib/email.ts (all templates) and lib/push.ts:123-174` — All email/push copy is hardcoded inline rather than via t()/common.json. Both ko and en variants ARE present (locale-switched), so users are covered, but the strings live outside the i18n pipeline and can drift from the app's translations. *(affects: ko+en (covered, out-of-pipeline))*
- `pages/api/notifications/register-device.ts:35-38 and pages/api/notices.ts error strings` — API error messages (e.g., 'This device is already registered to a different account...') are English-only; if surfaced raw in the ko mobile/web UI they are untranslated. *(affects: ko)*
- `lib/email.ts:83-127 (notifyAdminsOfNewAdmin)` — Admin broadcast email is English-only; acceptable for internal admin audience but noted for completeness. *(affects: ko)*
- `components/Layout.tsx:25-27 (skip link)` — Key misc.skipToContent is missing from BOTH public/locales/ko/common.json and en/common.json; the inline fallback 'Skip to content' renders in English for Korean users (accessibility string). *(affects: ko+en (key missing); ko users see English)*
- `pages/index.tsx:115 and components/LiveActivityMarquee.tsx:25` — Hardcoded English string 'LIVE · {n} OPEN' (and bare 'LIVE') rendered in both locales, not routed through t(). *(affects: ko sees English)*
- `pages/index.tsx:311` — Hardcoded English label '<strong>Disclaimer:</strong>' prefixes the localized disclaimer text; Korean locale shows 'Disclaimer: …한국어…'. *(affects: ko sees English)*
- `public/locales (forBorrowers.statAnonymousValue / statFree / statNoCost), rendered at pages/for-borrowers.tsx:133-148` — Stat values/labels diverge semantically between locales: statAnonymousValue ko='0%' vs en='0'; statFree ko='비공개 상담' (private consultation, paired with value 100%) vs en='Free for borrowers'; statNoCost ko='모기지를 꼭 진행할 의무 없음' (no obligation, paired with value 0%) vs en='Cost to borrowers' — the ko and en stat grids make different claims. *(affects: ko/en divergence)*
- `public/locales pricing.creditExplanation, rendered at pages/pricing.tsx:232-234` — ko text explains plan counts ('베이직 플랜은 월 5명…'); en text explains the credit mechanic ('Credits are used when a non-Premium broker starts a new paid response flow…') — same key, materially different content. *(affects: ko/en divergence)*
- `public/manifest.json:2-4` — PWA name/description hardcoded in English only ('mortly - Find Your Mortgage Broker', 'Canada's bilingual mortgage broker marketplace'); default locale of the site is ko. *(affects: ko missing)*
- `pages/pricing.tsx:148 / index.tsx eyebrows` — Decorative em-dash prefix '— ' is hardcoded around t() output (cosmetic, both locales) — acceptable, noted for completeness. *(affects: n/a)*
- `pages/api/requests/[id].ts:124` — Borrower-close system message hardcodes a bilingual string 'This request has been closed. / 이 요청이 종료되었습니다.' instead of locale-aware rendering via a translation key + isSystem rendering layer; inconsistent with the English-only admin variants. *(affects: both)*
- `lib/requestConfig.ts:105-111 (rendered in pages/borrower/dashboard.tsx:338, pages/broker/dashboard.tsx:449, pages/borrower/messages.tsx:543, pages/broker/messages.tsx:451,544)` — getRequestTitle returns hardcoded English 'Commercial Request'/'Residential Request' (not via t()), displayed as conversation/request titles on the Korean-default UI. *(affects: ko)*
- `API error strings across handlers (e.g. pages/api/conversations/index.ts:243 'Free plan brokers cannot message clients. Please upgrade your plan.', :363 'No response credits remaining', pages/api/requests/[id].ts:252,261)` — User-surfaced API error messages are hardcoded English; frontends that display res.error verbatim show English to Korean users. Locale JSON files themselves are fully in sync (1819 keys each, zero missing either direction). *(affects: ko)*
- `public/locales/{en,ko}/common.json (systemic; ~385 keys)` — 385 t() keys referenced in pages/components are missing from BOTH locale files — full clusters: admin.* (entire admin app), borrower.* and borrowerDashboard.* (dashboard), broker.* (dashboard/requests/billing additions), request.stepLabel/summary/privacy* (RequestFormLayout), settings.deleteAccountPassword*, common.{retry,refresh,open,close,dismiss}, status.title, nav.loggingOut, auth.tooManyAttempts, misc.skipToContent, messages.loadingConversations. Inline fallbacks render for both locales, producing mixed Korean/English UI. *(affects: both)*
- `pages/broker/messages.tsx:461` — Hardcoded English "No messages yet" (not via t()) shown in Korean UI. *(affects: ko)*
- `pages/broker/messages.tsx:663` — Hardcoded English "Dismiss" button (borrower side uses t('misc.dismiss')). *(affects: ko)*
- `pages/broker/messages.tsx:451-453 and 544-545` — Hardcoded English connector word "in" between request title and province ('{title} in {province}'). *(affects: ko)*
- `pages/broker/messages.tsx:561` — Conversation status badge renders raw enum {activeConversation.status} ('ACTIVE'/'CLOSED') untranslated. *(affects: both)*
- `pages/index.tsx:311` — Hardcoded English "<strong>Disclaimer:</strong>" prefix before the translated disclaimer body. *(affects: ko)*
- `pages/index.tsx:115` — Hardcoded "LIVE · {n} OPEN" status text in hero marketplace card. *(affects: ko)*
- `pages/broker/billing.tsx:474` — Hardcoded "{discount} OFF" badge (pricing.tsx correctly uses t('misc.off')). *(affects: ko)*
- `lib/auth.ts:111,127,131 → pages/login.tsx:73` — English-only backend error sentences ('Invalid email or password', suspension/ban messages) displayed verbatim in the ko UI. *(affects: ko)*
- `pages/api/conversations/index.ts:240-243,257,363 → pages/broker/requests/[id].tsx:108` — English-only API error strings ('Free plan brokers cannot message clients…', 'No response credits remaining') rendered raw via setError(data.error). *(affects: ko)*
- `pages/admin/inbox.tsx:391-398, 484-516, 526-538, 564-575, 601-631` — Hardcoded Korean strings not routed through t() (row buttons '✓ 승인', detail labels '브로커리지/지역/라이선스/티어/경력/신고자/사유/자동 체크/권장 조치', summaries '상업용/주거용/우선/긴급'); English-locale admins get untranslatable Korean. *(affects: en)*
- `pages/admin/people.tsx:543-550, 582, 593, 598` — Hardcoded 'Platform Admin', 'NO PROFILE', '크레딧 N', 'N 요청 · N 대화' and raw role/status enum badges — untranslated mixed-language admin table. *(affects: both)*
- `pages/borrower/messages.tsx:61-74 / pages/broker/messages.tsx:62-75 / pages/borrower/profile.tsx:236 / pages/borrower/request/[id].tsx:19-25` — Dates/times hardcoded to 'en-CA' regardless of active locale (chat date dividers, member-since, created dates). *(affects: ko)*
- `components/RequestForm.tsx:13-27 (and broker province selects)` — Canadian province names rendered in English only; likely acceptable for addresses but inconsistent with otherwise fully Korean form labels. *(affects: ko)*
- `components/broker/BrokerShell.tsx:292` — Hardcoded '· PRO' suffix appended to every subscription tier label. *(affects: both)*
- `pages/broker/requests/[id].tsx:152 — t("broker.requestsEyebrow", "상담 요청")` — Key missing from both en and ko common.json; Korean fallback shown to English-locale users *(affects: en)*
- `pages/broker/requests/[id].tsx:302 — t("broker.detailsEyebrow", "상세 정보")` — Key missing from both locale files; Korean fallback shown to English-locale users *(affects: en)*
- `pages/broker/requests/[id].tsx:304 — t("broker.requestDetailsTitle", "Request details")` — Key missing from both locale files; English fallback shown to Korean-locale users *(affects: ko)*
- `pages/broker/requests/[id].tsx:372 — t("broker.respondEyebrow", "응답하기")` — Key missing from both locale files; Korean fallback shown to English-locale users *(affects: en)*
- `pages/broker/requests/[id].tsx:375 — t("broker.startDirectThread", "Start a direct conversation")` — Key missing from both locale files; English fallback shown to Korean-locale users *(affects: ko)*
- `pages/broker/requests/[id].tsx:382 — t("broker.unlimitedPlanRespond", "PREMIUM plan · unlimited responses.")` — Key missing from both locale files; English fallback shown to Korean-locale users on a billing-relevant string *(affects: ko)*
- `pages/broker/requests/[id].tsx:386 — t("broker.creditWillBeDeducted", "1 credit will be used. {{remaining}} remaining.")` — Key missing from both locale files; credit-cost explanation shown only in English to Korean-locale brokers *(affects: ko)*
- `pages/broker/requests/[id].tsx:399 — t("broker.backToList", "목록으로")` — Key missing from both locale files; Korean fallback shown to English-locale users *(affects: en)*
- `pages/broker/requests/[id].tsx:408 — t("broker.respond", "상담 시작")` — Key missing from both locale files; Korean fallback on the primary respond/credit-spend button for English-locale users *(affects: en)*
- `public/locales/en|ko/common.json:492-495 — broker.introMessage* block` — Orphaned keys (no t() reference in repo); en/ko line 493 instructs brokers to discuss 'required documents' in chat, guidance that conflicts with the attachment-less chat if ever consumed (e.g. by the mobile app)
- `pages/borrower/dashboard.tsx (lines 129-595) + components/borrower/BorrowerShell.tsx (131, 317-319) + pages/login.tsx:66` — 34 t() keys missing from BOTH public/locales/ko/common.json and en/common.json: borrower.borrowerFallback, borrower.dashboardEyebrow, borrower.welcome, borrower.welcomeSuffix, borrower.actionRequired, borrower.activityEyebrow, borrower.activityTitle, borrower.viewAll, borrower.noActivity, borrower.noActivityDesc, borrower.brokerLabel, borrower.allRequestsEyebrow, borrower.allRequestsTitle, borrower.activeRequestEyebrow, borrower.noActiveRequest, borrower.noActiveRequestDesc, borrower.responses, borrower.posted, borrower.viewResponses, borrower.editRequest, borrower.activeResponsesBadge, borrowerDashboard.noActive, borrowerDashboard.activeTrend, borrowerDashboard.responsesWaiting, borrowerDashboard.responsesAcross, borrowerDashboard.response, borrowerDashboard.responsesPlural, request.viewDetails, request.stepLabel, status.title, common.open, misc.skipToContent, nav.loggingOut, auth.tooManyAttempts. Inline fallbacks are Korean for some (English UI shows Korean) and English for others (Korean UI shows English). *(affects: both)*
- `pages/login.tsx:73 + lib/auth.ts:93,111,119,127,131` — Raw English NextAuth error prose ('Invalid email or password', 'Your account has been suspended. Please contact support.', 'Your account has been banned.', 'Email and password are required') displayed verbatim via setError(result.error) — untranslatable, English-only in the ko UI. *(affects: ko)*
- `pages/index.tsx:311` — Hardcoded '<strong>Disclaimer:</strong>' label not passed through t(); shows English 'Disclaimer:' on the Korean homepage (the body text uses t('home.disclaimerFull')). *(affects: ko)*
- `pages/borrower/profile.tsx:236-240` — Member-since date always formatted with toLocaleDateString('en-CA') regardless of active locale — Korean users see 'June 13, 2026'-style English dates. *(affects: ko)*
- `pages/borrower/messages.tsx:61-74` — formatTime/formatDate hardcode 'en-CA' locale for chat timestamps and date dividers in the borrower messages view (part of the first-session journey when a broker responds). *(affects: ko)*
- `pages/api/borrowers/profile.ts:47,55,59,68,73,80 (rendered by pages/borrower/profile.tsx:82,119)` — Server validation messages ('Current password is incorrect', 'Password change not available for this account', etc.) are English-only and surfaced verbatim in the UI via data.message. *(affects: ko)*
- `components/borrower/BorrowerShell.tsx (entire borrower app chrome)` — No language switcher exists inside the borrower app — the locale toggle lives only in the marketing Navbar (components/Navbar.tsx:110). Combined with Btn raw anchors dropping the /en prefix, an English borrower has no in-app way to get back to English. *(affects: en)*
- `pages/borrower/dashboard.tsx:40-45 (relativeTime helper)` — Relative-time strings ('방금'/'just now', '분 전'/'m ago') are hardcoded in the helper rather than t() keys — works for ko/en but bypasses the translation system (consistency/maintenance gap). *(affects: both)*
- `public/locales/{ko,en}/common.json (used by pages/broker/billing.tsx:255,290)` — Keys broker.planUpdating and broker.planUpdatePending missing from BOTH locale files and no default passed — raw key text shown in the post-upgrade banner *(affects: both)*
- `lib/requestConfig.ts:105-111 (rendered in pages/borrower/messages.tsx:543, pages/broker/messages.tsx:451,544)` — getRequestTitle returns hardcoded English 'Commercial Request'/'Residential Request' in chat lists/headers *(affects: ko)*
- `pages/broker/messages.tsx:451-452, 544-545` — Hardcoded English connective '<title> in <province>' *(affects: ko)*
- `pages/broker/messages.tsx:461` — Hardcoded 'No messages yet' *(affects: ko)*
- `pages/broker/messages.tsx:663` — Hardcoded 'Dismiss' (borrower page uses t('misc.dismiss') which exists) *(affects: ko)*
- `pages/broker/messages.tsx:85` — Relative time literal 'now' hardcoded (borrower page passes t('chat.justNow')) *(affects: ko)*
- `pages/broker/messages.tsx:561` — Raw enum {activeConversation.status} ('ACTIVE'/'CLOSED') rendered instead of existing statusLabel.* keys *(affects: ko)*
- `pages/borrower/messages.tsx:61-88 and pages/broker/messages.tsx:62-90` — Dates/times formatted with hardcoded 'en-CA' locale — English month names in Korean UI (date dividers, list timestamps) *(affects: ko)*
- `components/broker/RequestContextPanel.tsx:61,87,211 + pages/borrower/messages.tsx:683-684 + pages/broker/messages.tsx:573-574` — Keys broker.requestContext / borrower.requestContext missing from both locales — visible panel header eyebrow and drawer toggle always read English 'Request context' *(affects: ko)*
- `components/broker/RequestContextPanel.tsx:64-68 and 189-194` — Keys broker.noRequestContext and broker.noFullRequestLink missing — English fallback shown to KO users *(affects: ko)*
- `components/broker/RequestContextPanel.tsx:216 + drawer close buttons (pages/borrower/messages.tsx:819, pages/broker/messages.tsx:761)` — Key common.close missing — English 'Close' aria-labels in KO UI *(affects: ko)*
- `components/borrower/RequestFormLayout.tsx:106-112` — Key request.stepLabel missing — the mobile-only step indicator always renders English 'STEP {{n}} / {{total}}' *(affects: ko)*
- `components/borrower/RequestFormLayout.tsx:88-98` — Keys request.stepBasicsHint/stepDetailsHint/stepReviewHint missing — English hints in KO step rail *(affects: ko)*
- `components/borrower/RequestFormLayout.tsx:162-171` — request.privacyEyebrow missing (Korean '개인정보' shown to EN users) and request.privacy missing (English body shown to KO users) *(affects: both)*
- `components/borrower/RequestFormLayout.tsx:186-209, 246, 252` — request.summary missing (Korean '요청 요약' to EN users); request.summaryNote, request.summaryPlaceholder, request.locationSection, request.timelineSection missing (English to KO users) *(affects: both)*
- `components/borrower/BorrowerShell.tsx:131-133 and components/broker/BrokerShell.tsx:156-158` — Key misc.skipToContent missing — English 'Skip to content' skip-link in KO UI *(affects: ko)*
- `components/borrower/BorrowerShell.tsx:317-319,396 and components/broker/BrokerShell.tsx:361-363,444` — Key nav.loggingOut missing — English 'Signing out…' in KO UI *(affects: ko)*
- `components/borrower/BorrowerShell.tsx:156,249 and components/broker/BrokerShell.tsx:184,296` — aria-labels 'Borrower navigation' / 'Broker navigation' hardcoded English (not via t()) *(affects: ko)*
- `pages/broker/billing.tsx:473-475` — '{discount} OFF' — 'OFF' hardcoded English (pricing.tsx:186 correctly uses t('misc.off')) *(affects: ko)*
- `pages/broker/billing.tsx:388-394` — cancellingAt banner date always formatted with 'en-CA' while pendingDowngrade (410-413) and invoices (120-126) respect router.locale — English long-form dates in KO cancellation banner *(affects: ko)*
- `components/broker/BrokerShell.tsx:291-293` — Hardcoded '· PRO' suffix appended to every subscription tier badge *(affects: both)*
- `pages/borrower/dashboard.tsx + components/borrower/BorrowerShell.tsx + components/DeleteAccountSection.tsx (35 keys: borrower.welcome, borrower.viewResponses, request.viewDetails, borrowerDashboard.response(sPlural), common.open, status.title, nav.loggingOut, misc.skipToContent, settings.deleteAccountPassword*, etc.)` — Keys missing from BOTH locale files; inline fallbacks are a mix of Korean and English so each locale shows fragments of the other language *(affects: both)*
- `lib/requestConfig.ts getRequestTitle (used at dashboard.tsx:338)` — Returns hardcoded English 'Residential Request'/'Commercial Request' in the Korean-default activity feed *(affects: ko)*
- `pages/borrower/request/[id].tsx:19-25, pages/borrower/profile.tsx:236, components/RequestCard.tsx:23-29` — Dates always formatted with en-CA locale regardless of router.locale *(affects: ko)*
- `API error messages surfaced verbatim to UI (pages/api/requests/[id].ts:103,159,186-189,252,259-262; pages/api/borrowers/profile.ts:47,55,59,73; consumed at request/[id].tsx:106,127 and profile.tsx:82,119)` — Server returns hardcoded English prose that the frontend displays directly; Korean users get English errors *(affects: ko)*
- `components/borrower/BorrowerShell.tsx:156,249` — aria-label 'Borrower navigation' hardcoded English (accessibility strings untranslated) *(affects: ko)*
- `pages/borrower/brokers/[requestId].tsx:205` — Explicit _other plural key bypasses singular form ('1 years' in English) *(affects: en)*
- `pages/borrower/dashboard.tsx:36-50 relativeTime()` — Inline ko/en ternary strings instead of t() — functions correctly but bypasses the i18n system *(affects: both)*


## Missing tests list

- [auth-core] No test for the credentials-callback brute-force wrapper in pages/api/auth/[...nextauth].ts (isCredentialsCallback detection, per-IP cap, per-email cap, 429 url shape, Retry-After).
- [auth-core] No test for pages/api/auth/select-role.ts (ADMIN block 403, already-selected 409, needsRoleSelection gate, same-origin CSRF rejection, mobile sessionToken minting, invalidateSessionDbCache).
- [auth-core] No test for pages/api/auth/mobile-oauth.ts (Google/Apple audience verification, email_verified rejection, account linking by providerId vs email, SUSPENDED/BANNED 403, needsRoleSelection/needsNameEntry, rate limit).
- [auth-core] No test for the session-callback revocation path in lib/auth.ts (tokenVersion mismatch to null, status not ACTIVE to null, deleted user to null, 5s cache behavior).
- [auth-core] No test for login error-branch mapping in pages/login.tsx (RATE_LIMITED, EMAIL_NOT_VERIFIED verify redirect, GOOGLE_ACCOUNT message, role-based redirect).
- [auth-core] No test for client-side role guards in BorrowerShell/BrokerShell or the OAuth role-selection redirect in pages/select-role.tsx (wrong-role and anonymous handling).
- [auth-core] No test for the Google/Apple web signIn callback in lib/auth.ts (unverified email rejection, suspended/banned rejection, legal-version gate to /signup?legal=required, account linking by email).
- [auth-recovery] pages/api/auth/forgot-password.ts — no tests at all: token generation + SHA-256 storage, 1h expiry write, generic-200 enumeration behavior for missing/malformed emails, timing padding, 3/min/IP rate limit, locale selection
- [auth-recovery] pages/api/auth/reset-password.ts — no tests: expiry enforcement, single-use (token nulled), tokenVersion increment session revocation, emailVerified flip, hashed-token lookup, password length validation, rate limit
- [auth-recovery] pages/api/auth/resend-code.ts — no tests: 60s per-account cooldown with retryAfter, attempts reset to 0, generic 200 for unknown/verified emails, 502 on send failure, 3/min/IP limit
- [auth-recovery] pages/forgot-password.tsx, pages/reset-password.tsx, pages/verify-email.tsx — no component/UI tests (tests/ui contains only Banner, design-regression, index-exports)
- [auth-recovery] tests/e2e/auth.spec.ts — covers neither forgot/reset password nor email verification/resend flows end-to-end
- [auth-recovery] lib/email.ts — no tests for generateVerificationCode bounds or ko/en template/locale selection in sendVerificationCode/sendPasswordResetEmail
- [auth-recovery] lib/rate-limit.ts — tests/unit/lib/rate-limit.test.ts exercises only the unused legacy authLimiter/verifyCodeLimiter and getClientIp; the production checkRateLimit (KV path, KV-error degradation, in-memory cap eviction) is untested
- [request-form] Draft persistence: sessionStorage rehydration of RequestForm including income/corporate year-select state (the current RequestForm.test.tsx only clears sessionStorage; never tests restore)
- [request-form] PATCH /api/requests/[id] with a full-form payload on a request that has conversations (the 409 cosmetic-edit contract that breaks the real edit UI) — tests/integration/api/requests/id.test.ts covers neither the 409 path nor unchanged-field payloads
- [request-form] PATCH with invalid mortgageCategory enum and non-array productTypes (currently produce 500s, untested)
- [request-form] POST server-side gaps: missing desiredTimeline, non-enum timeline string, residential request without notes or annualIncome, non-enum incomeTypes values, oversized notes (4000-char boundary) and details (4096 boundary)
- [request-form] Concurrency: duplicate-submit / max-active-requests count-then-create race (tests/concurrency/ exists for credits but not request creation)
- [request-form] Commercial income/expense year-pairing validation (client-only rule has no test at any layer)
- [request-form] E2E UI walk of the 3-step form (tests/e2e/request-to-broker-flow.spec.ts creates the request via APIRequestContext, not through the form UI)
- [request-form] i18n completeness test asserting every t() key used by RequestForm/RequestFormLayout/new.tsx exists in both ko and en common.json (would have caught the 11 missing keys)
- [request-form] Province list consistency across borrower form, broker filter, broker onboarding/profile
- [request-form] Unauthenticated and wrong-role access to /borrower/request/new (blank-page regression)
- [request-form] Borrower request detail page initial-fetch failure state (infinite skeleton)
- [request-form] Rate limit behavior on POST /api/requests (10/min bucket 'requests-create')
- [broker-flow] No integration tests for /api/brokers/profile (GET/POST/PUT): required-field validation, duplicate-profile 409, partial update semantics, profilePhoto https validation, role gating (tests/integration/api/ has no brokers/ directory)
- [broker-flow] No integration tests for /api/brokers/mark-requests-seen (bulk idempotency, lastRequestsSeenAt write, missing VERIFIED gate) or /api/brokers/requests/[id]/mark-seen (publicId lookup, non-OPEN 404 oracle, verification gate)
- [broker-flow] tests/broker/BrokerRequests.test.tsx:184-220 'Only unresponded' test uses a stale fixture (conversations[] array) that no longer matches the real API contract (hasMyConversation) — needs rewriting against the current shape; no test covers hasMyConversation consumption
- [broker-flow] No test for broker browse pagination behavior (limit/page params, truncation at 20, pagination metadata consumption)
- [broker-flow] pages/broker/profile.tsx has zero test coverage (load, save, error shape, verification badge rendering)
- [broker-flow] No test for the FREE-tier request-detail CTA path (should show upgrade card, server 403 handling) or PREMIUM unlimited copy
- [broker-flow] No test for REJECTED-broker dashboard banner or dead-end re-application behavior
- [broker-flow] No i18n completeness test asserting every t() key used in broker pages exists in both public/locales/en/common.json and ko/common.json (would have caught the 49 missing keys)
- [broker-flow] No test that broker GET /api/requests and /api/requests/[id] responses exclude borrower name/email/phone (PII regression guard)
- [broker-flow] tests/broker/BrokerOnboarding.test.tsx covers only the context-refresh regression — no required-field, phone-format, or error-display tests for the onboarding form
- [messaging] GET /api/conversations list: block filtering (both directions), unread-count computation, pagination params, broker-without-profile 404 (tests/integration/api/conversations/index.test.ts covers POST only)
- [messaging] GET /api/conversations/[id]: cursor pagination (before/hasMore), mark-as-read on initial load vs skip on pagination, unverified-broker request-field redaction (L2 hardening branch, [id].ts:107-123)
- [messaging] PUT /api/conversations/[id] close flow: borrower-only, owner check, already-closed 400, realtime nudge
- [messaging] GET /api/messages/unread: ACTIVE-only filter, gt boundary, broker vs borrower lastReadAt selection
- [messaging] POST/DELETE /api/users/[publicId]/block and GET /api/users/blocked: idempotency, self-block rejection, email omission
- [messaging] System-tag spoof guard regression ('[admin]'/'[system]' prefix → 400) in POST /api/messages and the broker-intro path of POST /api/conversations (guard exists at messages/index.ts:28-30 and conversations/index.ts:276-278 but no test exercises it)
- [messaging] Broker intro-message validation in POST /api/conversations (5000-char cap, non-string rejection, brokerMsgCount bump in same tx)
- [messaging] Sending into a CLOSED conversation (currently accepted — test would codify the fix)
- [messaging] lib/realtime.ts: no-op when env unset, fire-and-forget failure isolation, topic construction
- [messaging] Cron purge-expired interaction with messages (redaction of non-system bodies) — no test file for purge-expired
- [messaging] Frontend component/E2E coverage for both messages pages (realtime merge dedupe, poll status refresh, optimistic send failure restore, IME Enter handling) — tests/ contains no frontend chat tests
- [payments] pages/api/stripe/create-portal.ts — no integration test (auth gate, missing-customer 400, return_url pinning)
- [payments] pages/api/stripe/invoices.ts — no integration test (auth gate, empty-customer [], field mapping)
- [payments] Webhook pendingTier application path in handleInvoicePaid (price swap + tier flip + pendingTier clear) — entirely untested
- [payments] invoice.payment_failed for a PREMIUM broker — no test asserting whether unlimited access is actually cut (current gap would be caught)
- [payments] Re-subscribe after cancellation with stale pendingTier (checkout.session.completed must clear pendingTier) — untested
- [payments] pages/broker/billing.tsx — no component test (tests/broker covers Dashboard/Requests/Shell/Onboarding only): banners for PAST_DUE/cancelAtPeriodEnd/pendingTier, downgrade modal, upgrade polling, missing-i18n-key regression
- [payments] pages/pricing.tsx — no test (auth redirects, tier card rendering, locale rendering)
- [payments] Admin credits concurrency — tests/concurrency/credits.test.ts covers conversation-spend decrement only; no test for admin negative adjustment racing spends/webhook overwrites
- [payments] Webhook ledger crash-recovery semantics (event with ledger row but no applied state change) — untested
- [payments] getSettingInt throw path (malformed tier-credit setting) propagating through the webhook to a 500/retry — untested
- [admin] No integration tests for PUT /api/admin/requests/[id] — approval, rejection-with-reason, REJECTED→OPEN reason clearing, CLOSED conversation-cascade + system message, DELETE cascade (tests/integration/api/admin contains only credits.test.ts)
- [admin] No tests for PUT /api/admin/brokers/[id] verification transitions, including the BROKER_VERIFY_REQUIRES_TWO_ADMINS 202/recommendation flow (env-flag behavior is completely untested)
- [admin] No API tests for POST /api/admin/users/bulk (per-row admin/self protections, bulkActionId stamping, partial-failure summary) — tests/admin/people-bulk.test.tsx covers only the page UI
- [admin] No tests for PUT /api/admin/users/[id] tokenVersion bump on suspend/ban and admin/self protection
- [admin] No tests for /api/admin/settings (ALLOWED_KEYS enforcement, 1-20 entry bounds, cache invalidation via kv.incr) or for lib/settings getSettingInt throw-on-NaN behavior
- [admin] No tests for /api/admin/queue (publicId batch resolution incl. deleted-target fallback, count contract relied on by mobile per the STABLE-contract comment)
- [admin] No tests for POST /api/admin/users/create (typed ack gate, 12-char password, per-admin 10/min limit, 409 duplicate email)
- [admin] No tests for PUT /api/admin/reports/[id] (status transitions, resolvedAt stamping, notes-only update auditing gap) or GET targetDetails resolution
- [admin] No tests for PUT /api/admin/conversations/[id] admin close (isSystem message creation, already-closed 400, audit row)
- [admin] No tests for /api/notices (ownership scoping of GET/PUT) or the Navbar notices consumer
- [admin] No tests for the maintenance gate (client gate in _app.tsx or /api/maintenance contract)
- [admin] No tests for /api/admin/trends bucketing (tests/admin/trends.test.tsx covers the TrendsCard component only) or its cache-header policy
- [admin] No tests for UndoToast commit/undo/unmount semantics (decision-loss bug would have been caught)
- [admin] No e2e admin flow (tests/e2e has only auth.spec.ts and request-to-broker-flow.spec.ts — no approve-request → broker-sees-it journey)
- [admin] No test asserting every pages/api/admin/** route is wrapped in withAdmin (cheap meta-test guarding against future unwrapped routes)
- [i18n] No catalog-parity / key-existence test: nothing in tests/ loads public/locales/{en,ko}/common.json and asserts every statically referenced t() key exists (would have caught all 343 missing keys and the billing raw-key bug)
- [i18n] No EN-locale rendering tests: component tests (tests/broker/*, tests/borrower/*, tests/admin/*) never assert that locale=en output contains no Hangul (would catch consultation.step1-3 and the 317 Korean-fallback sites)
- [i18n] No test for password-reset email locale selection (pages/api/auth/forgot-password.ts preferences.locale path is dead code and untested)
- [i18n] No e2e coverage for language switching or locale persistence — tests/e2e contains only auth.spec.ts and request-to-broker-flow.spec.ts; no test drives the Navbar KO/EN toggle, OAuth locale survival, or Stripe return locale
- [i18n] No test asserting the language/content of system chat messages written by /api/requests/[id], /api/admin/requests/[id], /api/admin/conversations/[id] close paths
- [i18n] No test for locale-aware date formatting (hardcoded en-CA sites have no regression guard)
- [notifications] lib/push.ts sendPushToUsers — no direct tests (only mocked in integration tests): pushEnabled/mutedUntil filtering, per-device locale selection, invalid-token pruning, DeviceNotRegistered ticket pruning, chunk-failure index alignment
- [notifications] pages/api/notifications/register-device.ts — no tests for auth gating, Expo token validation, platform allowlist, the 409 token-hijack guard, or DELETE owner-scoping
- [notifications] pages/api/notices.ts — no tests for user-scoping of GET, PUT mark-read cross-user no-op, or the 50-row cap
- [notifications] pages/api/auth/forgot-password.ts — no test asserting reset-email locale selection from preferences.locale (the always-ko bug would have been caught)
- [notifications] pages/api/webhooks/stripe.ts invoice.payment_failed — webhook tests exist (tests/integration/api/stripe/) but none assert outbound notification behavior on payment failure (currently none exists to assert)
- [notifications] components/Navbar.tsx notices bell — no component test for fetch/30s polling, unread badge math, mark-as-read optimistic update
- [notifications] Push localization templates (messagePush/brokerInquiryPush/borrowerInquiryPush) — no snapshot/unit tests for ko/en content and fallback-name interpolation
- [public-deploy] No tests for components/SEO.tsx (canonical URL building, hreflang pairs, og:image default existence, noindex flag) — would have caught the og-default.png 404 and would catch hreflang regressions.
- [public-deploy] No test validating next-sitemap output (no private/locale-prefixed routes, no /en/en hreflang, robots.txt parity) — the committed public/sitemap-0.xml demonstrates the regression.
- [public-deploy] No rendering tests for any marketing page (pages/index.tsx, pricing.tsx, how-it-works.tsx, for-borrowers.tsx, for-brokers.tsx, contact.tsx, terms.tsx, privacy.tsx, 404.tsx, 500.tsx) — tests/component contains only RequestForm.test.tsx.
- [public-deploy] No ko/en locale-parity test asserting every t() key used in pages/components exists in both public/locales/*/common.json (would catch misc.skipToContent and future drift).
- [public-deploy] No e2e coverage of the public marketing funnel: tests/e2e has only auth.spec.ts and request-to-broker-flow.spec.ts — no nav/footer link crawl, language switcher, pricing redirect behavior, or 404 page.
- [public-deploy] No test asserting pricing page tier claims match backend capabilities/settings (basic_tier_credits=5, pro_tier_credits=20, PREMIUM unlimited, and absence/presence of notification features).
- [public-deploy] No test for public/sw.js caching behavior (stale '/' precache, API bypass).
- [public-deploy] No test for security headers / CSP emitted by next.config.mjs headers().
- [public-deploy] No CI job for lint/tsc/next build (process-level test gap; tsc --noEmit verified passing locally, exit 0).
- [public-deploy] No test for pages/_app.tsx MaintenanceGate (admin bypass, auth-route bypass, fail-open) or the Navbar notices/unread API contract.
- [data-layer] pages/api/cron/purge-expired.ts — the only PIPEDA PII-retention enforcement has zero tests (expire-requests and auto-close both have integration suites; purge does not)
- [data-layer] DELETE /api/users/me account-deletion cascade — no test exercises the FK-ordered transaction for borrower or broker accounts
- [data-layer] prisma migrations ↔ schema drift — no CI check (would have caught the missing appleId migration)
- [data-layer] lib/settings.ts — getSetting cache TTL, KV version invalidation, getSettingInt throw-on-NaN behavior untested
- [data-layer] /api/notices (GET/PUT mark-read) — untested
- [data-layer] /api/preferences — untested
- [data-layer] /api/users/[publicId]/block and /api/users/blocked — untested
- [data-layer] /api/notifications/register-device and lib/push.ts token cleanup — untested
- [data-layer] /api/admin/users/create (admin mint, ack, rate limit, peer email broadcast) — untested
- [data-layer] /api/admin/settings PUT validation + invalidateSettingsCache — untested
- [data-layer] /api/maintenance + _app.tsx maintenance gating — untested
- [data-layer] prisma/seed.ts modes (mock/empty/clean) and production guard — untested
- [data-layer] POST /api/conversations request-status gating — no test asserts brokers cannot contact EXPIRED/CLOSED/PENDING_APPROVAL requests (the behavior is currently missing; a failing test should pin the fix)
- [data-layer] /api/admin/brokers index and /api/admin/credits handlers — untested (also unconsumed)
- [data-layer] /api/admin/requests/[id] DELETE cascade and CLOSED system-message insertion — untested
- [data-layer] lib/csvExport.ts — untested (dead code; delete or test)
- [ux-states] Borrower and broker messages/chat pages (no tests cover selection, optimistic send/rollback, poll merge, mobile list/chat toggle, close-conversation flow)
- [ux-states] Broker billing page (plan change, downgrade modal, checkout failure feedback, webhook-propagation polling loop)
- [ux-states] Auth pages UI: login error mapping (raw backend strings), signup role lock, verify-email resend non-429 failure, reset-password router.isReady flash
- [ux-states] Navbar notifications (desktop dropdown + the broken mobile path) and unread badge refresh events
- [ux-states] Borrower request detail page (edit mode, delete flow, fetch-failure infinite-skeleton regression)
- [ux-states] Borrower brokers comparison page (sort, empty, error states)
- [ux-states] Admin inbox page UI (undo-toast commit/undo, keyboard shortcuts, optimistic hide rollback) — inboxQueue lib is tested but the page is not
- [ux-states] Admin system settings tab (save flow, fetch-failure blank-field state) and activity feed pagination
- [ux-states] i18n completeness: automated test asserting every t() key in pages/components exists in both en and ko common.json (would have caught the 385 missing keys)
- [ux-states] Pricing page redirect behavior for logged-out/borrower visitors
- [ux-states] MaintenanceGate and ErrorBoundary in _app.tsx
- [ux-states] DeleteAccountSection two-step + password re-auth flow
- [ux-states] Locale persistence on Btn as='a' navigation (would catch the locale-reset bug)
- [gap:File upload / document handling (beyond broker profile photo)] No test for /api/brokers/profile at all (no file matching *profile* under tests/): untested validation paths include profilePhoto assertOptionalHttpsUrl rejection of javascript:/data:/http: URLs, licenseNumber regex, 409 on duplicate create, and role gating
- [gap:File upload / document handling (beyond broker profile photo)] No unit tests for lib/validate.ts (tests/unit/lib contains only publicId, stripe, requestConfig, rate-limit, legal) — assertHttpsUrl/assertOptionalHttpsUrl protocol filtering is unverified
- [gap:File upload / document handling (beyond broker profile photo)] No test for pages/api/cron/purge-expired.ts (tests/integration/api/cron covers only auto-close-conversations and expire-requests) — the 180-day PII/message redaction, the platform's key retention control, has zero coverage
- [gap:File upload / document handling (beyond broker profile photo)] No test asserting borrower-facing endpoints (/api/requests/[id], /api/conversations/*) never expose Broker.profilePhoto or other unselected Broker columns (field-allowlist regression test)
- [gap:Borrower onboarding / first-run experience (checklist says onboarding for BOTH roles; only broker side was reviewed)] No tests for /api/borrowers/profile (GET shape, PUT name validation, password change with currentPassword check + tokenVersion bump) — tests/integration/api has no borrowers/ directory
- [gap:Borrower onboarding / first-run experience (checklist says onboarding for BOTH roles; only broker side was reviewed)] No tests for /api/preferences (allowlist validation, 10KB cap, merge semantics)
- [gap:Borrower onboarding / first-run experience (checklist says onboarding for BOTH roles; only broker side was reviewed)] No tests for /api/auth/select-role (one-time guard via needsRoleSelection, ADMIN refusal, CSRF/origin gate, mobile token minting)
- [gap:Borrower onboarding / first-run experience (checklist says onboarding for BOTH roles; only broker side was reviewed)] No tests for /api/auth/forgot-password or /api/auth/reset-password (locale fallback behavior, token hashing, timing padding, rate limit)
- [gap:Borrower onboarding / first-run experience (checklist says onboarding for BOTH roles; only broker side was reviewed)] No tests for /api/auth/resend-code (60s per-account cooldown, 502 on send failure, enumeration-safe 200)
- [gap:Borrower onboarding / first-run experience (checklist says onboarding for BOTH roles; only broker side was reviewed)] No regression test for the /borrower/request/new auth-gate blank page (tests/borrower/ covers BorrowerShell redirect in isolation, but not the page-level return-null bypass in pages/borrower/request/new.tsx:51)
- [gap:Borrower onboarding / first-run experience (checklist says onboarding for BOTH roles; only broker side was reviewed)] No test that borrower-journey t() keys exist in both public/locales/{ko,en}/common.json (would have caught the 34 missing keys)
- [gap:Borrower onboarding / first-run experience (checklist says onboarding for BOTH roles; only broker side was reviewed)] No e2e for the full borrower first-run: signup → verify-email (code entry + resend) → login?verified=true → empty dashboard → first request (tests/e2e/auth.spec.ts is render-smoke only; request-to-broker-flow.spec.ts starts from pre-seeded authenticated users)
- [gap:Borrower onboarding / first-run experience (checklist says onboarding for BOTH roles; only broker side was reviewed)] No test for BorrowerDataContext failure behavior (API 500 should not surface the 'No requests yet' empty state)
- [gap:Mobile responsiveness of borrower/broker (non-admin) authed surfaces, especially chat] Mobile pane switching (list <-> thread) and md/lg breakpoint visibility for pages/borrower/messages.tsx and pages/broker/messages.tsx — no page-level tests exist (only the token-scan in tests/ui/design-regression.test.ts:28,36 and skeleton/panel unit tests in tests/broker/)
- [gap:Mobile responsiveness of borrower/broker (non-admin) authed surfaces, especially chat] RequestContextPanel mobile drawer open/close flow from both messages pages (toggle button, backdrop, Escape) — tests/broker/RequestContextPanel.test.tsx covers the component but not the drawer integration
- [gap:Mobile responsiveness of borrower/broker (non-admin) authed surfaces, especially chat] Chat send flow: optimistic append, id-dedupe against poll/realtime merge, error restore of the composed message (pages/borrower/messages.tsx:303-336, pages/broker/messages.tsx:282-315)
- [gap:Mobile responsiveness of borrower/broker (non-admin) authed surfaces, especially chat] Broker chat list-load error rendering (would catch the invisible-error gap at pages/broker/messages.tsx:655-666)
- [gap:Mobile responsiveness of borrower/broker (non-admin) authed surfaces, especially chat] pages/broker/billing.tsx UI: plan select, downgrade confirmation modal, success-banner i18n keys (a key-presence test would have caught broker.planUpdating), checkout-failure error display — only API-level Stripe tests exist (tests/integration/api/stripe/)
- [gap:Mobile responsiveness of borrower/broker (non-admin) authed surfaces, especially chat] pages/pricing.tsx: role-based redirects (unauth -> /signup?role=broker, borrower -> dashboard) and card/table rendering
- [gap:Mobile responsiveness of borrower/broker (non-admin) authed surfaces, especially chat] components/Navbar.tsx: mobile menu contents (duplicate Dashboard/Messages links), dead mobile notifications toggle, unread badge rendering
- [gap:Mobile responsiveness of borrower/broker (non-admin) authed surfaces, especially chat] pages/borrower/brokers/[requestId].tsx: sort behavior, empty/error states, 'view messages' deep link including the ?id= unread-clearing path
- [gap:Mobile responsiveness of borrower/broker (non-admin) authed surfaces, especially chat] Locale-key completeness test asserting every t() key referenced in components/pages exists in both public/locales/ko/common.json and en/common.json
- [borrower-flow] Integration tests for DELETE /api/users/me (cascade order, FK safety, credentials vs OAuth re-auth paths, residual report handling) — no test file references users/me
- [borrower-flow] Integration tests for /api/borrowers/profile PUT (name bounds, password change + tokenVersion bump)
- [borrower-flow] Integration tests for /api/preferences (allowlist validation, 10KB cap, merge semantics)
- [borrower-flow] UI tests for pages/borrower/request/[id].tsx (load-error state, edit 409 path, delete 409 path, rejection banner with rejectionReason)
- [borrower-flow] UI tests for pages/borrower/brokers/[requestId].tsx (sorting, empty state, error state)
- [borrower-flow] UI tests for DeleteAccountSection two-pass flow (ack -> password fallback regex behavior)
- [borrower-flow] Test that PUT /api/requests/[id] close from terminal statuses is rejected (once guard added)
- [borrower-flow] i18n key-coverage lint test ensuring every t() key exists in both en and ko common.json (would have caught the 35 missing keys)
- [borrower-flow] BorrowerDataContext tests for fetch-failure behavior (loaded flag vs error surfacing) and >20-request truncation


## TODO / FIXME / suppression inventory

- pages/admin/system.tsx:18 — *   4. Manual       — placeholder (Manual tab renders '매뉴얼 섹션은 곧 추가될 예정입니다' stub at lines 319-331)
- pages/admin/brokers/[id].tsx:30 — Comment: related-conversation rows link to Activity drawer 'instead of the legacy /admin/conversations/[id] page. That legacy page is scheduled for deletion in Phase 2.' — the page still exists and is actively linked from activity.tsx:857, so the deletion plan is stale/contradicted.
- components/admin/CommandPalette.tsx:19 — Comment: "Quick actions that need an input (credit adjust, send notice) navigate to the user detail page where the existing modal lives" — stale: no such modals exist on /admin/users/[id].
- lib/push.ts:116 — (Future: thread that flag through sendPushToUsers per-recipient. For now we always use the safe form.) — pushPreviewEnabled preference is never honored
- pages/admin/system.tsx:327 — Manual tab placeholder: "매뉴얼 섹션은 곧 추가될 예정입니다. 현재는 각 페이지 하단의 키보드 단축키 안내를 참고하세요." — admin manual section is a stub
- pages/admin/inbox.tsx:524 — DetailChecks 자동 체크 block is static placeholder data (ok flags and labels hardcoded, no real checks executed)
- components/admin/primitives/AConfirmDialog.tsx:131 — Language inferred via cancelLabel === "취소" ? "선택" : "optional" — string-comparison locale-detection hack
- /Users/hyunseokcho/Documents/GitHub/mortly/lib/push.ts:116 — (Future: thread that flag [preferences.pushPreviewEnabled] through sendPushToUsers per-recipient. For now we always use the safe form.)
- pages/index.tsx:17 — Comment contains 'placeholder': "Render an invisible placeholder for the primary CTA until we know whether to show..." — descriptive comment for intentional layout-shift fix, not an action item (no TODO/FIXME/HACK markers found in any reviewed file).
- pages/broker/messages.tsx:171 — // eslint-disable-next-line react-hooks/exhaustive-deps
- pages/broker/requests/[id].tsx:58 — // eslint-disable-next-line @typescript-eslint/no-explicit-any
- pages/broker/requests/[id].tsx:91 — // eslint-disable-next-line react-hooks/exhaustive-deps
- pages/admin/people.tsx:159 — // eslint-disable-next-line react-hooks/exhaustive-deps
- pages/borrower/dashboard.tsx:403 — // eslint-disable-next-line @typescript-eslint/no-explicit-any
- pages/borrower/dashboard.tsx:544 — // eslint-disable-next-line @typescript-eslint/no-explicit-any
- pages/borrower/request/[id].tsx:41 — // eslint-disable-next-line @typescript-eslint/no-explicit-any
- pages/api/preferences.ts:75 — // eslint-disable-next-line @typescript-eslint/no-explicit-any
- pages/api/admin/users/create.ts:123 — // eslint-disable-next-line no-console
- components/RequestForm.tsx:291 — // eslint-disable-next-line react-hooks/exhaustive-deps
- components/BrandMark.tsx:47 — // eslint-disable-next-line @next/next/no-img-element
- components/broker/BrokerShell.tsx:395 — // eslint-disable-next-line @typescript-eslint/no-explicit-any
- components/broker/RequestContextPanel.tsx:206 — // eslint-disable-next-line @typescript-eslint/no-explicit-any
- components/borrower/BorrowerShell.tsx:347 — // eslint-disable-next-line @typescript-eslint/no-explicit-any
- lib/prisma.ts:3 — // eslint-disable-next-line no-var
- lib/prisma.ts:5 — // eslint-disable-next-line no-var
- lib/rate-limit.ts:119 — // eslint-disable-next-line no-console
- lib/rate-limit.ts:121 — // eslint-disable-next-line no-console
- lib/rate-limit.ts:158 — // eslint-disable-next-line no-console
- lib/auth.ts:321 — // eslint-disable-next-line @typescript-eslint/no-explicit-any
- lib/admin/AdminDataContext.tsx:98 — // eslint-disable-next-line no-console
- lib/admin/ssrAuth.ts:26 — // eslint-disable-next-line @typescript-eslint/no-explicit-any
- lib/admin/useDrawerResource.ts:45 — // eslint-disable-next-line react-hooks/exhaustive-deps
- prisma/seed.ts:10 — // eslint-disable-next-line no-console
- pages/api/users/me.ts:68 — Comment: 'a future hardening pass should require a fresh OAuth round-trip' (OAuth-only account deletion uses typed ack instead of re-auth)
- pages/api/cron/auto-close-conversations.ts:58 — Comment acknowledging known pagination weakness: 'advance using ID ordering would help here... Break to avoid an infinite loop on a stuck page.'
- pages/admin/brokers/[id].tsx:31 — That legacy page is scheduled for deletion in Phase 2. (refers to /admin/conversations/[id], which is still linked from the Activity drawer)
- components/borrower/BorrowerShell.tsx:34 — Phase 2 may revisit if the dashboard evolves into a pure overview page. (sidebar intentionally minimal)
- lib/fonts.ts:2 — This file kept for any future font config (empty placeholder module)
- /Users/hyunseokcho/Documents/GitHub/mortly/components/borrower/BorrowerShell.tsx:34 — // Sidebar items intentionally minimal: the dashboard already lists requests, so a separate "내 요청" item would point to the same route. Phase 2 may revisit if the dashboard evolves into a pure overview page.
- /Users/hyunseokcho/Documents/GitHub/mortly/pages/api/users/me.ts:69 — // OAuth-only accounts must echo a typed acknowledgment string; a future hardening pass should require a fresh OAuth round-trip.
- /Users/hyunseokcho/Documents/GitHub/mortly/pages/api/auth/signup.ts:110 — // Note: If role is BROKER, the broker profile will be created during onboarding


## Appendix: claims raised and refuted by adversarial verification

- **No PIPEDA consent captured at submission — privacy text is informational only, nothing recorded server-side** [request-form] — REFUTED: The claim's load-bearing assertion — that consent is "client-side only" and "nothing recorded server-side" — is false. The reviewer grep'd schema.prisma for a dedicated consent column and missed an entire server-side consent-persistence pipeline stored in the User.preferences Json column (prisma/schema.prisma:32):

1. lib/legal.ts:1-10 defines CURRENT_LEGAL_VERSION = "2026-04-06" and createLegalAcceptanceMetadata() returning { legalVersion, legalAcceptedAt: ISO timestamp } — exactly the "timesta
- **/api/admin/trends sets a shared-cache header (s-maxage) on an authenticated admin endpoint** [admin] — REFUTED: The cited code exists as claimed (pages/api/admin/trends.ts:56 sets 's-maxage=300, stale-while-revalidate=600' inside withAdmin; stats.ts:128-131 uses 'private'), and no middleware/next.config.mjs/vercel.json override changes it. But the claimed auth bypass cannot occur in this app's configuration. withAdmin (lib/admin/withAdmin.ts:75) calls getServerSession with NextAuth v4.24 in JWT session mode (lib/auth.ts:341-345 'strategy: "jwt"'). The installed next-auth code (node_modules/next-auth/core/


## Appendix: per-area reviewer summaries

### auth-core
Core auth is well-hardened and clearly post-security-review: bcrypt cost-12, constant-time dummy-hash compare to blunt timing enumeration, server-side session revocation via tokenVersion+status re-checked on every session read (lib/auth.ts:266-336), OAuth email_verified guards on BOTH web (lib/auth.ts:155-164) and mobile (mobile-oauth.ts:33-39, 75-85), durable KV-backed login brute-force caps that no longer fail-open, single-source email normalization with a Postgres LOWER(email) functional unique index, and a strict select-role gate. The main structural gap is asymmetric page protection: /admin/* is SSR-gated (adminSSR) but ALL /borrower/* and /broker/* pages ship with getStaticProps/translation-only getServerSideProps and rely on CLIENT-ONLY useSession guards in BorrowerShell/BrokerShell plus the data contexts — acceptable for data exposure (every API is withAuth-protected) but a defense-in-depth/UX weakness. Real launch risks: login brute-force strength depends on Vercel KV being provisioned, no enforced gate forces OAuth users through role selection, a credential-login account-enumeration oracle via the GOOGLE_ACCOUNT branch, and three user-facing strings missing from both locale files so Korean users see English.

### auth-recovery
The password reset and email verification area is in strong shape security-wise: reset tokens are 32-byte random values stored SHA-256 hashed with a unique index, single-use, 1-hour expiry, with tokenVersion bumped on reset so old JWT sessions die within the 5s session-cache TTL; forgot-password pads response timing to defeat enumeration; verify-email uses timingSafeEqual, a 5-attempt-per-code burn, and two-layer durable (Vercel KV) rate limits; login is gated on emailVerified and has per-IP/per-email brute-force caps. The main defects are frontend: the resend-code handler on verify-email.tsx treats any non-429 failure (including 502 email-send failure) as success and shows "New code sent", reset-password.tsx flashes "Invalid Link" before router.query hydrates, and unverified users redirected from login face a forced 60s wait with an almost-certainly-expired code. i18n is mostly complete in both ko/en except raw English API error strings rendered on localized pages, a missing auth.tooManyAttempts key, and password-reset emails that default to Korean (and link to the Korean page) because preferences.locale is never set at signup. Test coverage exists only for verify-email; forgot-password, reset-password, and resend-code APIs and all three pages have no tests.

### request-form
The mortgage inquiry form (3-step RequestForm + RequestFormLayout + POST /api/requests) is functionally solid on the happy path: category branching works, product types are enum-validated server-side, new requests correctly default to PENDING_APPROVAL with a bilingual status banner, submission is rate-limited (10/min/user via KV), and notes are rendered React-escaped everywhere (no XSS found; the only dangerouslySetInnerHTML is JSON-LD in SEO.tsx). However, there are serious gaps: the homepage/how-it-works/404 CTAs send logged-out visitors to /borrower/request/new which renders a blank page (returns null before BorrowerShell's /login redirect can run); the edit flow always PATCHes the full form so any request with >=1 conversation hits a blanket 409 even for notes-only edits; sessionStorage draft restore loses/corrupts income-by-year data because the year-select state is not rehydrated; server validation is materially looser than the client (timeline/notes/annualIncome/incomeTypes/province unvalidated or free-form); there is no PIPEDA consent capture at submission; 11 i18n keys are missing from BOTH locales and all server error strings are English-only but rendered verbatim in the UI. Borrower form offers all 13 provinces/territories while broker pages only list 10.

### broker-flow
The broker experience is architecturally solid (shared shell, polling context, server-enforced verification gating on browse/detail/conversation-create) but has several real defects: the default "Only unresponded" browse filter is a silent no-op due to frontend/backend contract drift, the marketplace is hard-capped at the 20 newest requests with no pagination UI, and 49 broker-area translation keys are missing from BOTH locale files, producing mixed Korean/English UI in core flows of a bilingual product. Secondary issues include a FREE-tier credit-CTA gap on request detail, verified brokers being able to rewrite license/brokerage without re-verification, admin verification surfaces rendering the literal string "null" for license-less brokers (license optional since migration 20260511), and two promised features that do not exist anywhere: a borrower-facing public broker profile page and any profilePhoto upload/render path.

### messaging
Borrower-broker messaging is architecturally solid: participant-only authorization is enforced and tested (IDOR test), credit deduction is race-safe (Serializable tx + real-DB concurrency tests), the prior Supabase Realtime data-breach was redesigned into a content-free "sync" broadcast with a 5s polling fallback, and XSS is prevented by React text rendering. However, the security of that redesign still rests on Supabase dashboard state (RLS deny-all + realtime publication membership) that cannot be verified from code, and several functional gaps remain: the server accepts messages into CLOSED conversations (and closed-conversation unread badges are suppressed, so such messages are near-invisible), system messages are returned without their isSystem flag and render as if a participant typed them, the auto-close cron closes threads silently (no system message, no realtime nudge, no push), and message history beyond the latest 50 messages is unreachable because neither frontend implements the pagination the API supports. The broker messages page and the shared RequestContextPanel also leak a significant amount of hardcoded/missing-key English (and some Korean-fallback-to-English-users) strings.

### payments
The Stripe payments area is well-engineered overall (signature verification, idempotency ledger, atomic credit decrement with real-DB concurrency tests, server-pinned redirect origins), but has several money-correctness defects: scheduled downgrades bill the renewal cycle at the OLD higher price while granting the NEW lower tier's credits; pendingTier is never cleared on cancellation/re-checkout so a stale downgrade can silently apply to a fresh subscription; and payment-failed PREMIUM brokers keep unlimited conversation creation because invoice.payment_failed resets credits but not subscriptionTier. The post-upgrade success banners reference two i18n keys (broker.planUpdating, broker.planUpdatePending) that exist in neither locale, so users see raw keys right after paying. Webhook event handling is at-most-once: a crash/timeout after the ledger insert permanently drops the event.

### admin
The admin panel is architecturally solid on the API side — every handler under pages/api/admin/** is wrapped in withAdmin (session + ADMIN role + Origin/Referer CSRF gate + KV-backed mutation rate limit), SSR pages gate via adminSSR, and suspend/ban correctly bumps tokenVersion which lib/auth.ts enforces. However, several admin features are half-built: credit adjustment and admin-notice sending have APIs/UI entry points that dead-end (no modal exists), AdminNotice rows are never created anywhere so the user-facing notices dropdown is permanently empty, the inbox drawer shows hardcoded fake "automated checks" that mislead broker verification, borrowers are never notified (email/notice/push) of request approval or rejection, and the System settings page renders two fields the API rejects, breaking saves. The new admin UI is effectively Korean-only: 289 of 318 t() keys it uses are missing from BOTH locale files (inline Korean fallbacks render regardless of locale), plus many fully hardcoded Korean strings. Maintenance mode is client-side cosmetic only. Test coverage exists for helpers (CSRF, audit, inbox queue, rate-limit) but almost no integration coverage for the admin mutation endpoints.

### i18n
The en/ko catalogs (public/locales/{en,ko}/common.json) are perfectly mirrored at 1,819 keys each with zero missing keys between them — but 343 distinct keys referenced by t() in code do not exist in EITHER catalog. The UI survives only via inline fallback literals: ~317 call sites carry Korean-only fallbacks (EN locale shows Korean) and ~25 carry English-only fallbacks (KO locale shows English), and 2 call sites in the broker billing flow pass an options object instead of a fallback, rendering raw key strings like "broker.planUpdating" to paying brokers. Beyond the catalog drift: password-reset emails are always Korean because user.preferences.locale is never written anywhere; admin-generated chat system messages are English-only to Korean users; API validation errors are untranslated English surfaced verbatim in 8 user-facing pages; date formatting hardcodes en-CA in 7+ Korean-facing sites; and the EN locale choice is lost on every full-page round-trip (OAuth, signOut, Stripe checkout/portal, email links) and never persisted (localeDetection:false, no NEXT_LOCALE cookie). The admin console is hardcoded Korean throughout (likely intentional). No test asserts catalog parity or key existence, which is why the drift accumulated unnoticed.

### notifications
Mortly's outbound notification surface is thin: only 3 email types exist (signup/resend verification code, password reset, admin-to-admin new-admin broadcast) and 3 push types (new chat message, borrower-inquiry, broker-inquiry). Every lifecycle event that should notify users — borrower request approved/rejected, broker verified/rejected, subscription payment failed, request expired, conversation auto-closed, new lead for brokers — is completely silent in code. The in-app AdminNotice system is a stub: the API and Navbar bell UI exist and poll every 30s, but no production code path ever creates an AdminNotice row (only prisma/seed.ts does), so the bell is permanently empty. Notification preferences (preferences.emailNotifications/pushNotifications, DeviceToken.mutedUntil) are stored but never enforced, and push delivery relies on fire-and-forget promises after the HTTP response which is not guaranteed to complete on Vercel serverless.

### public-deploy
Public/marketing surface is well-built (localized, SEO component with canonical/hreflang, strict security headers, legal consent versioning at signup) and tsc --noEmit passes clean. However, the pricing page advertises PRO/PREMIUM notification features that do not exist anywhere in the backend, is itself inaccessible to logged-out visitors despite being in the sitemap, and shows fabricated-looking discount anchors and homepage stats (500+/50+/95%). SEO infra has concrete breakages: the default og:image URL 404s on every page, and the generated sitemap leaks /en-prefixed auth-only routes with broken /en/en hreflang alternates. PostHog analytics initializes for every visitor with no consent banner anywhere in the codebase (PIPEDA/Quebec Law 25 exposure), and the privacy page carries no effective date despite lib/legal.ts versioning. The LiveActivityMarquee uses REAL database data (hashed keys, no PII) — not fabricated activity.

### data-layer
Data layer is well-engineered overall (CSPRNG public IDs, KV-invalidated settings cache, idempotent Stripe ledger, careful FK-ordered account deletion), but there is one confirmed deploy-breaking schema/migration drift: User.appleId exists in prisma/schema.prisma and is queried by both Apple OAuth paths, yet no migration creates the column. The request lifecycle has real gaps: nothing ever sets IN_PROGRESS automatically, brokers can spend credits opening conversations on EXPIRED/CLOSED/REJECTED/PENDING_APPROVAL requests (no status check in POST /api/conversations), expiry happens silently with no user notification, and the auto-close cron's "borrower never engaged" filter uses a senderId!="SYSTEM" condition that never matches anything plus an unordered take:10 page. Dead-code load is significant: ~80% of lib/constants.ts is an unused mirror of inline magic numbers, lib/csvExport.ts and four components (Pagination, RequestCard, Tooltip, TrendChart + the recharts dependency) have zero importers, the AdminNotice send feature has no create path anywhere (its dedupeKey column is dead), and /api/admin/credits, /api/admin/brokers GET, /api/preferences, /api/admin/users/create have zero web consumers. Locale files (ko/en) are perfectly key-synced (1819 keys each), but system chat messages and getRequestTitle are hardcoded English. purge-expired (the PIPEDA PII cron) has zero test coverage despite being the only privacy-retention enforcement.

### ux-states
UX-state and responsive sweep of all 38 pages plus shared shells/contexts. The codebase has unusually good loading skeletons, empty states, double-submit protection, and modal keyboard/outside-click handling, and Korean font rendering is correctly solved (Pretendard via html[lang=ko] + global break-keep). However, the bilingual promise is broken on the core authed surfaces: ~385 t() keys used by the borrower/broker dashboards, broker request pages, and the entire admin app are missing from BOTH public/locales/en/common.json and ko/common.json, so single-language inline fallbacks (a mix of Korean and English) render for both locales. Other systemic problems: several data-fetch failures silently render designed empty states ("no users", "no billing history", "no requests") instead of errors; the broker billing checkout/portal flow fails with console.error only; the shared Btn as="a" primitive renders plain anchors that drop the /en locale prefix and force full reloads on 19 primary CTAs; and the mobile Navbar notifications button is dead because its dropdown only exists inside the desktop-only container. Admin is desktop-only by layout (fixed two-pane grids) and its inbox displays fabricated "automated check" results that could mislead approval decisions.

### gap:File upload / document handling (beyond broker profile photo)
File upload/document handling is entirely absent from Mortly by design and by omission. Confirmed: there is no upload endpoint, no file input, no multipart parsing, and no storage integration anywhere in pages/, lib/, or components/. The only file-adjacent feature, Broker.profilePhoto, is a write-only dead field — the API accepts a pasted HTTPS URL (pages/api/brokers/profile.ts:65-68) but no UI lets brokers set it and nothing anywhere renders it (the only <img> in the app is the logo in components/BrandMark.tsx:49; the borrower comparison page renders an initials circle and the server select at pages/api/requests/[id].ts:32-48 never exposes the field), so the feared third-party image hotlinking exposure does not currently exist. Chat is text-only (Message.body VarChar(5000), no attachment column or UI), the request form collects no documents, and conversations auto-close on inactivity — meaning income/ID document exchange for any real mortgage deal must happen off-platform, outside the 180-day PII redaction cron, while neither the chat disclaimer nor the privacy page mentions documents or retention. The locale copy that told brokers to discuss "required documents" (broker.introMessageHint, en/ko common.json:493) is itself dead — all four broker.introMessage* keys are unreferenced in this repo. No marketing/terms/privacy copy falsely promises document handling. Side findings: the broker profile error contract mismatch (client reads data.message, server returns {error}) and nine missing broker.* i18n keys on the broker request detail page that show wrong-language fallback text.

### gap:Borrower onboarding / first-run experience (checklist says onboarding for BOTH roles; only broker side was reviewed)
Borrower onboarding is an intentional zero-wizard design (signup collects name/email/password/role; the request form collects everything brokers act on; contact is chat-only — User has no phone column), and the credentials path signup → verify-email → login?verified=true → /borrower/dashboard is coherent. However the first-run funnel has a launch-blocking dead end: the homepage and how-it-works "Get Started Free / Submit Your Request" CTAs link every logged-out visitor to /borrower/request/new, which renders a permanently blank page because the page returns null before BorrowerShell (which owns the login redirect) can mount. The borrower dashboard/shell ships ~34 t() keys missing from BOTH locale files with mixed ko/en hardcoded fallbacks, and all dashboard Btn-as-anchor CTAs drop the /en locale prefix, so English users are silently flipped to Korean. user.preferences (locale/theme/notifications) is a write-only dead API on web — no UI reads or writes it — which confirms the password-reset-email-always-Korean bug, and needsNameEntry (Apple OAuth users with null names) has no web consumer.

### gap:Mobile responsiveness of borrower/broker (non-admin) authed surfaces, especially chat
Mobile responsiveness of the borrower/broker authed surfaces is structurally sound: both full-page chat UIs correctly stack list/thread panes below md via mobileShowChat/mobileView state with back buttons, the RequestContextPanel is reachable on mobile through an lg:hidden toggle that opens a fixed right drawer (w-[min(100vw,360px)]) with its own close button, and the request-form 3-column layout collapses to one column rendering the identical LiveSummary component (same data) below the form. The serious gaps are not layout but polish/contract issues: the broker billing success banner renders raw i18n keys (broker.planUpdating / broker.planUpdatePending missing from BOTH locale files) after a paid upgrade; admin notices are completely unreachable on mobile (Navbar dropdown only mounts inside a hidden md:flex container, and neither app shell has a bell); broker chat swallows list-load errors; and ~25 chat/form locale keys are missing or hardcoded, producing mixed Korean/English UI in the chat context panel for both languages. The 14px chat input plus no viewport zoom-suppression means iOS Safari will auto-zoom the locked 100dvh chat shell when the keyboard opens (needs device verification). Navbar does not overflow at md+ (it collapses to a hamburger below md) but its mobile menu duplicates Dashboard/Messages links and contains the dead notifications button.

### borrower-flow
Borrower-experience review of Mortly (dashboard, request detail, broker-responses page, profile, account deletion, supporting APIs). Core flows are largely implemented and ownership/IDOR checks on /api/requests/[id] are solid, account deletion is a true hard-delete with FK-safe manual cascade, and the post-submission approval-wait experience (PENDING_APPROVAL banner + stepper) works. The biggest problems: (1) the API supports borrower-initiated request close (PUT status=CLOSED) and the delete endpoint explicitly tells users to 'close the request instead', but no UI anywhere lets a borrower close a request, stranding requests that have conversations; (2) the dashboard has no reachable error state — context fetch failures are silently swallowed and render the 'create your first request' empty state; (3) the request detail page shows an infinite skeleton on any non-404 fetch failure; (4) 35 i18n keys used by borrower pages are missing from BOTH en and ko common.json, so inline fallbacks produce a mixed Korean/English UI in both locales; (5) BorrowerDataContext silently truncates at the API's 20-item page while claiming to hold all requests. rejectionReason IS surfaced (dashboard banner + detail banner), but rejected requests can never be removed/dismissed. The brokers/[requestId] page is real (shows actual conversations/brokers who responded, sortable), not a stub. components/RequestCard.tsx is dead code with a broken /requests/:id link, and /api/preferences has no web consumers.
