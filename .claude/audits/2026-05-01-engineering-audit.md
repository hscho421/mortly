# Mortly — Production Engineering Audit
**Date:** 2026-05-01
**Repos audited:** `mortly` (Next.js web) + `mortly-mobile` (Expo RN)
**Auditor:** Claude (4 parallel deep-investigation agents + verification pass)
**Scope:** Architecture, hidden bugs, scalability, DB efficiency, UX, mobile parity, test coverage
**Status:** ALL FIXABLE FINDINGS IMPLEMENTED 2026-05-01 (509 tests passing). A handful of agent findings turned out to be misdiagnoses on verification (Navbar useEffect, push fire-and-forget, M-8 hydration locale, M-23 admin shortcuts, M-16 admin convo refresh, LB-3 push await, S-10 interval leak, S-11 install-guard race, S-13 notification listener) and are noted but unchanged because the code was already correct. N-12 (shared types package) and N-7/N-15 (architecture extracts) are deferred as design-decision-grade refactors.

This audit is separate from and complementary to `2026-05-01-security-audit.md`. Findings here are quality, scale, reliability, and UX. Some agent findings were dropped after verification (e.g. Navbar useEffect was actually correct). Severity is assigned based on production impact, not popularity.

---

## 🔴 LAUNCH BLOCKERS (Critical)

### LB-1. Mobile: Android cannot delete password-based accounts (Apple guideline 5.1.1 violation)
**File:** [mortly-mobile/app/(tabs)/profile.tsx:101-115](../../../mortly-mobile/app/(tabs)/profile.tsx#L101)
`Alert.prompt` is iOS-only; Android falls back to a "use the website" message. App Store will accept this; **Google Play guideline equivalent will reject** an account-delete flow that doesn't work in-app on Android.
**Fix:** Build a dedicated `app/delete-account-password.tsx` screen with a `TextInput`. Both platforms navigate to it. ~30 min.

### LB-2. Mobile: 401 handler doesn't clear stale token before logout redirect
**File:** [mortly-mobile/lib/api.ts:53-56](../../../mortly-mobile/lib/api.ts#L53)
On 401, `onUnauthorized()` is called, but the revoked token stays in `SecureStore`. After my new `tokenVersion` revocation rolls out, this will trap users in a re-login loop because the next `request()` re-attaches the dead cookie.
**Fix:**
```ts
if (res.status === 401) {
  await SecureStore.deleteItemAsync("session_token");
  onUnauthorized?.();
  throw new ApiError(401, "Unauthorized");
}
```

### LB-3. Mobile: push registration race — null token sent to server
**File:** [mortly-mobile/lib/auth-context.tsx:136-145](../../../mortly-mobile/lib/auth-context.tsx#L136)
`registerForPushNotifications()` is called without await; `registerDeviceToken` fires immediately with possibly-undefined token. Server stores garbage rows.
**Fix:** Await the token-fetch before calling the API; reject if token is null/undefined.

### LB-4. Web: settings cache TTL 10s × per-lambda → inconsistent credit grants
**File:** [lib/settings.ts:10-15](lib/settings.ts#L10)
`invalidateSettingsCache()` clears only the local instance. Other warm lambdas keep stale `*_tier_credits` for up to 10s. Stripe webhook on a stale lambda grants the old credit count, creating per-broker drift.
**Fix:** Either drop TTL to 1s (cheap — settings is one row) or push invalidation through KV: `await kv.set("settings:version", Date.now())` on update; `getSetting` re-reads when version bumps.

### LB-5. Web: `Report.targetType` is `String`, not enum
**File:** [prisma/schema.prisma:221](prisma/schema.prisma#L221)
DB allows any string. Existing code mixes `"BROKER"` / `"broker"` (e.g. [pages/api/users/me.ts:108](pages/api/users/me.ts#L108) writes `"broker"` lowercase). Admin filter expects uppercase. Reports become orphaned.
**Fix:** Define `enum ReportTargetType { BROKER REQUEST CONVERSATION USER }`; backfill `UPDATE reports SET target_type = UPPER(target_type)`; update [pages/api/users/me.ts:108](pages/api/users/me.ts#L108) to `"BROKER"`.

### LB-6. Web: borrower request mutation list-endpoint loads up to 50 conversations per request
**File:** [pages/api/requests/index.ts:67-77](pages/api/requests/index.ts#L67)
`include: { conversations: { take: 50 } }` runs on broker browse page (paginated 20 per page). 20 × 50 = 1000 conversation rows pulled per request, with nested `broker.userId` selects. Mobile loads this on every browse-tab open.
**Fix:** The browse page only needs `_count.conversations` and possibly the broker's own conversation flag. Drop the inner conversations include; if you need "I already chatted with this borrower," compute it via a single `IN` query on the page.

### LB-7. Web: conversation list loads ALL block rows on every GET
**File:** [pages/api/conversations/index.ts:31-40](pages/api/conversations/index.ts#L31)
Two `findMany` calls — sequential (not parallel) — both unbounded, both spread into a Set. A user with 1000 blocks loads 2000 rows per `/api/conversations` GET.
**Fix:**
```ts
const blocks = await prisma.userBlock.findMany({
  where: { OR: [{ blockerId: id }, { blockedId: id }] },
  select: { blockerId: true, blockedId: true },
});
const blockedUserIds = new Set(blocks.flatMap(b => [b.blockerId, b.blockedId]).filter(x => x !== id));
```
One query instead of two; parallelizable; trivially capped if you add `take: 5000`.

### LB-8. Mobile: chat FlatList has no perf tuning, force-scrolls on every contentSize change
**File:** [mortly-mobile/app/chat/[id].tsx:414-433](../../../mortly-mobile/app/chat/%5Bid%5D.tsx#L414)
`onContentSizeChange={() => flatListRef.current?.scrollToEnd()}` fires on every render; with 50+ messages and bursty inbound, Android drops to 20fps.
**Fix:**
- Add `getItemLayout` (measure typical bubble height once)
- Set `windowSize={10}`, `maxToRenderPerBatch={20}`, `initialNumToRender={20}`
- Replace the auto-scroll with: only scroll if user was at bottom (`onScroll` tracks position), or scroll only on outbound-message-sent.

### LB-9. Web: Stripe webhook handler swallows ledger-rollback failure
**File:** [pages/api/webhooks/stripe.ts:113-119](pages/api/webhooks/stripe.ts#L113)
On handler error, we delete the ledger row to allow retry: `await prisma.processedStripeEvent.delete(...).catch(() => {})`. If the delete itself fails (KV outage, DB blip), Stripe retries the event, sees the ledger entry, and 200s — the event is **silently lost**.
**Fix:** Throw on rollback failure. Stripe will retry the webhook; that's the correct behavior. Or alert via PostHog: `posthog.capture({ event: "webhook_ledger_rollback_failed" })`.

### LB-10. Web: Stripe webhook never resets credits on `invoice.payment_failed`
**File:** [pages/api/webhooks/stripe.ts:251-273](pages/api/webhooks/stripe.ts#L251)
Status flips to PAST_DUE but `responseCredits` stays at the paid-tier amount. Past-due brokers keep messaging until the subscription is fully cancelled (which can take Stripe's full grace period — typically 3 weeks).
**Fix:** In `handleInvoicePaymentFailed`, set `broker.responseCredits = await getCreditsForTier("FREE")` in the same transaction — or to 0. Then re-grant on `invoice.paid` retry.

---

## 🟠 MUST FIX BEFORE SCALE (High)

### S-1. Web: admin user-detail eager-loads broker `_count.conversations` + 10 nested conversations
**File:** [pages/api/admin/users/[id].ts:46-61](pages/api/admin/users/%5Bid%5D.ts#L46)
For a broker with 5K conversations, the `_count` triggers a full join. Nested take:10 is fine, but `_count` defeats it.
**Fix:** Drop `_count.conversations` from the nested selector; if you need it, run a separate scoped count.

### S-2. Web: conversation `unreadCount` builds N-clause OR per-user
**File:** [pages/api/conversations/index.ts:91-104](pages/api/conversations/index.ts#L91)
For users with 500+ active conversations, the `where.OR` clause has 500 entries → query planner may not use indexes well. Will degrade non-linearly.
**Fix:** Pre-compute unread count via materialized view OR use raw SQL:
```sql
SELECT conversation_id, COUNT(*)
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
WHERE c.broker_id = $1 AND m.sender_id != $1
  AND m.created_at > COALESCE(c.broker_last_read_at, '1970-01-01')
GROUP BY conversation_id
```

### S-3. Web: cron `findMany` then `updateMany` is unbounded
**File:** [pages/api/cron/auto-close-conversations.ts:46-62](pages/api/cron/auto-close-conversations.ts#L46)
At 100K active conversations with a 72h backlog, this loads everything into Lambda memory then issues a giant updateMany. OOMs the function.
**Fix:** Page it: `WHERE updatedAt < cutoff LIMIT 1000`, loop until empty. Each iteration is its own atomic update.

### S-4. Web: admin/stats fires 10 parallel COUNT(*) on every poll
**File:** [pages/api/admin/stats.ts](pages/api/admin/stats.ts)
At 1M users, 10 parallel full-table counts every time an admin tab refreshes (every 30-60s). Multiple admins = multiplicative load. Will pin the Postgres pooler.
**Fix:** Move to a `dashboard_stats` table refreshed by cron every 5 min; admin reads the row instead of running counts. ~30 min refactor.

### S-5. Web: BorrowerRequest table missing `status` index
**File:** [prisma/schema.prisma:109-112](prisma/schema.prisma#L109)
Has `(borrowerId, status)` and `(status, createdAt)` but not just `(status)`. Queries that filter by status alone (admin tabs, broker browse marketplace) do a partial index scan that gets slow at scale.
**Fix:** Add `@@index([status])`.

### S-6. Web: messages spam-guard uses groupBy on full conversation history
**File:** [pages/api/messages/index.ts:79-89](pages/api/messages/index.ts#L79)
For a 10K-message conversation, every send fires a `groupBy` over the full history just to count broker vs borrower messages. ~500ms per send.
**Fix:** Cache message counts on the Conversation row (`brokerMessageCount`, `borrowerMessageCount`), increment in the same transaction as message create. Or only run the spam-guard when `borrowerMessageCount === 0`.

### S-7. Web: `lib/auth.ts` session callback hits DB on every session read
**File:** [lib/auth.ts:201-220](lib/auth.ts#L201)
Necessary for the `tokenVersion` revocation gate (security correct), but every page render → `useSession()` → `/api/auth/session` → DB query. With SSR, multiple pages = multiple round-trips.
**Fix:** Cache the result for N seconds keyed by `userId + tokenVersion`. Even a 5s in-memory cache reduces DB reads 90%+. Trade-off: revocation propagates with up to 5s lag instead of instant.

### S-8. Web: admin lists fetch full nested user records they don't display
**File:** [pages/api/admin/conversations/index.ts:24-49](pages/api/admin/conversations/index.ts#L24), [pages/api/admin/brokers/[id].ts:13-30](pages/api/admin/brokers/%5Bid%5D.ts#L13)
Use `include` (full record) where `select` (subset) would do. ~5KB extra per row over the wire.
**Fix:** Replace `include` with `select` listing only the fields the UI uses.

### S-9. Mobile: API helper has no retry / exponential backoff
**File:** [mortly-mobile/lib/api.ts:14-72](../../../mortly-mobile/lib/api.ts#L14)
Single fetch, 10s timeout, no retry. On flaky cellular networks (LTE handoff, elevator), every call is a fresh failure. Apple's reviewers explicitly test this.
**Fix:** Wrap idempotent GETs with `[100ms, 300ms, 1s]` backoff on network errors / 5xx. Don't retry POST/PATCH/DELETE.

### S-10. Mobile: 30s unread polling interval recreated on every login → leak
**File:** [mortly-mobile/lib/auth-context.tsx:110-116](../../../mortly-mobile/lib/auth-context.tsx#L110)
Login → `setInterval(...)` → user logs out before tick → cleanup → user logs back in → another interval, but the first one's `clearInterval` only fires if the EFFECT cleanup ran. If the effect re-ran without unmounting, intervals stack.
**Fix:** Track the interval in a `useRef`; clear before creating: `if (intervalRef.current) clearInterval(intervalRef.current);`.

### S-11. Mobile: install-guard not awaited → stale token race on cold start
**File:** [mortly-mobile/lib/auth-context.tsx:104-107](../../../mortly-mobile/lib/auth-context.tsx#L104)
`ensureFreshInstallCleared()` runs in parallel with the first session refresh. After uninstall+reinstall, the old token can briefly authenticate before the guard wipes it.
**Fix:** `await ensureFreshInstallCleared(); await refresh();`.

### S-12. Web: form state lost on browser refresh in multi-step request creation
**File:** [components/RequestForm.tsx](components/RequestForm.tsx) + [pages/borrower/request/new.tsx](pages/borrower/request/new.tsx)
2-step form, no sessionStorage backup. Refresh = lose everything. Borrowers DO refresh.
**Fix:** Save to `sessionStorage` on every change (debounced 500ms), restore on mount, clear on submit.

### S-13. Mobile: deletes the conversation listener but not its keep-alive reference
**File:** [mortly-mobile/app/_layout.tsx:65](../../../mortly-mobile/app/_layout.tsx#L65)
Notification listener cleanup runs only on root unmount (never, in practice). After logout, a tapped notification routes to the post-auth deep link with no auth, hard-crashing.
**Fix:** Re-key the listener subscription on `user?.id` change so it tears down at logout.

### S-14. Web: tests/concurrency requires `TEST_DATABASE_URL` and silently skips
**File:** [tests/concurrency/credits.test.ts:26](tests/concurrency/credits.test.ts#L26)
The actual race-condition test is the only thing that catches credit double-spend. If `TEST_DATABASE_URL` isn't in CI, the test passes by skipping — false confidence.
**Fix:** Either fail loudly when env is missing in CI (`if (!process.env.TEST_DATABASE_URL) throw new Error(...)` instead of `it.skip`), or stand up a Postgres service in CI.

### S-15. Web: no IDOR test for cross-conversation message access
**File:** [tests/integration/api/conversations/](tests/integration/api/conversations/)
Tests check participant authorization in code, but no test asserts: "user A cannot read messages from a conversation where they're not borrower or broker." If a future refactor breaks the participant check, no test catches it.
**Fix:** Add a test: seed two conversations, seed user not-a-participant, GET → 403.

---

## 🟡 MEDIUM PRIORITY CLEANUP

### M-1. Web: `as any` casts on session.user in 4 files
- [lib/auth.ts:240-254](lib/auth.ts#L240)
- [components/Navbar.tsx:46](components/Navbar.tsx#L46)
- [components/Footer.tsx](components/Footer.tsx) (after my fix)

These bypass type safety. Add `interface MortlySessionUser { id: string; role: Role; publicId: string; name: string|null; email: string|null; needsRoleSelection: boolean; needsNameEntry: boolean; }` and a module augmentation for next-auth. Single source of truth.

### M-2. Web: cron handlers manually re-implement same secret check
Both [pages/api/cron/auto-close-conversations.ts](pages/api/cron/auto-close-conversations.ts) and [pages/api/cron/expire-requests.ts](pages/api/cron/expire-requests.ts) have ~10 lines of identical auth boilerplate. Already centralized in `lib/cron.ts` after the security pass — but still duplicate the method-allowlist check. Move to `withCron()` wrapper analogous to `withAdmin`.

### M-3. Web: optimistic-clear-then-fetch in borrower messages
**File:** [pages/borrower/messages.tsx:283-296](pages/borrower/messages.tsx#L283)
Unread badge clears before message fetch completes. If fetch fails, badge is wrong.
**Fix:** Move the clear into the `.then()` of the fetch.

### M-4. Web: optimistic message append before send completes
**File:** [pages/borrower/messages.tsx:299-332](pages/borrower/messages.tsx#L299)
Message appears in chat instantly. If server rejects (closed conversation, blocked, rate-limited), it stays in the UI with no error.
**Fix:** Either roll back on error (remove the optimistic message + show toast), or only append on success.

### M-5. Web: broker billing waits an arbitrary 2s for webhook
**File:** [pages/broker/billing.tsx:251](pages/broker/billing.tsx#L251)
`setTimeout(2000)` then refetch. Webhooks routinely take 5-10s. Refetch fires before tier updates → user sees old plan.
**Fix:** Poll `getBrokerProfile()` until `subscriptionTier` matches the requested tier (or 10s timeout). Show "Updating your plan..." in the meantime.

### M-6. Web: Toast/Alert/Modal stacking is undefined (z-50 collision)
**Files:** [pages/borrower/messages.tsx:405-427](pages/borrower/messages.tsx#L405), [pages/borrower/messages.tsx:817](pages/borrower/messages.tsx#L817)
Both close-confirm dialog and context drawer use `z-50`. If both open, render order is undefined.
**Fix:** Establish layers: backdrop (40), drawer (50), modal (60), toast (70). Apply consistently.

### M-7. Mobile: every render re-creates `Intl.NumberFormat` for invoices
**File:** mobile billing screen (analogous to web's [pages/broker/billing.tsx:121-129](pages/broker/billing.tsx#L121))
`new Intl.NumberFormat()` is expensive; created per render.
**Fix:** `useMemo(() => new Intl.NumberFormat(...), [currency, locale])`.

### M-8. Web: hydration locale mismatch in chat date format
**File:** [pages/borrower/messages.tsx:383](pages/borrower/messages.tsx#L383)
`toLocaleDateString()` uses browser default; SSR uses Node default. React logs hydration warnings; user sees flicker.
**Fix:** Pass `router.locale` explicitly: `date.toLocaleDateString(router.locale, {...})`.

### M-9. Mobile: visibility-change refetch + Realtime subscription = double fetch
**File:** [pages/borrower/messages.tsx:250-281](pages/borrower/messages.tsx#L250) (analogous in mobile)
Tab becomes visible → both poll + Realtime fire. Bandwidth waste; potential UI thrash.
**Fix:** If Realtime is connected (`subscription.state === "joined"`), skip the visibility-poll.

### M-10. Web: admin `bulk.ts` accepts duplicate IDs without dedup
**File:** [pages/api/admin/users/bulk.ts:50-58](pages/api/admin/users/bulk.ts#L50)
`POST { ids: ["a","a","b"] }` produces two audit rows for `a`. Confuses forensics.
**Fix:** `if (new Set(ids).size !== ids.length) return 400;`.

### M-11. Web: `parseInt(val, 10) || 0` swallows misconfigured settings
**File:** [lib/settings.ts:35-36](lib/settings.ts#L35)
String `"foo"` → `NaN` → `|| 0` → silently 0. A misconfigured `request_expiry_days = "thirty"` closes everything immediately.
**Fix:** Throw on `isNaN(parsed)`. Loud failure beats silent corruption.

### M-12. Web: `withAuth` rate-limit error message doesn't tell admins what was hit
**File:** [lib/withAuth.ts:96](lib/withAuth.ts#L96)
"Too many requests — slow down" doesn't include path/method. Hard to debug.
**Fix:** Include `req.method` + `req.url` in the error message.

### M-13. Mobile: locale change fires un-debounced device-token upserts
**File:** [mortly-mobile/lib/auth-context.tsx:147-154](../../../mortly-mobile/lib/auth-context.tsx#L147)
Rapid en→ko→en toggle = 3 API calls. Only the last matters.
**Fix:** Debounce 500ms via `useRef<NodeJS.Timeout>`.

### M-14. Web: PostHog token reused server-side
**File:** [lib/posthog-server.ts](lib/posthog-server.ts)
Uses the same `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` for server events. Public tokens are safe for ingestion but hide server-vs-client attribution.
**Fix:** Use a separate `POSTHOG_SERVER_KEY` env var for server captures.

### M-15. Web: error-boundary fallback shows no detail in dev
**File:** [pages/_app.tsx:13-26](pages/_app.tsx#L13)
Dev-mode crashes show generic "try again" instead of the actual error stack.
**Fix:** `if (process.env.NODE_ENV === "development") render error.message + error.stack`.

### M-16. Web: chat `Conversation` status change in admin doesn't refresh the conversation list
**File:** [pages/admin/conversations/[id].tsx](pages/admin/conversations/%5Bid%5D.tsx)
Closing a conversation on the detail page doesn't invalidate the list page cache. Admin returns to list, sees still-active.
**Fix:** Call `mutate(/api/admin/conversations)` (SWR) or `invalidate("CONV")` (your AdminDataContext pattern) after the PUT.

### M-17. Mobile: chat scroll-to-end uses 100ms timeout (unreliable on slow Android)
**File:** [mortly-mobile/app/chat/[id].tsx:247-249](../../../mortly-mobile/app/chat/%5Bid%5D.tsx#L247)
Race between layout pass and scrollToEnd. Slow Android devices often miss it.
**Fix:** Use `onContentSizeChange` only when user was at bottom; otherwise let user scroll manually.

### M-18. Web: `Message.body` no DB-level length cap
**File:** [prisma/schema.prisma:189](prisma/schema.prisma#L189)
Schema is `body String` → Postgres TEXT (1GB). App-level check is the only guard. If the validation regex changes or is bypassed, a huge body persists.
**Fix:** `body String @db.VarChar(5000)`.

### M-19. Web: admin queue's batch publicId resolver doesn't validate completeness
**File:** [pages/api/admin/queue.ts:88-100](pages/api/admin/queue.ts#L88)
If a target was deleted, the batch query returns 0 rows; the response keeps the cuid. Frontend formats it weirdly.
**Fix:** Log a warn when `byType[X].length !== resolved.length`; consider showing "[deleted]" in the UI.

### M-20. Mobile: filter state on browse tab not persisted
**File:** [mortly-mobile/app/(tabs)/browse.tsx](../../../mortly-mobile/app/(tabs)/browse.tsx)
Switch tabs → filter resets. Brokers re-apply filters multiple times per session.
**Fix:** Persist to AsyncStorage on change.

### M-21. Mobile: `loadOlderMessages` swallows 403/404 silently
**File:** [mortly-mobile/app/chat/[id].tsx:261-272](../../../mortly-mobile/app/chat/%5Bid%5D.tsx#L261)
`catch { /* ignore */ }`. User loses access mid-session, button keeps spinning forever.
**Fix:** On error, set a state flag, show "Couldn't load older messages" with retry.

### M-22. Web: ReportButton has un-cleaned setTimeout
**File:** [components/ReportButton.tsx:31-34](components/ReportButton.tsx#L31)
Modal-close timeout fires after the modal is unmounted → "set state on unmounted component" warning.
**Fix:** `useRef<NodeJS.Timeout>` + clear in cleanup or on close.

### M-23. Web: admin keyboard shortcuts (J/K/A/R) referenced in comments but not implemented
**File:** [pages/admin/inbox.tsx:36-39](pages/admin/inbox.tsx#L36)
Comments promise shortcuts; `useAdminShortcuts` hook is referenced but the implementation is incomplete.
**Fix:** Either implement the shortcuts or remove the comments. Stale promises are tech debt.

---

## 🟢 NICE TO HAVE

### N-1. Web: replace `as const` noise in Prisma orderBy clauses ([many files])
### N-2. Web: console-only error reporting in [lib/admin/AdminDataContext.tsx:98-100](lib/admin/AdminDataContext.tsx#L98) — surface to UI banner
### N-3. Mobile: empty state for filtered browse with no results (currently blank screen)
### N-4. Mobile: success-feedback after blocking a user (currently just an Alert that interrupts)
### N-5. Mobile: form state persistence for `new-request.tsx` and `broker-onboarding.tsx`
### N-6. Web: Stripe API version `2026-02-25.clover` is a preview — pin to stable
### N-7. Web: `lib/admin/withAdmin.ts` — extract role / CSRF / rate-limit into 3 named middleware composers; current monolithic wrapper is hard to extend
### N-8. Web: Footer + Navbar duplicate role-routing logic — extract `getDashboardPath(role)`
### N-9. Mobile: Vercel KV credentials, posthog token, etc. logged in dev console — make logging tag-aware
### N-10. Web: Magic numbers everywhere (`30 * 24 * 60 * 60` in [select-role.ts](pages/api/auth/select-role.ts), etc.) — pull into `lib/constants.ts`
### N-11. Web: Several admin pages use `Promise.all([...counts])` patterns — make a `getAdminStatsBatch()` helper
### N-12. Mobile: types.ts duplicates server types — consider `@mortly/shared` package or codegen from Prisma
### N-13. Web: `Subscription` model lacks unique on `(stripeSubscriptionId, currentPeriodStart)` — would catch double webhook processing at DB level
### N-14. Web: `AdminNotice` lacks idempotency key — duplicate notices possible on retry
### N-15. Web: Borrower & Broker `Shell` components duplicate ~80% of layout logic — extract `<RoleShell role>`

---

## 📊 SCORES

| Dimension | Score |
|---|---|
| **Code quality** | **72 / 100** |
| **Production readiness** | **63 / 100** |
| **Technical debt (lower = worse)** | **48 / 100 → owe ~52** |

**Code quality (72):** Well-organized folder structure, consistent naming, type-safe Prisma usage, good audit/observability primitives (`AdminAction` table, `withAdmin`/`withAuth` wrappers). Loses points for: ~30 `as any` escape hatches, optimistic UX patterns without rollback, swallowed errors in catch blocks, magic numbers, duplicated cron auth boilerplate, inconsistent select/include usage.

**Production readiness (63):** Security is now solid (post-audit). Remaining gaps:
- 5 launch blockers (mostly mobile + 2 webhook reliability issues)
- 15 must-fix-before-scale items (mostly DB efficiency)
- Test coverage has visible holes (no IDOR tests, concurrency tests skip silently in CI, no integration tests for admin endpoints)
- Settings cache propagation is per-lambda (silent inconsistency window)

Honest read: **you can ship to a few hundred users**. You'll start hitting walls at ~10K active users (admin pages slow; conversation list slow for power users) and credit-grant-drift at ~50 brokers.

**Technical debt (48 owed):** Manageable. The big-ticket items (conversation list query architecture, message count denormalization, settings invalidation, admin stats materialization) are all 1-3 day refactors, not weeks. Mobile/web type duplication will bite within 6 months unless addressed.

---

## RECOMMENDED ROADMAP

### Pre-launch (this week)
- LB-1 to LB-10
- S-9, S-10, S-11 (mobile reliability)
- S-14, S-15 (close test gaps)

### Week 2-3 post-launch
- All remaining S-* items
- M-3, M-4, M-5 (visible UX bugs)
- M-10, M-11 (silent failure modes)

### Sprint 2-3
- All M-* items
- N-7, N-8, N-15 (architecture extracts)
- N-13, N-14 (DB hardening)

### Tech debt month
- Settings invalidation (LB-4 long-term fix via KV pub/sub)
- Materialized admin stats (S-4 long-term)
- Shared types package (N-12)
