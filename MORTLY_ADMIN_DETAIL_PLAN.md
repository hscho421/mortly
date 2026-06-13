# Design: Unify the admin user-detail & broker-detail pages

**Status:** Plan / not yet implemented · **Created:** 2026-06-14
**Trigger:** `/admin/users/[id]` and `/admin/brokers/[id]` are substantially redundant; admins bounce users → "전체 프로필" → brokers just to verify a broker.

## 1. The redundancy (evidence from the code map)

| Concern | `/admin/users/[id]` | `/admin/brokers/[id]` | Verdict |
|---|---|---|---|
| Identity header (name, publicId, joined, status badge) | ✅ | ✅ | **duplicate** |
| Email | ✅ | ✅ | **duplicate** |
| Account status moderation (suspend/ban/reactivate) | ✅ → `PUT /api/admin/users/[id]` | ✅ → **same** `PUT /api/admin/users/[id]` | **duplicate (identical endpoint)** |
| Broker profile fields (brokerage, license, province, phone, category, years, bio) | ✅ (BrokerDetails card, broker-only) | ✅ (Profile card) | **duplicate** |
| Credits | ✅ (stat) | ✅ (stat, read-only) | **duplicate** |
| Recent conversations | ✅ | ✅ | **duplicate** |
| Profile **photo** / avatar | ❌ | ✅ | broker page only |
| **Verification** actions (verify/reject/reset) → `PUT /api/admin/brokers/[id]` | ❌ (view-only badge) | ✅ | **broker page only — the real reason it exists** |
| Subscription detail | partial (tier badge) | ✅ (subscription object) | broker page fuller |
| Recent **requests** table | ✅ | ❌ | user page only |
| Send-notice | ✅ | ❌ | user page only (a gap on broker page) |
| Reports count | ✅ | ❌ | user page only |
| Works for borrowers/admins too | ✅ (all roles) | ❌ (brokers only) | user page is the general one |

**Conclusion:** `/admin/brokers/[id]` is ~80% a re-render of what `/admin/users/[id]` already shows. Its only unique, load-bearing capability is the **verification action set**. Everything else is duplicated layout (with subtly different id conventions — the "전체 프로필" link routes by `broker.id`, activity rows by `conversation.id`, etc.).

## 2. Entry points (both pages are reached directly — must repoint, not just delete)

- → `/admin/users/[id]`: people list (열기 + Enter), command palette, activity page (borrower link).
- → `/admin/brokers/[id]`: **the 전체 프로필 link from users/[id]**, **reports page** (BROKER report target, `reports.tsx:215,361`), **inbox** (BRK rows, `inbox.tsx:644`).

So reports + inbox deep-link straight to the broker page for verification work. The consolidation must repoint those to the unified page (and the broker panel must be prominent/scrolled-to for broker users).

## 3. The elegant design — ONE role-aware detail page

Keep a single canonical detail page at **`/admin/users/[id]`** that renders role-appropriate sections, absorbing the broker-specific bits. Delete `/admin/brokers/[id]`.

**Unified `/admin/users/[id]` layout:**
1. **Header** — avatar (photo for brokers, initials otherwise) + name + publicId/joined + badges: role, account-status, and (brokers) verification-status + tier.
2. **User info card** — existing (publicId, email, role, status, emailVerified, joined, updated).
3. **Broker panel** *(rendered only when `user.broker`)* — a single card that absorbs the entire broker page:
   - photo, profile fields (brokerage/license/province/phone/category/years/bio), subscription + tier, credits;
   - **Verification actions** (Verify / Reject / Reset) moved here — with the existing confirm dialogs **and the two-admin `202 PENDING_SECOND_REVIEW` handling ported over** (the brokers page is the only place that handles that response today).
4. **Account actions** — suspend/ban/reactivate + **send-notice** (existing; now brokers get send-notice too — a gap closed for free).
5. **Recent requests** (borrowers) + **recent conversations** (all) — existing.

This removes the bounce: an admin opening a broker from inbox/reports lands on one page with verification + account moderation + profile + photo together.

**Why a single scrolling page, not tabs:** the broker data is small (one card's worth); a "Broker" panel inline is simpler and faster to scan than an Account/Broker tab split. Reserve tabs only if the page grows much larger.

## 4. Data / API changes

- **Reuse the existing concern-split endpoints — they're good:** `PUT /api/admin/users/[id]` = account status; `PUT /api/admin/brokers/[id]` = verification status. The unified page calls **both** as needed. (Do NOT merge the endpoints — account-status vs verification-status are genuinely different operations with different audit actions, guards, and the two-admin gate.)
- Extend the **`GET /api/admin/users/[id]`** broker sub-select to include everything the broker panel needs that isn't already there: `profilePhoto`, `updatedAt` (avatar cache-bust), `subscription`, `bio`, `licenseNumber`, `areasServed`, `specialties` (audit which are already selected vs missing).
- The verification `PUT /api/admin/brokers/[id]` looks up broker **by internal id only** — the unified page has `user.broker.id`, so that's fine (no change needed). If we ever want to call it by publicId, relax that lookup, but not required.
- **`GET /api/admin/brokers/[id]` becomes dead** once the brokers page is deleted (it was its only consumer). Remove the GET handler; **keep the PUT** (verification). Net: the file stays, serving only PUT.

## 5. Navigation repoint

- Delete the **"전체 프로필"** link from `users/[id]` (everything's on one page now) + its locale key usage.
- **reports.tsx** (`:215` keyboard 'e', `:361` target link): when `targetType === 'BROKER'`, route to `/admin/users/${broker.user.publicId}` instead of `/admin/brokers/${broker.id}`. (Need the broker's user publicId in the reports payload — verify it's there; if not, add it.)
- **inbox.tsx** (`:644`): BRK rows' `openDetail()` → `/admin/users/${...publicId}` instead of the broker page. (Same — ensure the inbox row carries the broker's user publicId.)
- Optional: support a `#broker` hash or `?focus=verification` so inbox/reports land scrolled to the broker panel for fast verification.

## 6. Tests

- Migrate `tests/admin/brokers-detail.test.tsx` assertions (photo render, verify/reject buttons, account actions) into `tests/admin/users-detail.test.tsx` for the unified page, then delete the brokers-detail test.
- Add a test: a BROKER-role user shows the broker panel with verification actions; a BORROWER shows requests, no verification panel; the two-admin 202 path shows the "second review" state.
- Update the design-regression list (remove `pages/admin/brokers/[id].tsx`).

## 7. Rollout (phased, each shippable)

1. **Unified page** — build the broker panel (photo + profile + subscription + verification actions incl. 202 handling) into `users/[id]`; extend the users GET broker select. Keep brokers page temporarily.
2. **Repoint nav** — reports + inbox → unified page; drop the 전체 프로필 link.
3. **Delete** `pages/admin/brokers/[id].tsx` + the `GET` half of its API + its test; migrate tests.
4. Verify: tsc + lint + tests + build; manually click reports/inbox/people → broker → verify/reject.

**Effort:** Medium. The fiddly bits are porting the two-admin `202` verification UX and making sure reports/inbox payloads carry the broker's user `publicId`.

## 8. Gaps this consolidation fixes for free
- Brokers get **send-notice** (only on user page today).
- Verification no longer requires a page bounce (inline on the one page).
- Consistent id convention (everything keys off user `publicId`), removing the `broker.id` vs `publicId` mix.

## Status log
- 2026-06-14: Plan written (from a 4-agent code map). Awaiting go-ahead to implement Phase 1.
- 2026-06-14: **IMPLEMENTED (all phases).** Verified: tsc 0 errors, lint 0 errors, 521 tests pass, prod build OK.
  - Phase 1a — `GET /api/admin/users/[id]` broker select gained `profilePhoto`, `areasServed`, `specialties`, `updatedAt`. (Did NOT add `_count.conversations` — the existing OOM guard stands; the broker page only showed `subscriptionTier`, not the full subscription object, so that was not needed either.)
  - Phase 1b — `/admin/users/[id]` broker panel now carries the avatar (rounded-sm), areas/specialties, and the verification actions (verify/reject/reset) with the confirm dialogs. `runAction` branches: verification → `PUT /api/admin/brokers/[brokerId]`, account status → `PUT /api/admin/users/[id]`. **Improved on the old page: a `202` two-admin-gate response now toasts an "info" (second-review needed) instead of silently reading as success** (the old brokers page only checked `!r.ok`).
  - Phase 2 — `reports.tsx` (both call sites) + `inbox.tsx` BRK row repointed to `/admin/users/[publicId]`; the "전체 프로필" cross-link removed. (reports `targetId` was already the user publicId; inbox now uses `row.publicId` not `row.id`.)
  - Phase 3 — `pages/admin/brokers/[id].tsx` is now an adminSSR redirect that resolves broker-id-or-publicId → `/admin/users/[publicId]` (preserves bookmarks + the manual link). Dead `GET /api/admin/brokers/[id]` removed; **`PUT` kept** (used by the unified page AND inbox inline approve/reject). Tests migrated: `brokers-detail.test.tsx` deleted, 6 broker-verification tests added to `users-detail.test.tsx` (17 total); `reports-link.test.tsx` + `tests/setup.ts` updated.
  - Not committed yet — awaiting review.
