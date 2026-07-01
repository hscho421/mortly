# Mortly — Mobile App UI/UX & Product Plan

_Version 1.0 · 2026-07-01 · Applies to iOS + Android_

> A production-minded plan for the native Mortly mobile app, grounded in a full audit of the live web app (routes, design tokens, flows, and business logic). The goal is **not** to shrink the website onto a phone — it is a polished, native-feeling app that preserves the full Mortly product value for **borrowers, brokers, and admins**.

---

## 0. Executive Summary

Mortly is a bilingual (Korean-default / English) two-sided mortgage marketplace. Borrowers post consultation requests; admins approve them; verified brokers browse and respond; the two parties chat in real time. Brokers pay for tiered credits/entitlements; admins moderate the marketplace.

**The mobile app is one app with three role-based experiences** (borrower, broker, admin), selected by the authenticated session role — mirroring the web. It reuses the existing Next.js API, Supabase Realtime + RLS, Expo push infrastructure, and the "Midnight & Gold" design tokens.

### Locked anchor decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Stack: React Native + Expo** (expo-router, NativeWind) | The web already ships `pages/api/auth/mobile-oauth.ts`, Expo push (`DeviceToken`, `expo-server-sdk`, `lib/push.ts`), and Apple + Google sign-in — the backend was built for a mobile client. All TypeScript. Maximizes reuse of API, types, i18n, and design tokens. |
| 2 | **One app, three roles** — borrower + broker + **admin** | Mirrors the web's role-gated shells. Admin gets its own tab stack for on-the-go moderation (approve/reject brokers & requests, resolve reports, manage users/credits, geography, system) plus push alerts for urgent items. |
| 3 | **Billing is WEB-ONLY — no in-app purchase** | Avoids Apple/Google's 15–30% commission. Only brokers pay. In-app, subscription is **read-only** (tier, credits + usage, renewal, PAST_DUE); all checkout/upgrade/downgrade happens on mortly.ca via Stripe, reached through an **external-browser** "Manage on web" hand-off (never an in-app payment webview). Entitlements bought on web are honored in-app. |
| 4 | **Reuse the existing backend** — `pages/api/*` over HTTPS | No second backend. Same auth stack (incl. the mobile-oauth endpoint + a mobile session-token path), same Stripe webhooks, same crons. |
| 5 | **Reuse Supabase Realtime + RLS** for chat | `supabase-js` runs in RN; the row-level-security that keeps conversations confidential carries over unchanged. |
| 6 | **Brand parity** — reuse "Midnight & Gold" tokens via NativeWind | Forest/navy `#0f1729`, sage `#9ea6bd`, cream surfaces, amber/gold `#c49a3a`; sharp corners; Outfit + Noto Sans KR. Korean-default bilingual (react-i18next, already a dependency). No in-app language switcher (web convention). |

### Resolved decisions (2026-07-01)
These five product questions from §7 are now decided and supersede the "open" framing there:

| Q | Decision |
|---|----------|
| **Billing CTA** | **Status-only, neutral copy.** No prices, no "cheaper on web" steering. The Subscription screen shows tier/credits/renewal/PAST_DUE and a single neutral "Manage subscription on mortly.ca" that opens the external browser. Most conservative posture vs. App/Play Store anti-steering. |
| **Mobile auth** | **Yes** — add a credentials (email/password) mobile login endpoint + issue a mobile session token (JWT) stored in Keychain/Keystore; reuse `tokenVersion` for "log out everywhere". Biometric app-unlock (Face ID / fingerprint) as an optional convenience. |
| **Admin v1 scope** | **Moderation-first.** Inbox (pending verifications + open reports) → approve/reject/resolve with reason + read-only context (user/broker/request/conversation) + push alerts. Deferred to web: user mutations (suspend/ban/credit-adjust), create-admin, system settings, geography maps. |
| **Repo shape** | **Monorepo** (npm/pnpm workspaces): `apps/web`, `apps/mobile`, `packages/core` (types, zod, i18n JSON, tier/credit constants, business rules, API contract). Low-risk path: extract `packages/core` first, add `apps/mobile`, do the `apps/web` move as a dedicated refactor. |
| **Borrower on mobile** | **Full peer** — create requests + chat + browse brokers at launch (not chat-first). |

### What already exists that de-risks this build
- **`components/MobileTabBar.tsx`** — a native-style bottom tab bar with a "More" bottom sheet, badges, and safe-area padding, already powering all three web app areas below `md`. Its `TabBarItem` model is the canonical mobile tab contract.
- **Three data/badge context providers** (Admin/Broker/Borrower) that already centralize polling + counters — reuse their shapes as mobile view-models.
- **Mobile-responsive patterns already designed**: request-context bottom sheet (85dvh slide-up), chat-detail hiding the tab bar, thumb-reachable tabs, `env(safe-area-inset-bottom)` padding.

### How to read this document
Sections 1–2 define **what screens exist and how you move between them**. Section 3 is the **design system**. Section 4 walks the **core flows**. Section 5 covers **mobile-specific UX decisions**. Section 6 is the **engineering plan**. The doc closes with **risks/open questions** and a **prioritized build order**. A consolidated **screen inventory** follows immediately below.

---

## Screen Inventory

_81 distinct screens across all roles (deduped from 89 mapped). Full per-screen UX is in §2._


### Public / Marketing

| Screen | Web origin | Purpose |
|---|---|---|
| **Home / Landing** | `/` | Marketing homepage; hero, value props (privacy-first, verified brokers, no commitment), live activity marquee… |
| **For Borrowers** | `/for-borrowers` | Borrower-focused marketing: why/how, benefits, steps. |
| **For Brokers** | `/for-brokers` | Broker-focused marketing: advantages, benefits. |
| **How It Works** | `/how-it-works` | Explainer of borrower flow + FAQ. |
| **Contact** | `/contact` | Contact info / email + response-time messaging. |
| **Privacy Policy** | `/privacy` | Privacy policy, data transparency, providers, user controls. |
| **Terms of Service** | `/terms` | Terms of service sections. |
| **404 Not Found** | `/404` | Custom not-found error page. |
| **500 Server Error** | `/500` | Custom server-error page. |
| **Login** | `/login` | Email/password sign-in plus Google OAuth entry; routes verified/unverified/suspended users appropriately and … |
| **Signup** | `/signup` | Create a new email/password account as BORROWER or BROKER (role lockable via ?role=), with mandatory terms ac… |
| **Verify Email** | `/verify-email` | Enter the 6-digit emailed code to verify a newly created account; resend with cooldown. |
| **Forgot Password** | `/forgot-password` | Request a password-reset email; always shows a generic confirmation to avoid account enumeration. |
| **Reset Password** | `/reset-password` | Set a new password using the ?token from the reset email; invalidates existing sessions. |
| **Broker public profile (as borrowers see…** | `/borrower/request/[id] (BrokerResponses…` | How a broker's identity + verification badge is presented to borrowers on the request hub — comparable broker… |
| **Maintenance Gate** | `pages/_app.tsx MaintenanceGate + /api/m…` | Full-screen 'Under Maintenance' interstitial when the platform is toggled into maintenance. |
| **Language Switch (marketing-only)** | `components/Navbar.tsx + components/Foot…` | KO · EN locale toggle for the public marketing site. |
| **Privacy / Trust** | `/privacy` | Marketing legal/trust page: how data is protected, what is collected, service providers, identity-sharing tim… |


### Auth & Onboarding

| Screen | Web origin | Purpose |
|---|---|---|
| **Login** | `/login` | Credentials + Google sign-in; honors ?callbackUrl and redirects by role after auth. |
| **Sign Up** | `/signup` | Create account as BORROWER or BROKER; role can be locked via ?role=. |
| **Verify Email** | `/verify-email` | 6-digit email verification code entry + resend. |
| **Forgot Password** | `/forgot-password` | Request password-reset email. |
| **Reset Password** | `/reset-password` | Set new password from emailed token. |
| **Select Role** | `/select-role` | Post-OAuth role selection for users without a role; can pre-select via ?role=. |
| **Admin Inbox** | `/admin/inbox` | Admin default landing: unified action queue (pending verifications/requests/reports). |
| **Admin People** | `/admin/people` | User management: list/filter borrowers, brokers, admins; bulk + create. |
| **Admin Activity** | `/admin/activity` | Activity feed across requests/conversations with type filters. |
| **Admin Reports** | `/admin/reports` | Abuse/report moderation queue with status filters. |
| **Admin Geography** | `/admin/geography` | Geographic analytics: Canada/World maps of visitor/request geo over N days. |
| **Admin System / Settings** | `/admin/system` | System settings incl. maintenance mode, tier-credit config, notices. |
| **Admin User Detail** | `/admin/users/[id]` | Unified role-aware user detail (borrower/broker/admin) with moderation + broker verification panel. |
| **Admin Broker Detail (redirect)** | `/admin/brokers/[id]` | Legacy redirect: resolves broker id or 9-digit publicId to /admin/users/[publicId]. |
| **Admin Conversation Detail** | `/admin/conversations/[id]` | Admin read-only view of a conversation thread + its request context for moderation. |
| **Notification Bell / In-app Notices** | `(Navbar) GET/PUT /api/notices` | In-app notification center in the navbar: lifecycle AdminNotice items (verification result, request approved/… |
| **Report Modal** | `(ReportButton) POST /api/reports` | Report a broker, request, or conversation for policy violations (Apple 1.2 UGC requirement). |
| **Blocked Users Management (backend only)** | `GET /api/users/blocked ; POST/DELETE /a…` | Manage the user block list — required for Apple 1.2 but currently has NO web UI; endpoints exist and block lo… |
| **Admin Conversation Detail (close)** | `/api/admin/conversations/[id] (GET/PUT)` | Admin-only: view full chat history (incl. borrower financials) and force-close a conversation with a bilingua… |
| **Delete Account (shared component)** | `components/DeleteAccountSection.tsx (re…` | Irreversible, multi-step in-app account deletion satisfying App Store guideline 5.1.1(v). |
| **Select Role (post-signup transition)** | `/select-role` | One-time role picker for new OAuth users whose account was created with needsRoleSelection=true. |


### Borrower

| Screen | Web origin | Purpose |
|---|---|---|
| **Borrower Index (redirect)** | `/borrower` | Redirect-only shim to /borrower/dashboard. |
| **Borrower Dashboard** | `/borrower/dashboard` | Borrower home: overview of their requests + entry to create a new request. |
| **Borrower Messages** | `/borrower/messages` | Borrower chat: conversation list + thread + request-context panel. |
| **Borrower Profile / Settings** | `/borrower/profile` | Borrower account/profile settings incl. account deletion. |
| **New Request** | `/borrower/request/new` | Create a mortgage consultation request (residential/commercial, products, property, income, timeline, notes). |
| **Request Detail / Hub** | `/borrower/request/[id]` | Manage one request + view/compare brokers who responded (#responses anchor). |
| **Borrower Brokers (redirect)** | `/borrower/brokers/[requestId]` | Legacy redirect to /borrower/request/[requestId]#responses (keeps stale links). |
| **Borrower Index Redirect** | `/borrower (pages/borrower/index.tsx)` | Server-side redirect entry point; sends /borrower to /borrower/dashboard (302, permanent:false). |
| **Dashboard** | `/borrower/dashboard (pages/borrower/das…` | Borrower home: greeting, 2 stat cards, active-request hero cards, recent broker activity, other (pending/clos… |
| **New Request (3-step wizard)** | `/borrower/request/new (pages/borrower/r…` | Create a mortgage consultation request in 3 steps: Basics, Details, Review & Submit. |
| **Request Detail + Lifecycle Hub** | `/borrower/request/[id] (pages/borrower/…` | View one request, its status + lifecycle stepper, the brokers who responded, and manage it (edit/close/delete… |
| **Brokers Redirect** | `/borrower/brokers/[requestId] (pages/bo…` | Legacy standalone broker-comparison route, now a server redirect to /borrower/request/{id}#responses (or dash… |
| **Messages / Chat** | `/borrower/messages (pages/borrower/mess…` | Real-time chat with brokers who opened a conversation; conversation list grouped by request, thread view, and… |
| **Profile / Account Settings** | `/borrower/profile (pages/borrower/profi…` | Manage account: edit name, view stats, change password, view immutable email + member-since + support User ID… |
| **Borrower Account Settings** | `/borrower/profile` | Borrower's single account/settings screen: view identity, edit display name, change password, and delete acco… |


### Broker

| Screen | Web origin | Purpose |
|---|---|---|
| **Pricing** | `/pricing` | Broker subscription plans (FREE/BASIC/PRO/PREMIUM), compare table, FAQ; also the in-app plan page for brokers. |
| **Broker Index (redirect)** | `/broker` | Redirect-only shim to /broker/dashboard. |
| **Broker Dashboard** | `/broker/dashboard` | Broker home: pending/action-required items, stats, past-due banner. |
| **Browse Requests (Marketplace)** | `/broker/requests` | Broker marketplace: browse open borrower requests with filters; PREMIUM early-access exclusives. |
| **Request Detail (Broker)** | `/broker/requests/[id]` | Full borrower request detail for a broker to review + respond. |
| **Broker Messages** | `/broker/messages` | Broker chat: conversation list + thread + request-context third column. |
| **Broker Profile / Settings** | `/broker/profile` | Broker profile: brokerage, photo, categories, public-facing info + account deletion. |
| **Broker Billing / Credits** | `/broker/billing` | Subscription + credits management: current plan, invoices, plan change, Stripe portal. |
| **Broker Onboarding** | `/broker/onboarding` | First-run broker profile setup before marketplace access. |
| **Browse Requests** | `/broker/requests` | Marketplace feed of approved OPEN borrower requests the broker may respond to; paginated, filterable, marks r… |
| **Request Detail / Respond** | `/broker/requests/[id]` | Full borrower request (income/property/timeline/notes) with the CTA to start a direct conversation (the credi… |
| **Broker Profile (own edit page + avatar)** | `/broker/profile` | Edit the broker's own profile fields, manage the avatar (brokerAvatarPath upload/remove), show verification s… |
| **Broker Billing** | `/broker/billing` | Broker self-serve subscription management: view current plan + response-credit balance, compare/upgrade/downg… |
| **Plan-change confirmation modal** | `/broker/billing (modal)` | Disclose the exact price impact of a plan change before applying it — prorated charge for upgrades, effective… |
| **Stripe Checkout (hosted, external)** | `stripe.checkout.sessions redirect → ret…` | Collect payment for a first-time subscription purchase (Stripe hosts the price display and card entry). |
| **Stripe Billing Portal (hosted, external)** | `stripe.billingPortal.sessions redirect …` | Update payment method, cancel subscription, and manage billing (used for PAST_DUE recovery and downgrade-to-F… |
| **Broker Account Settings / Edit Profile** | `/broker/profile` | Broker's single settings screen: public-facing broker profile fields, avatar, verification status, and accoun… |


### Admin

| Screen | Web origin | Purpose |
|---|---|---|
| **Admin Shell / Nav** | `components/admin/AdminShell.tsx (wraps …` | Chrome, auth gate, nav, shared badge counts, Cmd+K palette mount, stale-data error banner. |
| **Inbox (moderation queue)** | `/admin/inbox` | Single decision queue: approve/reject pending requests, broker verifications, and open reports. |
| **People (users)** | `/admin/people` | Search/filter all accounts and run single or bulk moderation. |
| **User detail** | `/admin/users/[id]` | Full account view + all moderation and broker-verification actions in one place. |
| **Activity feed** | `/admin/activity` | Interleaved requests + conversations feed with read-only chat inspection and admin close/reject. |
| **Reports (investigation)** | `/admin/reports` | Two-pane report triage: list + investigation drawer with notes and resolution. |
| **Geography analytics** | `/admin/geography` | Cookieless visitor-geography analytics (World + Canada maps and ranking lists). |
| **System settings** | `/admin/system` | Platform config toggles, audit log, and 30-day trends. |
| **Command palette (Cmd+K)** | `components/admin/CommandPalette.tsx (ov…` | Keyboard-first global search + per-user quick actions + nav jumps. |


### Shared (both roles)

| Screen | Web origin | Purpose |
|---|---|---|
| **Chat Disclaimer** | `(ChatDisclaimer modal)` | One-time per-conversation marketplace disclaimer shown before a borrower/broker engages a thread (Mortly is a… |


---

## 1. App Structure & Navigation

### 1.1 Navigator topology (expo-router, file-based)

The app is a **single Expo binary** whose top level is a **role switch after auth**, not a static tab tree. `expo-router`'s root layout mounts exactly one of five stacks based on `useSession()`: the **auth** stack (anonymous), the **onboarding** stack (authed but incomplete — `needsRoleSelection` / `needsNameEntry` / broker-with-no-profile), or one of three **role tab navigators** (borrower / broker / admin) keyed off `session.user.role` — the mobile mirror of the web's `dashboardHref` derivation (`BROKER → /broker`, `ADMIN → /admin/inbox`, else `/borrower`). Chat detail screens hide the tab bar (the web's `hideMobileTabBar`); billing is a single read-only status screen with an **external** hand-off.

```
app/                                         ← expo-router root
├── _layout.tsx                              RootStack: <SessionGate> picks the active group
│                                            (session loading → SplashGate; maintenance → MaintenanceScreen)
│
├── (auth)/                                  GROUP: anonymous — no tab bar, no back-to-app
│   ├── _layout.tsx                          Stack (headerless card screens)
│   ├── login.tsx                            email/password + Apple/Google (native SDK → /api/auth/mobile-oauth)
│   ├── signup.tsx                           role toggle (BORROWER default) + terms; sends legalVersion + locale
│   ├── verify-email.tsx                     6-digit OTP (native autofill), resend w/ 60s cooldown
│   ├── forgot-password.tsx                  request reset email
│   └── reset-password.tsx                   ?token= from universal link → same web endpoint
│
├── (onboarding)/                            GROUP: authed but not yet in an app; RootStack routes here
│   ├── _layout.tsx                          Stack (modal-feel, no tab bar, no manual skip)
│   ├── select-role.tsx                      needsRoleSelection===true → POST /api/auth/select-role (x-mortly-mobile:1)
│   ├── name-entry.tsx                       needsNameEntry===true (Apple no-name) → PATCH /api/users/me  [mobile-only screen]
│   └── broker-onboarding.tsx                BROKER w/ no Broker row → stepped profile wizard → POST /api/brokers/profile
│
├── (borrower)/                              GROUP: role===BORROWER
│   ├── _layout.tsx                          Tabs (3 tabs) — see §1.3
│   ├── (dashboard)/                         TAB 1 · stack
│   │   ├── index.tsx                        Dashboard: requests overview, action banners, activity
│   │   ├── request/[id].tsx                 Request hub: status, stepper, "Brokers who responded"
│   │   └── request/[id]/responses.tsx       Responses list (deep-link target of web #responses)
│   ├── (messages)/                          TAB 2 · stack
│   │   ├── index.tsx                        Conversation list (grouped by request)
│   │   └── [conversationId].tsx             Chat thread — HIDES tab bar; composer owns bottom edge
│   └── (settings)/                          TAB 3 · stack
│       ├── index.tsx                        Account Settings hub (grouped rows)
│       ├── profile.tsx                      Edit name (email read-only)
│       ├── security.tsx                     Change password (hidden/"not available" for OAuth-only)
│       ├── notifications.tsx                Push/email toggles (NEW — backs /api/preferences)  [mobile-first]
│       ├── blocked.tsx                      Blocked users list (NEW — Apple 1.2)               [mobile-first]
│       └── legal.tsx                        Privacy / Terms links + app version
│
├── (broker)/                               GROUP: role===BROKER
│   ├── _layout.tsx                          Tabs (4 tabs + More) — see §1.3
│   ├── (dashboard)/                         TAB 1 · stack
│   │   └── index.tsx                        Broker home: priority banner, stats, PREMIUM perk/teaser
│   ├── (requests)/                          TAB 2 · stack (marketplace)
│   │   ├── index.tsx                        Browse OPEN requests (filters, infinite scroll, mark-seen)
│   │   └── [id].tsx                         Request detail → Respond (credit-spend confirm)
│   ├── (messages)/                          TAB 3 · stack
│   │   ├── index.tsx                        Conversation list
│   │   └── [conversationId].tsx             Chat thread — HIDES tab bar
│   └── (more)/                              TAB 4 · "More" stack (bottom-sheet-style hub)
│       ├── index.tsx                        More menu
│       ├── profile.tsx                      Broker profile + avatar + verification badge
│       ├── subscription.tsx                 READ-ONLY tier/credits/renewal + "Manage on web"  ← NO in-app checkout
│       ├── notifications.tsx                Push/email toggles
│       ├── blocked.tsx                      Blocked users (Apple 1.2)
│       └── legal.tsx                        Privacy / Terms / version
│
├── (admin)/                                GROUP: role===ADMIN
│   ├── _layout.tsx                          Tabs (4 tabs + More) — see §1.3
│   ├── (inbox)/                             TAB 1 · stack
│   │   ├── index.tsx                        Unified moderation queue (GET /api/admin/queue)
│   │   ├── request/[id].tsx                 Request review drawer→screen (approve/reject)
│   │   ├── broker/[id].tsx                  Broker verify/reject (routes to user detail)
│   │   └── report/[id].tsx                  Report triage (resolve/dismiss/notes)
│   ├── (people)/                            TAB 2 · stack
│   │   ├── index.tsx                        Users (search + role/status filter chips, stacked cards)
│   │   └── users/[id].tsx                   User detail: moderation + broker verification
│   ├── (activity)/                          TAB 3 · stack
│   │   ├── index.tsx                        Requests+conversations feed
│   │   └── conversations/[id].tsx           Read-only transcript + admin-close
│   ├── (reports)/                           TAB 4 · stack
│   │   ├── index.tsx                        Reports queue (status/target chips)
│   │   └── [id].tsx                         Report investigation
│   └── (more)/                              TAB 5 · "More" stack
│       ├── index.tsx                        More menu (system + geography demoted here)
│       ├── geography.tsx                    Analytics — List/KPI-first, map opt-in
│       ├── system.tsx                       Settings toggles (maintenance, premium) + audit
│       └── account.tsx                      Admin sign-out (no self-delete)
│
└── (modals)/                               ROOT-LEVEL modal group (presentation: 'modal'), role-agnostic
    ├── command-search.tsx                  Admin Cmd+K analog (full-screen search + action sheet)
    ├── report.tsx                          Report a broker/request/conversation (POST /api/reports)
    ├── chat-disclaimer.tsx                 One-time marketplace disclaimer (AsyncStorage-gated)
    ├── confirm-destructive.tsx             Reusable confirm (close request, delete account step, admin actions)
    └── image-viewer.tsx                    Avatar / profile-photo lightbox
```

**Why root-level groups instead of one Tabs with hidden tabs:** a borrower session should never be able to render a broker screen (and vice-versa), so each role owns a mutually-exclusive `Stack`/`Tabs` group. The `RootStack` unmounts the previous group on role change (e.g. after `select-role`), which also flushes the wrong role's data context and 60s/30s pollers.

### 1.2 Session-gated group selection

`RootStack` (`app/_layout.tsx`) resolves the active group in this precedence order. This is the single source of truth for "which app am I in" and must run before any tab renders (avoids the web's 100–500ms authed-nav flash).

| Condition (checked in order) | Active group | Notes |
|---|---|---|
| `/api/auth/session` still loading | `SplashGate` | Branded splash; no chrome |
| `/api/maintenance` true **and** role ≠ ADMIN | `MaintenanceScreen` | Poll on launch + foreground; admins bypass |
| No session / 401 / `tokenVersion` mismatch | `(auth)` | Also the landing after `signOut` and after remote session revocation |
| `session.user.needsNameEntry === true` | `(onboarding)/name-entry` | Apple sign-in w/o name; blocks app until set |
| `session.user.needsRoleSelection === true` | `(onboarding)/select-role` | OAuth-created users default role BORROWER |
| role === BROKER **and** no Broker profile (`/api/brokers/profile` 404) | `(onboarding)/broker-onboarding` | Marketplace stays gated until PENDING profile exists |
| role === BORROWER | `(borrower)` | |
| role === BROKER | `(broker)` | |
| role === ADMIN | `(admin)` | |

**Cross-cutting revocation:** because `tokenVersion`/`status` are re-checked server-side (~5s), any authed screen that receives a `401`/null-session (admin ban, password change elsewhere, self-delete) must bubble to `RootStack`, which drops to `(auth)` gracefully — never a white screen.

### 1.3 Tab bars per role

Reuses the web's typed `NAV_ITEMS` contract (`key/labelKey/glyph/badgeKey`) verbatim as the RN tab config. Sharp-corner design: mono uppercase labels (~10px, `tracking-[0.06em]`), 17px glyph, active = amber-500 top indicator + amber-600 text, badge amber-500 capped `9+`. Icons should be a bundled icon set matched to the web glyphs (no emoji). Every tab bar honors `pb-[safe-area-inset-bottom]` and 56px min tab height.

**Borrower (3 tabs, no More):**

| Order | Route key | Label (ko default / en) | Icon | Badge source |
|---|---|---|---|---|
| 1 | dashboard | 대시보드 / Dashboard | home | `activeRequests` (OPEN\|IN_PROGRESS) |
| 2 | messages | 메시지 / Messages | chat | `unreadMessages` |
| 3 | settings | 설정 / Settings | gear | — |

Sign-out lives inside the Settings stack (web put it in a "More" sheet; borrower has no More).

**Broker (4 primary tabs + More):**

| Order | Route key | Label | Icon | Badge |
|---|---|---|---|---|
| 1 | dashboard | 대시보드 / Dashboard | home | — |
| 2 | requests | 상담 요청 / Requests | inbox-search | `newRequests` |
| 3 | messages | 메시지 / Messages | chat | `unreadMessages` |
| 4 | more | 더보기 / More | ellipsis | — (aggregates below) |

"More" holds **Profile · Subscription (read-only) · Notifications · Blocked users · Legal · Sign out**. Subscription tier label (FREE/BASIC/PRO/PREMIUM) and a PAST_DUE amber dot surface on the **More** tab glyph and Dashboard banner (mirrors the web sidebar tier chip + `payment due` tooltip).

**Admin (4 primary tabs + More)** — matches the web's `AdminShell.NAV_ITEMS` primary/demoted split exactly:

| Order | Route key | Label | Icon | Badge (urgent = error-600) |
|---|---|---|---|---|
| 1 | inbox | 수신함 / Inbox | inbox | `inbox` (urgent) |
| 2 | people | 사용자 / People | people | `pendingVerifications` |
| 3 | activity | 활동 / Activity | activity | — |
| 4 | reports | 신고 / Reports | flag | `openReports` (urgent) |
| 5 | more | 더보기 / More | ellipsis | — |

Admin **More** holds the demoted **Geography** and **System** destinations plus **Account/Sign-out**. Admin badges come from the shared 60s `AdminDataContext` poller; borrower/broker badges from their 30s data contexts (all pause on background, refetch on foreground, and are supplemented by push — see §1.7).

### 1.4 Headers & in-screen navigation

The web's sticky `AppTopbar` (mono eyebrow + serif title + right-actions slot) becomes a **native stack header**:

- **List/root tab screens:** large serif title (`font-display`), mono eyebrow as a subtitle where the web used one (e.g. Requests `상담 요청`), right-slot action (e.g. Dashboard `+ 새 요청`, Requests filter icon).
- **Detail screens:** back chevron (native gesture + button), title = entity (`#publicId` for requests, brokerage/borrower name for chats), right-slot overflow (`…`) opening a native **action sheet** (edit/close/delete request; report; block).
- **Chat thread:** custom header with avatar + VERIFIED check (amber-400) + `요청 컨텍스트` button that opens the **RequestContextPanel as a bottom sheet** (~85% height — the web `animate-slide-up` drawer). Tab bar is hidden; composer is pinned with safe-area inset and Korean-IME Enter guard.
- **Onboarding/auth:** headerless card screens; onboarding cannot be swiped away (no manual skip past `needsRoleSelection`).

**Movement patterns**
- List → detail = stack push; detail → chat = push into the messages stack (cross-tab pushes route through the target tab so its back stack is correct, e.g. Respond → `(messages)/[conversationId]`).
- Modals (report, disclaimer, confirm, command-search, image viewer) present from the **root** modal group so they float above any role/tab.
- Sign-out = confirm modal → clear secure-store token → `RootStack` drops to `(auth)`.

### 1.5 Deep-link scheme (`mortly://`) + universal links

Scheme `mortly://` plus Apple Universal Links / Android App Links on `https://mortly.ca`. Auth-required links resolve **after** the session gate — an unauthenticated tap lands on `(auth)/login` and replays the intent post-login. Role mismatch (e.g. a borrower opening an admin link) resolves to that role's home, never a dead screen (mirrors the web's redirect-shim philosophy).

| Link | Web parity | Resolves to |
|---|---|---|
| `mortly://reset-password?token=…` | `/reset-password` | `(auth)/reset-password` (works while logged out) |
| `mortly://verify-email?email=…` | `/verify-email` | `(auth)/verify-email` |
| `mortly://request/{publicId}` | `/borrower/request/[id]` | Borrower: request hub; deep-link `?tab=responses` → responses |
| `mortly://request/{publicId}?from=push` | approval/expiry push | Request hub with status refresh |
| `mortly://broker/request/{publicId}` | `/broker/requests/[id]` | Broker: marketplace detail (fires mark-seen) |
| `mortly://conversation/{id}` | messages `?id=` | Correct role's `(messages)/[conversationId]`; sets chat view + hides tab bar (handles the web's "deep-link straight into thread" edge case) |
| `mortly://broker/subscription` | `/broker/billing` | Read-only Subscription screen (never an in-app checkout) |
| `mortly://admin/inbox` · `…/reports/{id}` · `…/users/{id}` | admin routes | Admin tabs / detail (push payload `type` drives target) |
| `mortly://settings/notifications` | — (new) | Notifications preferences |

**Push payload → route:** the existing `pushData.type` (`conversation` → conversation link, `request` → request link) plus admin event types map straight onto the table above. Legacy web redirect-only routes (`/borrower`, `/broker`, `/borrower/brokers/[requestId]`, `/admin/brokers/[id]`) are **not screens** — they're absorbed as deep-link aliases that rewrite to the canonical destination.

### 1.6 Billing = web-only (explicit routes that do NOT exist)

There is **no** `checkout`, `upgrade`, `downgrade`, `payment-method`, `resume`, or `plan-picker` route anywhere in the tree. The only billing surface is **`(broker)/(more)/subscription.tsx`**, a read-only status screen:

- Shows current tier (FREE/BASIC/PRO/PREMIUM), monthly credits + usage, renewal date, and a **PAST_DUE** banner (data from `/api/brokers/profile` + `/api/tier-credits`; PREMIUM shows "Unlimited" only when status ACTIVE).
- Single primary action: **"Manage on mortly.ca"** → opens the **external system browser** (`expo-web-browser` `openBrowserAsync`, i.e. SFSafariViewController/Custom Tab is acceptable, but **not** an in-app WebView presenting Stripe pricing/checkout). No in-app price list, no "Choose plan" CTAs, no Stripe PaymentSheet.
- **Compliance note (verify at submission):** App Store anti-steering rules on external purchase links shifted 2024–2025. Default to the conservative read-only + external-manage posture; keep pricing numbers off the native screen so the hand-off, not the app, presents commerce. Flag for review before build submission.

### 1.7 Cross-cutting screen states

Every list/detail/form screen implements four states as first-class native components (not inline banners), so the router can compose them consistently:

| State | Pattern | Mortly specifics |
|---|---|---|
| **Loading** | Native skeletons mirroring the web `Skeleton*` family per screen | `SkeletonDashboard/RequestList/Chat/Billing/Profile`; session-resolve = branded SplashGate, not a spinner |
| **Empty** | Centered `UEmpty` analog with icon + CTA | Borrower "Create your first request"; Broker "all caught up"; Admin inbox "전부 정리됐어요"; empty billing history; no broker responses |
| **Error** | Actionable retry card (never a dead skeleton) | Distinguish **load-failure retry** from empty (web's deliberate anti-duplicate-submit guard on borrower dashboard); admin stale-badge banner "일부 데이터가 오래됐을 수 있습니다"; chat send-failure restores draft text |
| **Permission / gate** | Dedicated native gate screens, not toasts | Broker **verification pending** (VerificationPendingCard), **REJECTED**, **FREE → upgrade** (hand-off to web), **0 credits** (BASIC/PRO), **PAST_DUE**, **PREMIUM_EXCLUSIVE**; request `REQUEST_NOT_OPEN`; `EDIT_LOCKED_BY_CONVERSATIONS`; admin two-admin `202 PENDING_SECOND_REVIEW` |
| **Offline / not-configured** | Toast + cached view | Supabase Realtime absent → fall back to authenticated refetch (never assume Realtime); offline banner + read-only cache |
| **404 / mismatch** | Native not-found | Bad request/conversation id → back to that tab's list (web `router.replace` parity); role-mismatched deep link → role home |

These states are reused across all three role trees so behavior is identical whether a borrower, broker, or admin hits a loading/error/gate; the per-screen data contracts and copy are detailed in Section 2.

---

## 2A. Screens — Auth, Onboarding, Settings

This section specifies the pre-authenticated and account-management surfaces of the Mortly mobile app: launch → welcome → auth → onboarding → role-scoped first-run, plus the Settings/Account stack (including the **read-only** Subscription screen). These screens are the app's compliance-critical spine — they carry the Apple/Google IAP constraint (no in-app checkout), Guideline 5.1.1(v) account deletion, Guideline 1.2 blocking entry points, and the anti-steering external hand-off. Everything here reuses the existing Next.js API contract over HTTPS; the mobile difference is native token storage (30-day JWT from `/api/auth/mobile-oauth` and `/api/auth/select-role`) instead of the `__Secure-next-auth` cookie.

**Cross-cutting conventions for this stack**
- **Locale:** Korean is default; English secondary. Copy comes from the existing `common.json` (`auth.*`, `broker.*`, `settings.*`, `pricing.*`, `nav.*`, `privacy.*`, `terms.*`). Per the marketing-only-switcher rule, there is **no** in-app KO/EN toggle in the app-authenticated area — locale follows the device (see Settings note).
- **Design tokens:** sharp corners (`rounded-sm`), Midnight & Gold palette (forest `#0f1729` ink, cream `#f8f7f4`/`#faf8f3` surfaces, amber `#c49a3a` accent, sage `#576285` muted), Outfit display/body, Pretendard for Korean, IBM Plex Mono for labels/IDs/timestamps. Fonts bundled locally (no CDN `<link>`). Status-bar/splash color reconciled to forest `#0f1729` (fix the legacy `#1B3A2D` theme-color drift).
- **CSRF/mobile signalling:** every mutating call sends `x-mortly-mobile: 1` to bypass the same-origin gate and to receive the mobile-shaped JWT where applicable.
- **Session revocation:** the server bumps `tokenVersion` on password change / suspend / ban / delete; the app must treat any `401`/null-session response as "signed out" and route to Welcome within the ~5s revocation window.
- **Sentinel error codes** are mapped to `t()` copy exactly as web does — never surface raw codes.

---

### Navigation map (auth + settings)

| Stack | Screens | Entry condition |
|---|---|---|
| **Launch** | Splash → (session probe) | Cold start / resume from background |
| **Public auth** | Welcome, Login, Signup, Verify Email, Forgot Password, Reset Password | No valid token, or token revoked |
| **Onboarding transition** | Name Entry (Apple no-name), Select Role, Broker Onboarding (wizard), Borrower first-run pass-through | `needsNameEntry` / `needsRoleSelection` / broker without profile |
| **Settings (in "More"/tab)** | Account Settings (borrower or broker variant), Subscription (broker, read-only), Notifications, Blocked Users, Legal/About, Delete Account flow | Authenticated |

Role landing after auth (mirrors web `ROLE_REDIRECTS`): `BORROWER → Dashboard tab`, `BROKER → Dashboard tab` (or Onboarding wizard if no `Broker` row), `ADMIN → Admin Inbox tab`.

---

### 1. Splash / Launch

**Purpose** — Bridge cold-start while the app restores a stored session and decides the first route. Not a marketing screen.

**Main components** — Full-bleed forest `#0f1729` background, centered Mortly wordmark (Outfit), subtle amber underline, native splash → JS handoff with no flash of unstyled content.

**Actions** — None (automatic). Primary: resolve session and navigate.

**Key content** — Logo only. No copy, no CTA.

**State handling**
- **Restoring:** read JWT from secure storage (Keychain/Keystore), then probe `GET /api/auth/session` (or `/api/users/me`) with `x-mortly-mobile: 1`.
- **Valid session:** branch on flags — `needsNameEntry → Name Entry`; `needsRoleSelection → Select Role`; broker w/o profile → Onboarding wizard; else role landing tab.
- **No/expired/revoked token (null session or 401):** → Welcome.
- **Maintenance:** also fire `GET /api/maintenance`; if `true` and the user isn't admin, show the native Maintenance screen instead of the app (covered in cross-cutting section, not here).

**Mobile-specific** — Respect OS reduce-motion (no logo animation). Keep under ~1.5s; if the session probe is slow, route optimistically to the last-known role tab and reconcile, rather than blocking on the splash.

**Edge cases** — Offline at launch with a stored token: allow entry to cached shell, show a non-blocking "offline" banner, reconcile on reconnect. Supabase not configured / network flaky must not wedge the splash.

**Reuse vs redesign** — *New for mobile* (web has no splash). Reuses only the session contract.

---

### 2. Welcome

**Purpose** — First screen for unauthenticated users; the app is app-first, so the marketing homepage is **not** shipped here. This replaces the web `/` landing for app users.

**Main components** — Brand hero on cream `#faf8f3`, a one-line value prop (privacy-first mortgage marketplace), and two stacked CTAs.

**Primary actions** — "Get started" → **Signup**; "Sign in" → **Login**.

**Secondary actions** — Small "Terms" / "Privacy" links (open Legal screens/webviews — App Store requires reachable legal pre-account). Optional language hint (device-locale driven).

**Key content** — Short trust line; no live-activity marquee (web-only chrome, omitted).

**State handling** — Static; no auth-dependent chrome (avoids the web's flash-of-authed-nav problem entirely because Welcome is only reached when unauthenticated).

**Mobile-specific** — Native buttons ≥44px, safe-area padding. Apple/Google buttons can optionally appear here too (see Login) so first-timers OAuth in one tap.

**Edge cases** — Deep link arriving while unauthenticated (e.g. a push tapped after logout) parks the target and resumes it after successful auth.

**Reuse vs redesign** — *Redesign* — condensed from web marketing `/`; drops hero marquee, keeps role CTAs.

---

### 3. Login

**Purpose** — Email/password + Apple/Google sign-in; route by role after auth. Mirrors web `/login` semantics but uses the mobile token path.

**Main components** — Card-elevated form: email, password (secure entry), "Forgot password?" link, primary "Sign in", divider "or continue with", **Apple** + **Google** native buttons, footer link to Signup, verified-success banner when arriving from verification.

**Primary actions**
- Credentials: POST to the credentials/session-token path with `x-mortly-mobile: 1`, capture the returned JWT into secure storage (do **not** rely on cookies). On success, fetch session → route by role or to a parked deep-link target.
- Apple/Google: native SDK sign-in → `idToken` → `POST /api/auth/mobile-oauth {provider, idToken, name?}` → store 30-day `sessionToken`, then branch on `needsRoleSelection` / `needsNameEntry`.

**Secondary actions** — Forgot password; navigate to Signup.

**Key content** — Sentinel-code → `t()` mapping identical to web:

| Sentinel | Behavior |
|---|---|
| `EMAIL_NOT_VERIFIED` | Auto-navigate to **Verify Email** with prefilled email |
| `GOOGLE_ACCOUNT` | Inline "use Google sign-in" hint |
| `RATE_LIMITED` | "Too many attempts" (per-IP 30 / per-email 5 over 15 min) |
| `INVALID_CREDENTIALS` / `MISSING_CREDENTIALS` | Generic invalid message |
| `ACCOUNT_SUSPENDED` / `ACCOUNT_BANNED` | Status-specific copy, no retry |
| unknown | `common.unexpectedError` |

**State handling** — idle / loading (`auth.loggingIn`, disable inputs) / error banner / verified-success banner. Apple/Google buttons show their own in-flight spinners.

**Mobile-specific** — Apple sign-in mandatory placement (since Google is offered) per App Store 4.8. Google audience uses `GOOGLE_IOS_CLIENT_ID` + `GOOGLE_CLIENT_ID`; Apple audience the bundle/services IDs — all already server-supported. Password autofill / passkey affordances enabled. Korean IME safe (no submit-on-composition quirks in single-line fields).

**Edge cases** — OAuth-only account tries password → `GOOGLE_ACCOUNT`. Suspended/banned via OAuth returns 403 from `mobile-oauth` → show status copy, clear any partial token. Apple returns no email on repeat auth (fine — links by `appleId`). Provider `email_verified=false` → 401, generic failure.

**Reuse vs redesign** — *Reuse* contract + sentinel mapping; *redesign* the token handoff (native storage, no cookie) and native OAuth SDKs replacing the web redirect flow.

---

### 4. Signup

**Purpose** — Create a BORROWER or BROKER account with mandatory legal acceptance. Mirrors web `/signup`.

**Main components** — Name, email, password, confirm-password; **role toggle** (BORROWER default; hidden/locked when arriving from a role-scoped deep link, e.g. a "for brokers" universal link → `role=broker`); terms/privacy checkbox linking to Legal screens; primary "Create account"; Apple/Google alternatives; link to Login.

**Primary actions**
- Email path: client-validate (name required, email regex, password ≥8, passwords match, terms checked) → POST `/api/auth/signup {name,email,password,role,locale,legalVersion}` with explicit `locale` (device locale, `ko` default) and `legalVersion = CURRENT_LEGAL_VERSION ('2026-04-06')` → navigate to **Verify Email** (carry email; carry `emailFailed` when the send throws).
- OAuth path: set legal acceptance first (mobile equivalent of the `mortly_legal_acceptance` cookie — send acceptance metadata / require the terms checkbox), then native SDK → `mobile-oauth`.

**Secondary actions** — Toggle role; open Terms/Privacy; switch to Login.

**Key content** — Server maps: `409 → auth.emailExists`, `429 → auth.tooManyRequests` (per-IP 5/min), else `auth.somethingWentWrong`. Role locked to BORROWER/BROKER; server rejects mismatched `legalVersion`.

**State handling** — idle / validating (inline field errors) / loading (`auth.creatingAccount`) / error banner. Legal-required path (OAuth without acceptance) surfaces `mustAgreeToTerms`.

**Mobile-specific** — Numeric-free keyboards per field; password rules shown inline; secure entry with reveal toggle. Because mobile can't use the web cookie, legal acceptance must be sent explicitly on both the email and OAuth paths so `lib/auth.ts` links/creates without bouncing to `?legal=required`.

**Edge cases** — Email send failure at signup: account still created, response `emailSent:false` → Verify Email opens with failure copy and Resend immediately available (countdown 0). Duplicate email → 409. Terms unchecked blocks submit client-side and is defended server-side.

**Reuse vs redesign** — *Reuse* validation rules + endpoint; *redesign* legal-acceptance transport (explicit vs cookie) and native OAuth.

---

### 5. Verify Email (6-digit)

**Purpose** — Confirm a newly created account via the emailed 6-digit code. Mirrors web `/verify-email`.

**Main components** — Native OTP field (6 digits, one-time-code autofill / paste support), echoed email, submit (disabled until 6 digits), Resend with countdown, error/success banners.

**Primary actions** — POST `/api/auth/verify-email {email, code}` → on success route to **Login** prefilled + verified banner (or, if we already hold a session from OAuth, straight to role landing). Resend → POST `/api/auth/resend-code {email, locale}`.

**Secondary actions** — Change email (back to Signup); contact support link.

**Key content / rules** — Code is 6 digits, SHA-256 compared, 10-min expiry, **5-attempt burn** then must resend. Durable limits: per-email 10/10min, per-IP 30/hr. Resend: 60s per-account cooldown + 3/min per-IP; 429 returns `retryAfter` which drives the countdown.

**State handling**

| State | Trigger | UI |
|---|---|---|
| idle | — | OTP empty |
| loading | submit | `auth.verifying` |
| invalid | 400 generic | `auth.invalidCode` |
| expired | 400 `{expired:true}` (bad code, >5 attempts, or TTL) | `auth.codeExpired` + prompt to resend |
| success | 200 | `auth.codeSent`/verified → next |
| cooldown | after resend / 429 | disabled Resend + countdown (default 60s or `retryAfter`) |
| emailFailed | from Signup `emailFailed=1` | pre-error copy, countdown 0 |

**Mobile-specific** — iOS/Android SMS-less email OTP autofill where available; deep-link from the verification email (universal link) can pre-fill the code. Backspace/paste handled by the native OTP component (the web's manual box-splitting logic is dropped).

**Edge cases** — Unknown email and already-verified both return the identical generic 400 (enumeration-safe) — show the same invalid copy. Distinguish `expired` vs `invalid` for correct guidance. Send failure on resend → 502 surfaced as retryable.

**Reuse vs redesign** — *Reuse* semantics/limits; *redesign* the input to a native OTP field + email deep-link autofill.

---

### 6. Forgot Password

**Purpose** — Request a reset email; enumeration-safe generic confirmation. Mirrors web `/forgot-password`.

**Main components** — Single email input; "Send reset link"; post-submit success card ("Check your email") with Back-to-Login; "remember your password?" link.

**Primary action** — POST `/api/auth/forgot-password {email, locale}` (pass locale explicitly for correct email language) → always show generic success.

**State handling** — idle / loading (`auth.sending`) / submitted-success card / error (`429 → tooManyRequests`, else `somethingWentWrong`). Per-IP 3/min; per-account 60s issue cooldown; constant-time ~350ms pad.

**Mobile-specific** — The reset link is a **web URL** (`{base}{/en?}/reset-password?token=`). Decision (call out in build): register a universal link / app-link for `/reset-password` so the token opens the native **Reset Password** screen; otherwise open the web page in an in-app browser. Default recommendation: universal link → native screen for a consistent experience.

**Edge cases** — Always generic 200 (no account signal). Rapid re-taps gated by cooldown.

**Reuse vs redesign** — *Reuse* endpoint; *redesign* deep-link handling of the emailed token.

---

### 7. Reset Password

**Purpose** — Set a new password from the emailed token; invalidates all existing sessions. Mirrors web `/reset-password`.

**Main components** — New password + confirm inputs (secure, reveal toggle); "Reset password"; success card → Login; "Invalid link" card when the token is missing.

**Primary action** — POST `/api/auth/reset-password {token, password}` → success card → Login.

**Key content / rules** — Client: match + ≥8. Server: SHA-256 token lookup + expiry (1 hr), bcrypt-12, sets `emailVerified=true`, **increments `tokenVersion`** (revokes all JWTs). Per-IP 5/min.

**State handling** — no-token → "Invalid Link" card (no API call) / idle / loading (`auth.resetting`) / success / error (`429 → tooManyRequests`, `400 → invalidLinkDesc`, else generic).

**Mobile-specific** — Entered via universal link carrying `?token=`. Because the reset revokes tokens, after success **force a fresh login** (clear any stored JWT) — the app must not assume continuity.

**Edge cases** — Missing/expired/invalid token → invalid-link copy. If the user is currently signed in on this device and resets, treat the local token as revoked immediately.

**Reuse vs redesign** — *Reuse* endpoint + revocation behavior; *redesign* deep-link entry and forced re-login.

---

### 8. Name Entry (Apple no-name)

**Purpose** — Capture a display name when Apple returns none (`needsNameEntry === true`). **No web equivalent exists** — mobile-only.

**Main components** — Single name field, brief explainer, "Continue".

**Primary action** — PATCH `/api/users/me {name}` (name ≤100, required) with `x-mortly-mobile: 1` → server clears `needsNameEntry` and returns a fresh `sessionToken` (mobile can't share the cookie, so persist the returned token) → proceed to Select Role or role landing.

**State handling** — idle / saving / error. Block dashboard access until a name is set (Apple only supplies the name on first authorization; a failed first call leaves `name=null`).

**Mobile-specific** — Appears immediately post-OAuth in the onboarding transition stack. Never overwrites an existing name (server guard).

**Edge cases** — User force-quits mid-flow: on next launch the splash re-detects `needsNameEntry` and returns here. Backfill only occurs if a name is provided later.

**Reuse vs redesign** — *New for mobile* (net-new screen), reusing the existing `PATCH /api/users/me` + `needsNameEntry` flag.

---

### 9. Select Role

**Purpose** — First-time role choice for OAuth-created accounts (`needsRoleSelection === true`). Mirrors web `/select-role`, but mobile drives it itself.

**Main components** — Two large role cards (BORROWER / BROKER), optional pre-selection from a `role=` deep link, "Continue".

**Primary action** — POST `/api/auth/select-role {role}` with `x-mortly-mobile: 1` → server strips `needsRoleSelection`, invalidates the session DB cache, and returns a **fresh 30-day JWT** → persist it → route (`BROKER →` Onboarding wizard, `BORROWER →` Dashboard).

**Key content / rules** — First-time only: `409` if already selected; ADMIN role change forbidden (`403`); only BORROWER/BROKER accepted.

**State handling** — resolving session (spinner) / ready / submitting (`common.loading`) / error. Auto-skip to role landing if `!needsRoleSelection`; bounce to Welcome if unauthenticated.

**Mobile-specific** — Must persist the returned token (not rely on `useSession().update()` like web). Sequenced after Name Entry when both flags are set.

**Edge cases** — Double-submit / already-onboarded → 409 handled gracefully (route forward). Attempting to become ADMIN → 403 (shouldn't occur from UI).

**Reuse vs redesign** — *Reuse* endpoint + `x-mortly-mobile` 30-day-token behavior; *redesign* into an app-owned screen with native token persistence.

---

### 10. Broker Onboarding (multi-step wizard)

**Purpose** — Create the `Broker` profile row so the broker can reach the marketplace. Blocks the broker app until complete. Web `/broker/onboarding` is one long scroll; mobile splits it into a native stepped wizard.

**Proposed steps** (all fields map to `lib/validate.ts` + `lib/requestConfig.ts`):

| Step | Fields | Validation |
|---|---|---|
| 1 · Business | `brokerageName*` (≤200), `province*` (13-item PROVINCES select), `licenseNumber` (optional, `/^[A-Z0-9-]{1,50}$/i`) | brokerage + province required |
| 2 · Contact & category | `phone*` (+1 UI, stored E.164 `/^\+[1-9]\d{6,14}$/`), `mortgageCategory` (RESIDENTIAL / COMMERCIAL / BOTH, default BOTH) | phone required |
| 3 · About | `bio` (≤2000), `yearsExperience` (0–50 UI / 0–100 server), `areasServed` (≤1000), `specialties` (≤1000) | all optional |
| 4 · Photo (optional) | avatar via native picker + crop → 512×512 JPEG | non-fatal |

**Primary action** — On final step: POST `/api/brokers/profile {...form, phone:'+1'+digits}` (creates `verificationStatus=PENDING`, `subscriptionTier=FREE`, `responseCredits=0`) → **deferred** `uploadBrokerAvatar` via signed URL (`/api/brokers/avatar/upload-url` → Supabase `uploadToSignedUrl` → confirm `/api/brokers/avatar`) → refresh broker context → route to Dashboard (or Broker Profile on avatar-only failure).

**Secondary actions** — Back/Next between steps; skip photo; save-and-resume (native local persistence of the in-progress form so a backgrounded app doesn't lose work).

**State handling** — loading (skeleton) / per-step validity gating Next / submitting / error banner / avatar-upload-failed toast (non-fatal, route to Profile to retry). Returns to Welcome if session isn't a broker.

**Mobile-specific** — Replace `react-easy-crop` with a native image picker + cropper (still resize to 512² JPEG, hit the same signed-URL endpoints). Phone field auto-formats `(###) ###-####`, stores `+1XXXXXXXXXX`. Numeric keypad for years. Avatar allowed while PENDING (only REJECTED brokers are blocked from setting a photo).

**Edge cases** — `409` if a profile already exists (route forward to Dashboard). Avatar object-store validation may reject non-JPEG/>1MB (`INVALID_IMAGE_TYPE`/`IMAGE_TOO_LARGE`) — surface a retry toast, profile still saved. `skipProfileGate` equivalent: the wizard itself is the gate, so don't redirect-loop.

**Reuse vs redesign** — *Reuse* field set, validators, PROVINCES, deferred-avatar pipeline; *redesign* single scroll → 4-step wizard + native cropper + local draft persistence.

---

### 11. Borrower First-Run

**Purpose** — There is **no borrower onboarding** by design (web sends borrowers straight to the dashboard). Mobile matches this: after signup/verify/role-selection, a BORROWER lands directly on the Dashboard tab.

**What ships here instead** — A lightweight, dismissible **first-run coach layer** on top of the Dashboard (not a separate route): a one-time card explaining the flow (create a request → brokers respond → chat), and — importantly — a **push-permission priming prompt** before the OS dialog (register `DeviceToken` via `/api/notifications/register-device` only after the user opts in). Dismissal persisted in native storage.

**State handling** — Shown once (keyed like the web `mm_verified_seen_*` pattern, but in AsyncStorage). If load fails, the coach never blocks the dashboard.

**Edge cases** — Push permission denied → no `DeviceToken` registration; app still works via foreground fetch; re-prompt path lives in Settings → Notifications, not here.

**Reuse vs redesign** — *New, minimal* — respects the "no borrower onboarding" decision; adds only a push-priming step that has no web analog.

---

### 12. Settings — Account (role-aware)

Single "Account Settings" screen per role, reached from the "More" sheet / profile tab, redesigned from web's one long form into grouped native list rows (Profile · Security · Notifications · Legal · Danger Zone).

**12a. Borrower Account** (`/borrower/profile` parity)
- **Components:** stat rows (`_count.borrowerRequests`, conversations), Profile group (editable **name**; read-only email; `publicId` shown as "User ID"; member-since), Security group (**Change Password**), Notifications link, Legal link, Delete Account.
- **Actions:** Save name → PUT `/api/borrowers/profile {name}`. Change password → PUT `{currentPassword, newPassword}` (client checks match + ≥8; server bcrypt-verifies and **bumps `tokenVersion`**, logging out all sessions within ~5s).
- **States:** loading (skeleton) / saving / success (`settings.profileUpdated`, `settings.passwordChanged`) / error (`auth.passwordMismatch`, `auth.passwordTooShort`, load/update failures).
- **Edge cases:** OAuth-only account has no `passwordHash` → hide the change-password form and show "not available for this account" (server rejects otherwise). Email immutable (`settings.emailNote`).

**12b. Broker Account** (`/broker/profile` parity)
- **Components:** verification-status pill (PENDING amber / VERIFIED forest / REJECTED red), avatar (upload/change/remove; hidden when REJECTED), business fields (same as Onboarding + read-only email + `publicId`), Delete Account. **No in-app password change** — a Security row deep-links to Forgot Password (brokers reset via `/forgot-password`).
- **Actions:** Save → PUT `/api/brokers/profile` (phone normalized `+1` E.164; `profilePhoto` **not** writable here). Avatar → native picker/crop → `uploadBrokerAvatar` (immediate) → cache-bust `?v=Date.now()` → refresh broker context so tabs/sidebar update. Remove → DELETE `/api/brokers/avatar`.
- **States:** loading / saving / `photoBusy` (Uploading…) / banners. REJECTED hides avatar controls ("Profile photo isn't available for this account").
- **Edge cases:** avatar upload validated server-side (JPEG ≤1MB); REJECTED broker `upload-url` 403.

**Mobile-specific (both)** — Send `x-mortly-mobile: 1`. Group fields as tappable rows opening focused edit sheets rather than one dense form. Locale-aware date formatting (`ko-KR` / `en-CA`).

**Reuse vs redesign** — *Reuse* endpoints + rules; *redesign* IA into grouped rows + native cropper.

---

### 13. Settings — Subscription (BROKER, read-only) — billing compliance surface

**Purpose** — The **only** billing surface in the app. Because Apple/Google take 15–30% on in-app purchases and **only brokers pay**, the app performs **no in-app purchase**. This screen is a read-only entitlement viewer with a single external hand-off. Borrowers and admins never see it.

**Main components**
- **Current plan card:** tier badge (`FREE` / `BASIC` / `PRO` / `PREMIUM`) using the tone map (PREMIUM→accent, PRO→info, BASIC/FREE→neutral).
- **Credits + usage:** monthly response credits and remaining balance from `/api/brokers/profile` + `/api/tier-credits`; render **"Unlimited"** only when tier is PREMIUM **and** `subscription.status === ACTIVE` (PAST_DUE PREMIUM shows the raw number, never "Unlimited"). Credits are `-1` sentinel for unlimited — special-case arithmetic.
- **Renewal / period:** `currentPeriodEnd` as the renewal date; if `cancelAtPeriodEnd`, show "Cancelling on {date}"; if a `pendingTier` downgrade is scheduled, show "Changing to {tier} on {date}".
- **PAST_DUE banner:** prominent amber/red banner when `subscription.status` is `PAST_DUE` (paid credits stripped, plan paused, messaging blocked) → "Update payment on mortly.ca".
- **Premium early-access row:** shown **only** when `GET /api/premium-early-access.enabled` is true (dark-launched, default off); renders live `{{hours}}h` copy — never advertised while disabled.
- **Single CTA:** **"Manage subscription on mortly.ca"**.

**Primary action** — "Manage subscription on mortly.ca" opens the **external system browser** (not an in-app payment webview, not SFSafariViewController for the purchase itself) to the web billing page, where all Stripe checkout / upgrade / downgrade / payment-method / resume / cancel happen. No prices, no "Upgrade" buttons, no plan-picker in the app.

**Secondary actions** — Pull-to-refresh to re-read entitlement (replaces the web's 15s polling). Optionally "View invoices" opening the web billing page externally.

**Key content / rules displayed (read-only, from server truth):**

| Tier | Monthly credits | In-app messaging | Shown badge |
|---|---|---|---|
| FREE | 0 | cannot message (`UPGRADE_REQUIRED`) | neutral |
| BASIC | 5 | 1 credit per new conversation | neutral |
| PRO | 20 | 1 credit per new conversation | info |
| PREMIUM | Unlimited (`-1`) | unlimited; keeps early-access perk | accent |

`SubscriptionStatus`: `ACTIVE` / `PAST_DUE` / `CANCELLED` / `EXPIRED`. PAST_DUE keeps the PREMIUM early-access *visibility* perk (tier unchanged) but blocks opening conversations (`SUBSCRIPTION_PAST_DUE`) — the banner explains "visible but can't act until payment is fixed".

**State handling** — loading (skeleton) / loaded (ACTIVE) / PAST_DUE banner / cancelling banner / pending-downgrade banner / no-subscription (FREE) empty variant / fetch error with retry. Credit count styled red when 0.

**Mobile-specific & compliance** — This is the **anti-steering risk area**: the external "manage" link and the read-only posture are the conservative default. **Ship with no pricing and no in-app checkout.** Flag at submission time that App Store external-link rules shifted 2024–2025; verify current policy before adding any explicit "cheaper on the web" language. Open the CTA in the **external** browser (`Linking.openURL`) rather than an embedded webview to stay clearly outside IAP scope. Deep-link back into the app (universal link) after the user returns is optional; on foreground, refresh entitlement.

**Edge cases** — PREMIUM `responseCredits === -1` → show "Unlimited" (ACTIVE) or numeric fallback (PAST_DUE); never do math on `-1`. No `stripeCustomerId` → invoices empty, "manage" still opens web (starts checkout there). Entitlement can change server-side (webhook) while the screen is open → reconcile on pull-to-refresh / foreground, and if a push arrives for payment-failed, surface the PAST_DUE banner.

**Reuse vs redesign** — *Reuse* `GET /api/brokers/profile`, `/api/tier-credits`, `/api/premium-early-access`, `lib/tiers.ts` (`TIER_PRICING`, `creditLabel`), tone map, i18n `pricing.*`/`broker.*`. *Redesign* by **stripping all mutation** — no `create-checkout` / `preview-plan-change` / `create-portal` calls from the app; the web owns every money movement.

---

### 14. Settings — Notifications

**Purpose** — First-class home for push/email preferences that **web never exposed** (the `/api/preferences` allowlist supports them but there's no web UI). Also the re-prompt path for push permission.

**Main components** — Toggles for **Push notifications** and **Email notifications**; a "Blocked users" row (→ screen 15); per-device push status.

**Actions** — Toggle push → PUT `/api/preferences {pushNotifications}` **and** drive `DeviceToken.pushEnabled` via register/unregister (`POST`/`DELETE /api/notifications/register-device`). Toggle email → PUT `/api/preferences {emailNotifications}`. If OS-level push is denied, the toggle deep-links to system settings.

**State handling** — reads `GET /api/preferences`; optimistic toggle with rollback on failure. Payload ≤10KB; unknown keys dropped server-side; `emailNotifications`/`pushNotifications` must be boolean.

**Mobile-specific** — On enabling push, obtain the Expo token, register with `{token, platform (IOS/ANDROID), locale (en/ko), deviceName, appVersion}`. Token-hijack guard: `409` if the token is bound to another user → prompt "sign out on the other device first". Honor `mutedUntil` if/when mute controls are added.

**Edge cases** — Permission revoked at OS level after in-app enable → reflect actual OS state, not just the pref. One user with two phones can receive different-language pushes (per-device locale) — acceptable, note in copy if surfaced.

**Reuse vs redesign** — *New surface* built on the existing `/api/preferences` + `register-device` contracts (the gap the recon explicitly calls out).

---

### 15. Settings — Blocked Users (Guideline 1.2)

**Purpose** — Manage the block list. The backend is fully enforced but **no web UI exists** — this is a **net-new, App-Store-required** screen (UGC apps need block + report).

**Main components** — List of blocked users (`publicId`, name, brokerageName, `blockedAt`), each with **Unblock**. Empty state when none.

**Actions** — List → `GET /api/users/blocked`. Block (also reachable from a chat/profile header elsewhere) → `POST /api/users/[publicId]/block`. Unblock → `DELETE /api/users/[publicId]/block`.

**Key content / rules** — Block is **symmetric**: hides conversations both directions, rejects new messages and new conversation opens between the pair (`403`). Idempotent (upsert/deleteMany). Cannot block yourself; email never exposed.

**State handling** — loading / empty / list; unblock optimistic with rollback.

**Mobile-specific** — Also expose block/unblock from the chat thread header (messaging section owns that), but the management list lives here. Needs `block.*` i18n keys (currently missing — must be added).

**Reuse vs redesign** — *New screen*, reusing existing block endpoints. Required to pass review.

---

### 16. Settings — Legal / About

**Purpose** — Reachable Privacy + Terms (App Store requirement) plus app/version info.

**Main components** — Rows: Privacy Policy, Terms of Service, Contact/Support (`mailto:support@mortly.ca`), app version, and legal-version line (`CURRENT_LEGAL_VERSION '2026-04-06'`).

**Actions** — Open Privacy/Terms as native screens rendering the existing `privacy.*` / `terms.*` i18n content, **or** in-app webview to `/privacy` and `/terms`. Recommendation: native screens for offline reachability and consistent typography (Pretendard for Korean).

**State handling** — static content.

**Mobile-specific** — Must be reachable both pre-account (from Welcome) and in-app. If the legal version bumps, coordinate re-acceptance with signup (out of scope here, but flag).

**Reuse vs redesign** — *Reuse* legal copy + constants; *redesign* into native/legal screens.

---

### 17. Logout

**Purpose** — End the session on this device.

**Placement** — In the "More" sheet (all roles), not a primary tab — matches the web pattern where sign-out lives in the More sheet.

**Action** — Confirm modal (`nav.logoutConfirmTitle`/`Desc`) → clear the stored JWT from secure storage → route to **Welcome** (never a marketing home; avoids stale authed-nav flicker). No server call strictly required, but optionally register-device `DELETE` to stop pushes to this device.

**State handling** — confirm → clearing → Welcome.

**Mobile-specific** — On logout, unregister the `DeviceToken` for this device so a shared phone doesn't keep receiving the prior user's pushes. Cancel any parked deep links.

**Edge cases** — If logout is triggered by a detected `401`/revoked token (password change/ban elsewhere) rather than a tap, skip the confirm modal and go straight to Welcome with a subtle "You were signed out" note.

**Reuse vs redesign** — *Redesign* — cookie `signOut` → clear native token + Welcome; add device-token cleanup.

---

### 18. Delete Account (Guideline 5.1.1(v))

**Purpose** — Irreversible in-app deletion, required by Apple. Mirrors the shared web `DeleteAccountSection`, whose two-modal design was explicitly built to match mobile's two native alerts.

**Main components / flow** — Danger-zone row → **two sequential native confirm alerts** → for credentials accounts, a **password re-auth** prompt; for OAuth-only accounts, a typed `ack:"DELETE_MY_ACCOUNT"`.

**Action** — Two-pass:
1. `DELETE /api/users/me {ack:'DELETE_MY_ACCOUNT'}` with `x-mortly-mobile: 1` (succeeds for OAuth-only).
2. If server returns `400 /password/i`, show the password prompt and retry with `{currentPassword}`.

On success: clear the stored token and route to Welcome.

**Key content / rules** — Credentials accounts **must** retype the current password (defeats stolen-JWT deletion). **ADMIN cannot self-delete** (`403`). Server runs a hard `$transaction` cascade (messages, brokerRequestSeen, conversations, borrowerRequests, reports by/against, subscription, broker row, adminNotices, deviceTokens, user) then best-effort Supabase avatar removal (PIPEDA).

**State handling** — stage `null|first|second|password`; deleting spinner (`settings.deleteAccountDeleting`); error keeps the modal open for retry (`settings.deleteAccountFailed` generic fallback). Success → `settings.deleteAccountSuccess` → Welcome.

**Mobile-specific** — Use real native `Alert` dialogs for the two confirms + a secure text prompt for the password (matches the design intent). Send `x-mortly-mobile: 1`. Consider (flag for future hardening) requiring a fresh Sign-in-with-Apple/Google round-trip for OAuth deletions instead of just the typed ack.

**Edge cases** — Admin attempts deletion → 403 with support copy. Stolen-JWT deletion on a credentials account is blocked (password required). Network failure mid-delete → modal stays open, retry-safe (cascade is transactional server-side).

**Reuse vs redesign** — *Reuse* endpoint + two-step contract (designed for mobile); *implement natively* with real Alerts + secure prompt.

---

### Reuse-vs-redesign summary for this section

| Screen | Reuse from web | Redesign for mobile |
|---|---|---|
| Splash | session contract | net-new screen |
| Welcome | role-CTA logic | condensed marketing, no marquee |
| Login | endpoint + sentinel map | native token storage, native OAuth SDKs |
| Signup | validation + endpoint | explicit legal-acceptance transport |
| Verify Email | 6-digit semantics/limits | native OTP + email deep-link autofill |
| Forgot/Reset PW | endpoints + tokenVersion revoke | universal-link token → native screen, forced re-login |
| Name Entry | `PATCH /api/users/me` + flag | net-new screen |
| Select Role | endpoint + 30-day token | app-owned screen, native persistence |
| Broker Onboarding | fields/validators/avatar pipeline | 4-step wizard, native cropper, draft persistence |
| Borrower first-run | "no onboarding" decision | minimal push-priming coach only |
| Account settings | profile endpoints + rules | grouped rows, native cropper |
| **Subscription (read-only)** | profile/tier/premium APIs, `lib/tiers.ts`, tones, i18n | **strip all mutation; external "manage" hand-off only** |
| Notifications | `/api/preferences` + register-device | net-new UI (web gap) |
| Blocked Users | block endpoints | net-new UI (web gap; App Store required) |
| Legal/About | `privacy.*`/`terms.*`, legal constants | native legal screens |
| Logout | confirm-modal pattern | clear native token + device-token cleanup |
| Delete Account | `DELETE /api/users/me` two-step | native Alerts + secure prompt |

---

## 2B. Screens — Borrower App

The borrower app is the "consumer" half of the role-based single app. A session whose `user.role === "BORROWER"` lands here after login/role-selection. Borrowers **never pay** — there is no billing surface, no tier, no credit anywhere in this stack. The borrower's entire job is: create a mortgage consultation request → wait for admin approval → receive broker responses → chat. Everything below reuses the existing `pages/api/*` endpoints over HTTPS (no mobile backend) and the server-enforced request lifecycle, so the native app inherits every guard for free and must never reimplement authority client-side.

**Navigation model (expo-router).** A `(borrower)` stack with a native bottom tab bar of exactly three primary tabs, mirroring `BorrowerNavKey` (`dashboard` / `messages` / `profile`) and the web `MobileTabBar`. There is no "browse brokers" tab — broker discovery is reactive, folded into request detail (see §Browse Brokers below). "More" holds only Sign Out. Tab badges: `dashboard` = active-requests count, `messages` = unread-messages count (both cap at `9+`).

| Tab | Route (expo-router) | Web parity | Tab badge |
|---|---|---|---|
| Dashboard | `app/(borrower)/dashboard` | `/borrower/dashboard` | activeRequests (OPEN + IN_PROGRESS) |
| Messages | `app/(borrower)/messages` (+ `messages/[conversationId]`) | `/borrower/messages` | unreadMessages |
| Profile/Settings | `app/(borrower)/profile` | `/borrower/profile` | — |
| — (pushed, not tabbed) | `request/new`, `request/[id]` | `/borrower/request/*` | — |

**Shared view-model.** Port `BorrowerDataContext` verbatim as a store: one source polling `GET /api/borrowers/profile`, `/api/requests`, `/api/messages/unread`, `/api/conversations`. On native, replace the web's fixed 30s interval with **app-focus refresh + pull-to-refresh + push-driven invalidation** (push infra already fires `pushData.type='request'|'conversation'`) to save battery. `request/[id]` and `messages` fetch directly (as on web).

**Request lifecycle (the spine of every borrower screen).** `RequestStatus` enum: `PENDING_APPROVAL → OPEN → IN_PROGRESS → CLOSED / EXPIRED / REJECTED`. New requests are created `PENDING_APPROVAL` and are **invisible to brokers** until an admin flips them to `OPEN`. This approval gate is the dominant state-machine every screen must render honestly.

**Status → tone (public map, `StatusBadge.STATUS_TONE`).** Adopt the **public** mapping (not admin `tones.ts`) as canonical for borrower screens, since these are the borrower-facing tones:

| Status | Tone | Color |
|---|---|---|
| OPEN | success | success-700 `#15803d` on success-50 |
| IN_PROGRESS | info | info-700 `#1d4ed8` |
| PENDING_APPROVAL | warn | warning-700 `#b45309` (amber) |
| CLOSED / EXPIRED | neutral | cream-200 / forest-700 |
| REJECTED | danger | error-700 `#b91c1c` |

> Cross-cutting design tokens (Midnight & Gold palette, Outfit/IBM Plex Mono, sharp `rounded-sm`, NativeWind mapping) are defined once in the design-system section — not repeated per screen here.

---

### 2B.1 Dashboard (Home)

| | |
|---|---|
| **Route** | `app/(borrower)/dashboard` → web `/borrower/dashboard` |
| **Purpose** | Borrower home: greeting, two stat cards, active-request hero cards, recent broker activity, "other" requests, and priority action banners for the approval gate. |
| **Entry** | Default authed landing for BORROWER (post-login `ROLE_REDIRECTS`); Dashboard tab; deep-links; push tap on `type='request'`. |
| **Data** | `useBorrowerData()` (shared store). No direct fetch. |

**Layout (native reflow).** The web `max-w-6xl` multi-column grid collapses to a single vertical scroll:
1. Header: greeting + primary CTA **"새 요청 / New request"** (→ `request/new`).
2. Stat row (2 native cards): **Active requests** (`OPEN|IN_PROGRESS` count) · **Broker responses** (`Σ _count.conversations`).
3. **Priority action banner** (at most one, by priority — see below).
4. **Active request cards** (per OPEN/IN_PROGRESS request): category + first product, region, timeline, responses count, `StatusBadge`, posted date, responder peek, "View responses" / "Edit" actions, and a `new-responses` amber badge.
5. **Recent activity**: top 5 conversations by `updatedAt` → tap opens `messages/[conversationId]`.
6. **Other requests** (collapsible): PENDING / CLOSED / REJECTED / EXPIRED, dimmed for terminal states.

**Action-banner priority (approval-gate surfacing).**

| Condition | Banner tone | Copy / CTA |
|---|---|---|
| A request is `REJECTED` | danger | "Request not approved" + `rejectionReason`, → detail |
| A request is `PENDING_APPROVAL` | warning | "Pending approval" → "View details" |
| (else) | — | no banner |

**States.**
- **Loading:** native skeleton mirroring `SkeletonDashboard`.
- **Empty (no requests):** "Create your first request" card → `request/new`.
- **No active requests:** "No active requests" card (requests may all be pending/closed).
- **Error + empty cache (critical):** show a **"Couldn't load your requests" retry card — NOT the empty state.** This is a deliberate anti-duplicate-submission guard: never show "create your first request" during an outage.
- **Error + non-empty cache:** inline error banner above cached content.

**Native considerations.** Pull-to-refresh calls the store `refresh()`. `relativeTime` is locale-aware (ko-KR / en-CA). Push tap with `pushData.type='request'` deep-links to the relevant request or its `#responses` section.

---

### 2B.2 Create Request (the long-form flow) — **primary UX investment**

| | |
|---|---|
| **Route** | `app/(borrower)/request/new` → web `/borrower/request/new` + `components/RequestForm.tsx` (39 KB, the heaviest port) |
| **Purpose** | Author a mortgage consultation request across 3 steps: Basics → Details → Review & Submit. |
| **Entry** | Dashboard CTA; empty-state CTA; marketing deep-link `/borrower/request/new` (roleLocked). |
| **API** | `POST /api/requests` (create). Rate-limited **10/min** (bucket `requests-create`). |

This is the single most complex borrower surface and the section's design focus. The web `RequestFormLayout` is a 3-column desktop layout (step rail + live summary + form); on native it becomes a **native stepped/paged flow** with a segmented progress header (`STEP n/3` eyebrow → native progress indicator). `lib/requestConfig.ts` is the single source of truth for every enum/label/validator — **import verbatim**; do not hand-copy option lists.

**Step 1 — Basics.**
- Category cards: `RESIDENTIAL` | `COMMERCIAL` (`BrokerMortgageCategory`-adjacent; server accepts only these two for requests).
- Product-type checkboxes from `requestConfig`: RESIDENTIAL has 8 (`NEW_MORTGAGE, PRE_APPROVAL, REFINANCING, RENEWAL, PERSONAL_LOC, REVERSE_MORTGAGE, DEBT_CONSOLIDATION, EQUITY_LOAN`); COMMERCIAL has 6 (`COMM_NEW_LOAN, COMM_REFINANCING, COMM_TRANSFER, COMM_GOVT_LOAN, COMM_LOC, COMM_DEBT_CONSOLIDATION`). Switching category resets product selection.
- **Gate:** Next disabled until ≥1 product selected (1–20 allowed, each valid for the category).

**Step 2 — Details (the keyboard/validation heavy step).**
- Province **required** — native picker over the 13 `PROVINCES` (Canada). City optional (≤100 chars).
- **Residential branch:** `purposeOfUse` (multi-select subset of `OWNER_OCCUPIED, RENTAL`, ≥1 required); `incomeTypes` (≥1 of 6: `EMPLOYMENT, SELF_EMPLOYMENT, DIVIDEND, RENTAL, FOREIGN, OTHER`; `OTHER` reveals free-text); up to 2 years `annualIncome` with amount inputs.
- **Commercial branch:** `businessType` (required); up to 2 years corporate income/expenses + `ownerNetIncome`. **Financial parity rule:** any year with income must also have expenses and vice-versa, else block with `request.commercialFinancialsHelper`.
- `desiredTimeline` **required** — one of `ASAP, 1_MONTH, 3_MONTHS, 6_MONTHS, 1_YEAR_PLUS` (`TIMELINE_OPTIONS`).
- **Money inputs:** native numeric keypad (`keyboardType="number-pad"`), `$` prefix, locale-grouped display (`toLocaleString`), stored as numbers. Currency-format on blur.

**Step 3 — Review & Submit.**
- Section summary with **edit-jump chips** back to Step 1/2.
- **Additional details notes** textarea — **required, non-empty**, ≤4000 chars. (Commercial also requires non-empty notes server-side.)
- Privacy reminder ("your identity stays anonymous until you choose to reveal it").
- Submit → `POST /api/requests` → refresh store → replace-nav to `request/{publicId}`. Request lands `PENDING_APPROVAL`.

**Validation & submit outcomes.**

| Layer | Rule |
|---|---|
| Client step gates | Step1: ≥1 product · Step2: province + timeline + branch-required fields · Step3: notes non-empty + commercial parity |
| Server | category ∈ {RESIDENTIAL, COMMERCIAL}; `isValidProvince`; 1–20 products ≤100 chars each; valid timeline; notes ≤4000; `details` JSON ≤4096 bytes; residential needs `purposeOfUse` + ≥1 income type; commercial needs `businessType` + notes |
| `400 ACTIVE_REQUEST_CAP` | Borrower already has `max_requests_per_user` (default **5**) requests in `PENDING_APPROVAL\|OPEN\|IN_PROGRESS` (enforced in a Serializable txn) → show "You can have at most N active requests" |
| `429` | Exceeded 10/min → "Please wait a moment and try again" |

**Draft persistence (native rework).** Web autosaves to `sessionStorage` key `mortly:request-form-draft` (create mode only) and warns on `beforeunload`. Native replaces this with **AsyncStorage/secure local persistence** so a backgrounded/killed app doesn't lose an in-progress request, an **unsaved-changes guard on hardware/gesture back** (there is no `beforeunload` on native), and draft-clear on successful submit (keep on error).

**States.** Auth-loading → skeleton (the shell owns `/login` redirect; render skeleton, not a blank page, so deep-linked CTAs don't flash). Per-step disabled Next; submitting spinner; inline submit error; commercial-parity inline helper.

**Native considerations.** `KeyboardAvoidingView` + scroll-to-focused-field on the long Step 2; large 44px touch targets on checkboxes/chips; step transitions respect OS reduce-motion. Consider surfacing the whole flow as a full-screen modal stack so "Cancel" is unambiguous.

---

### 2B.3 My Requests (list)

There is no standalone `/borrower/requests` list on web — the **Dashboard is the request list** (active hero cards + collapsible "other requests"). On native, keep this: **do not add a dedicated My-Requests tab.** If the "other requests" set grows large, promote it to a pushed `request/index` screen reachable from a Dashboard "View all requests" row, reusing the same `RequestCard` model, filterable by status (`OPEN / PENDING_APPROVAL / CLOSED / EXPIRED / REJECTED`). Each card: category + first product, region, timeline, `StatusBadge`, responses count, posted date; tap → `request/[id]`. Terminal states render dimmed. This avoids inventing a surface the web doesn't have while giving mobile a scalable overflow home.

---

### 2B.4 Request Detail / Lifecycle Hub

| | |
|---|---|
| **Route** | `app/(borrower)/request/[id]` → web `/borrower/request/[id]`; also the target of `#responses` deep-links |
| **Purpose** | View one request, its status + lifecycle stepper, the brokers who responded, and manage it (edit / close / delete). |
| **API** | `GET /api/requests/[id]`; `PATCH` (edit), `PUT {status:CLOSED}` (close), `DELETE` (delete). |

**Layout.**
1. Header: `StatusBadge`, `#publicId` (mono), posted date.
2. **Approval-gate banners:** amber "Pending approval" banner when `PENDING_APPROVAL`; red rejection banner with `rejectionReason` when `REJECTED`.
3. **ConsultationStepper** (3 steps: Submit → Broker responds → Consultation). Port `getStepStates`. **Hidden entirely when REJECTED.** For a terminal request that never got a response, only step 1 shows complete (never falsely mark a consultation done).
4. **Read-only request view** — the web renders income/financials as HTML `<table>`; **redesign as native rows/cards** (guard legacy scalar commercial details so nothing renders `$undefined`).
5. **BrokerResponses / "Brokers who responded"** section (the discovery hub — see §2B.5).
6. **Action cluster → native action sheet** (edit / close / delete), each behind a confirm.

**Lifecycle actions & guards (all server-enforced).**

| Action | Allowed when | Guard / error |
|---|---|---|
| **Edit** (`PATCH`) | status `OPEN` or `PENDING_APPROVAL` | Once **any** conversation exists, material fields (`mortgageCategory, productTypes, province, city, details`) LOCK — only `notes` + `desiredTimeline` editable → `409 EDIT_LOCKED_BY_CONVERSATIONS` (`request.editLockedByConversations`). Send **only changed fields**. |
| **Close** (`PUT {status:CLOSED}`) | status `OPEN` or `IN_PROGRESS` | `400 CLOSE_INVALID_STATUS` otherwise. Closing posts a bilingual system message into every ACTIVE conversation and closes them. Irreversible — confirm modal warns. |
| **Delete** (`DELETE`) | status `OPEN` or `PENDING_APPROVAL` **and zero conversations** | `409` if conversations exist ("Cannot delete a request that has conversations") — offer Close instead (preserves chat history). |

**Edit mode.** Reuses the same `RequestForm` in edit mode. Pre-warn with an amber banner when conversations exist ("material changes are locked because brokers have responded"). Success → 4s toast (`request.editSuccess`).

**States.** Loading skeleton; `404` → replace-nav to Dashboard; other fetch errors → actionable error with "Back to requests" (fixes a prior infinite-skeleton bug); editing vs read-only; closing/deleting spinners; pending/rejection banners.

**Native considerations & open decision.** Request detail on web fetches directly and **does not subscribe to realtime** — status/response changes need a manual reload. On native, prefer **pull-to-refresh + push-driven invalidation** (approval/response events already push `type='request'|'conversation'`) rather than polling, so a borrower sees "your request is live" without leaving the screen. `#responses` becomes a native "Responses" section anchor (scroll-to or a segmented Detail/Responses control).

---

### 2B.5 Browse Brokers & Broker Public Profile — **a deliberate product decision**

**Web reality:** there is **no borrower "browse verified brokers" page.** `/borrower/brokers/[requestId]` is a pure server redirect to `/borrower/request/{id}#responses`. Broker discovery is **reactive only** — the borrower sees a broker *after* that broker spent a credit to open a conversation, via `<BrokerResponses>` on request detail. A borrower-initiated conversation path *does* exist server-side (`POST /api/conversations` with `brokerId`) but has **no UI entry point**.

**Recommendation for mobile:** ship the reactive model for launch (do **not** build a full broker directory), because a proactive browse surface would require net-new list/search/filter APIs and would let borrowers cold-contact brokers, changing the marketplace's economics (brokers pay to initiate; borrower-initiated conversations bypass the credit spend). Treat a proactive directory as an explicit post-launch product decision.

**Broker responses (the discovery hub) — reused as-is.**

| | |
|---|---|
| **Where** | Inside `request/[id]`, "Brokers who responded" (`BrokerResponses` model) |
| **Card fields** | Avatar (Supabase transform URL, size-squared, initials fallback), name, **VERIFIED badge** (only VERIFIED brokers ever appear — starting a conversation requires VERIFIED), `brokerageName`, `yearsExperience`, specialties chips, messages-exchanged count |
| **Sort** | `fastest` (earliest `createdAt`) · `most_experienced` (`yearsExperience` desc) — min 44px tap targets |
| **Actions** | "View messages" → `messages/[conversationId]`; `ReportButton` (`targetType=BROKER`) |
| **Disclaimer** | "verify independently" banner (Mortly is a marketplace, not a lender/advisor) |
| **Empty** | `brokerIntros.noIntros` — "No broker responses yet" |

**Broker public profile.** There is no standalone public broker-profile route on web — the `BrokerResponses` card **is** the borrower-facing broker identity. For mobile, an optional lightweight **broker detail sheet** (tap a response card → bottom sheet with the same fields, larger avatar, full specialties, verified badge, report action) is a reasonable native enhancement, but it must be driven entirely by the data already present in the conversation/response payload — no new "fetch arbitrary broker profile" endpoint, preserving the privacy model (borrowers only ever see brokers who engaged them).

---

### 2B.6 Messages — Conversation List

| | |
|---|---|
| **Route** | `app/(borrower)/messages` → web `/borrower/messages` (list pane) |
| **Purpose** | Borrower chat inbox: conversations grouped by request, with unread counts. |
| **API** | `GET /api/conversations`; unread via `GET /api/messages/unread` (counts `status=ACTIVE` only). |

The web is a 3-pane desktop layout (list | thread | request-context) that already collapses to list↔chat on mobile via `mobileShowChat` and hides the tab bar in chat. On native this **formalizes as stack navigation**: this list screen → `messages/[conversationId]` chat screen.

**Layout.** Conversation rows grouped by request via `getRequestTitle` (group headers only when >1 request). Each row: broker avatar, broker name, last-message preview, `relativeTime`, unread badge (`9+` cap, `bg-error-500`), and `CLOSED` badge for closed threads. Unread is **suppressed for CLOSED conversations** in the list. Active/unread row tint = `bg-amber-50/40`.

**States.** Loading (`ConversationListSkeleton`); empty ("No conversations yet — brokers will appear here after they respond"); error toast (dismissible). Selecting a thread optimistically zeroes its unread badge (rollback on fetch failure) and stamps read.

**Native considerations.** Drive the tab badge **and** the OS app-icon badge from `/api/messages/unread`. Pull-to-refresh; foreground-refresh conversation status (a thread may have closed while backgrounded). Push `type='conversation'` deep-links straight to the chat screen.

---

### 2B.7 Chat Detail

| | |
|---|---|
| **Route** | `app/(borrower)/messages/[conversationId]` → web `/borrower/messages?id=` (thread pane) |
| **Purpose** | Real-time 1:1 chat with a broker, anchored to one request; request-context available as a sheet. |
| **API** | `GET /api/conversations/[id]` (participant-gated, marks read); `POST /api/messages` (send); `PUT /api/conversations/[id] {status:CLOSED}` (borrower-only close). |

**Realtime model (security-critical — reuse verbatim).** Chat content is **never streamed to clients.** Subscribe to Supabase Realtime topic `chat-<conversationId>` for a **content-free `sync` broadcast**, then refetch the thread through the authenticated `GET /api/conversations/[id]` and **merge by message id**. `public.messages`/`public.conversations` have RLS deny-all for the anon key, so the app can read chat only through the API. A **5s poll fallback** backstops Realtime; skip the WebSocket when `isSupabaseConfigured` is false (poll only). On native, subscribe on screen focus / app foreground, unsubscribe on blur/background.

**Layout.** Messages grouped by date dividers. Bubble tokens: my/sent = `bg-forest-800` + `cream-100` text; received = `bg-white` + `cream-300` border + `forest-800` text; **system messages (`isSystem=true`) render centered** in `bg-cream-200` / `sage-500` (close notices, cron auto-close — never a participant bubble). Verified broker check = `amber-400`. Composer pinned to the bottom with `pb-[env(safe-area-inset-bottom)]` safe-area; tab bar hidden on this screen (native equivalent of `hideMobileTabBar`).

**Actions.**
- **Send** → optimistic append → `POST /api/messages` → dedupe against the Realtime/poll echo strictly **by message id**. Body trimmed 1–5000 chars; cannot start with `[admin]`/`[system]`; 30 msgs/min.
- **Close conversation** (borrower-only; brokers cannot close) → confirm → `PUT {status:CLOSED}`; composer replaced by a "conversation closed" notice.
- **Report** broker (`ReportButton`, `targetType=BROKER`).
- **Request context** → native bottom sheet (web `RequestContextPanel`, 85dvh `animate-slide-up`) reused via `viewFullHrefPrefix` → links to `request/[publicId]`.

**Edge cases.**
- Sending into a just-closed thread → `409 CONVERSATION_CLOSED` (poll merges messages but not status — refresh status on foreground).
- Optimistic + realtime/poll can double-add the same message → dedupe by id.
- `ChatDisclaimer` gate: one-time acceptance (web `localStorage` key `mortly_chat_disclaimer_accepted`) → persist in **AsyncStorage** on native; borrower-variant copy.
- **Korean IME:** guard Enter-to-send with `isComposing` equivalent on RN `TextInput` (ko is the default locale) so composition Enter doesn't submit mid-word.
- Supabase not configured → fetch-only, no realtime inserts.

**Native considerations.** `avatarTransformUrl` (size-squared Supabase transform) keeps egress small. Push notifications carry only `{type:'conversation', conversationId}` (generic "새 메시지 / New message" body — never message text, loan amounts, or financials) and deep-link to this screen. No read receipts / typing indicators exist today (out of scope unless explicitly added).

---

### 2B.8 Profile / Account Settings

| | |
|---|---|
| **Route** | `app/(borrower)/profile` → web `/borrower/profile` |
| **Purpose** | Borrower account: edit name, change password, view stats & support ID, delete account. **No billing — borrowers never pay.** |
| **API** | `GET/PUT /api/borrowers/profile`; account deletion via `DELETE /api/users/me`. |

**Layout (native settings list, grouped rows).**
- **Profile:** editable **name**; **email read-only** ("Email cannot be changed"); `publicId` shown as support "User ID" (mono); member-since (locale date).
- **Security:** change password — `currentPassword` + `newPassword` (≥8) + confirm-match. On success the server **bumps `tokenVersion`**, revoking all other sessions within ~5s (`SESSION_DB_CACHE_TTL_MS`). Reject OAuth-only accounts with "Password change not available."
- **Stats:** `_count.borrowerRequests`, `_count.conversations`.
- **Danger Zone → Delete account.** Required for **App Store guideline 5.1.1(v)**. Native two-step confirm (mirroring web `DeleteAccountSection`'s two sequential dialogs): credentials accounts must re-enter current password; OAuth-only send `ack:"DELETE_MY_ACCOUNT"`; `DELETE /api/users/me` hard-cascades and then `signOut` → login. Send the `x-mortly-mobile: 1` header.

**States.** Loading skeleton (`SkeletonProfile`); saving spinners; per-form success/error banners; password mismatch / too-short client errors; non-BORROWER → render nothing (shell handles redirect).

**Native considerations.** Secure text entry for passwords; keep the delete path reachable (store-review requirement). No in-app language switcher here (marketing-only per project convention); locale follows device/`locale` preference — do not add a KO/EN toggle to borrower settings.

---

### 2B.9 Cross-screen edge cases & error states (borrower)

| Case | Behavior |
|---|---|
| Session loading | Shell renders skeleton, not blank — deep-linked CTAs (e.g. marketing `request/new`) rely on this |
| Revoked/partial session | `GET /api/auth/session` returns null (tokenVersion/status mismatch after admin suspend/ban or password change) → route to login gracefully |
| Active-request cap | `400 ACTIVE_REQUEST_CAP` on submit → inline "at most N active requests" |
| Edit after brokers responded | `409 EDIT_LOCKED_BY_CONVERSATIONS` → only notes/timeline persist; pre-warn banner |
| Delete blocked | `409` when conversations exist → offer Close instead |
| Auto-expiry | Cron flips `OPEN\|PENDING_APPROVAL` older than `request_expiry_days` (30) to `EXPIRED`, **never** a request with an ACTIVE conversation; borrower notified (`request-expired-<id>`) → surface as a notice + dashboard badge |
| Maintenance mode | Non-admin borrower gets the native maintenance screen (poll `/api/maintenance` on launch/foreground); login/signup stay reachable |
| 404 request | Replace-nav to dashboard |
| No reopen path | Only `CLOSED` is accepted on the borrower `PUT`; there is **no borrower-facing reopen** for CLOSED/EXPIRED — they create a new request (confirm as final policy) |

**Open questions carried into build.** (1) Where is `OPEN → IN_PROGRESS` triggered? It's a valid "active" status but no borrower/broker write sets it — likely admin-set; confirm for the stepper/lifecycle model. (2) Should mobile ever expose a proactive broker-browse/direct-contact flow (API supports it) or stay reactive like web? Default: stay reactive for launch. (3) PREMIUM early-access embargo is dark-launched and purely broker-facing — the borrower app needs **no** awareness of it.

---

## 2C. Screens — Broker App

The broker app is the revenue-adjacent surface of Mortly, but it takes **no money in-app**. Every screen below is designed around three hard server-side gates the broker must clear before it can do anything valuable — **verification** (`verificationStatus`), **entitlement** (`subscriptionTier` + `subscription.status`), and the **PREMIUM early-access embargo** — and around one product constraint: **subscription is read-only in-app; all money movement hands off to `mortly.ca` in the external browser** (Apple/Google commission avoidance). The screens map 1:1 to existing `/broker/*` routes and reuse `BrokerDataContext`, `checkBrokerCanMessage`, and the existing REST endpoints verbatim.

### Tab structure (recap, detail lives in the Navigation section)

| Tab | Route root | Purpose |
|---|---|---|
| Dashboard | `/broker/dashboard` | Home: KPIs, verification/plan status, priority action banner |
| Requests | `/broker/requests` | Marketplace feed of OPEN requests (embargo + credit gated) |
| Messages | `/broker/messages` | Conversation list → chat detail |
| **More** sheet | — | Profile, **Plan & Credits (read-only)**, Sign out |

Profile and Plan live in the More sheet (not primary tabs), matching the web's demotion of billing/profile off the primary rail. The tab bar carries two badges from `BrokerDataContext`: `newRequests` on Requests and `unreadMessages` on Messages (9+ cap).

---

### 1. Broker Dashboard (`/broker/dashboard`)

The home screen and the single place a broker reads their whole standing at a glance. It renders one **priority action banner** whose content is decided by a strict precedence chain (server truth, not client guesswork).

**Priority banner precedence** (first match wins — mirrors web `ActionBanner`):

| Priority | Condition | Banner | Primary action |
|---|---|---|---|
| 1 | `verificationStatus !== VERIFIED` (PENDING) | "Verification in review" (amber) | none / "Learn more" |
| 2 | `verificationStatus === REJECTED` | "Verification not approved" (danger, red) | Contact / re-submit |
| 3 | `subscription.status === PAST_DUE` | "Payment failed — plan paused" (danger) | **Manage on mortly.ca** ↗ |
| 4 | paid tier & `responseCredits === 0` | "Out of response credits" (warning) | **Manage on mortly.ca** ↗ |
| 5 | `subscriptionTier === FREE` | "Upgrade to message clients" (amber hint) | **Manage on mortly.ca** ↗ |

Below the banner:

- **KPI cards (2):** "New requests this week" (`counters.newRequests`) and "Active conversations" (`counters.activeConversations`), both tappable → Requests / Messages.
- **Plan & credits chip** in the header eyebrow: tier `Badge` (FREE/BASIC/PRO/PREMIUM via `tones.ts`: PREMIUM→accent, PRO→info, BASIC/FREE→neutral) + a credits chip in `font-mono`. Credits chip shows `t('common.unlimited')` **only when `tier === PREMIUM && subscription.status === ACTIVE`**; otherwise it shows the raw `responseCredits`. A `PAST_DUE` PREMIUM broker is **never** advertised as unlimited (it displays the raw number, which the webhook has reset to 0). Red emphasis when credits `=== 0`.
- **PREMIUM early-access perk/teaser card** — rendered **only when** `GET /api/premium-early-access` returns `enabled: true` **and** the broker is VERIFIED. PREMIUM sees a "perk active" variant; lower tiers see an "upgrade teaser" variant with the live `{{hours}}h` window copy. Gated off entirely while the feature is dark-launched (`enabled: false`), so it must never render on a default deployment.
- **Recent lists:** latest 5 OPEN requests and up to 3 active conversations, each row deep-linking into detail.
- **One-time verified congrats banner** — green, shown once after verification flips to VERIFIED, dismiss-persisted in `AsyncStorage` under `mm_verified_seen_{profile.id}` (web uses `localStorage`; best-effort, tolerate unavailability).

**States:** loading (`SkeletonDashboard` until `profileChecked`); no-profile → transient empty while router pushes to onboarding; `requestsError` → inline alert (a 403/unverified is **not** an error — show the VerificationPendingCard path instead); empty ("all caught up").

**Mobile refresh:** replace the web's 30s poll with **pull-to-refresh + refresh-on-foreground** (`AppState`), plus push-driven invalidation of `BrokerDataContext` when a new-conversation/message push lands.

---

### 2. Onboarding & Verification Status (`/broker/onboarding`)

A BROKER-role session with **no Broker row** is routed here and **blocked from the rest of the app** until the profile is created. This is a native stepped wizard (the web is one long scroll) creating a `PENDING` broker via `POST /api/brokers/profile`.

**Suggested steps** (all fields from `lib/validate.ts` + `PROVINCES`):

| Step | Fields | Validation |
|---|---|---|
| 1 · Brokerage | `brokerageName*` (≤200), `province*` (13-item picker), `licenseNumber` (opt, `/^[A-Z0-9-]{1,50}$/i`) | brokerage + province required |
| 2 · Contact & category | `phone*` (`+1` prefix, live-format `(###) ###-####`, sent as E.164), `mortgageCategory` (RESIDENTIAL/COMMERCIAL/BOTH, default BOTH) | phone required |
| 3 · About | `bio` (≤2000), `yearsExperience` (0–50), `areasServed` (≤1000), `specialties` (≤1000) | none |
| 4 · Photo (optional) | native image picker + crop → JPEG (see §6) | deferred, **non-fatal** |

On submit: `POST /api/brokers/profile` (201) → deferred `uploadBrokerAvatar` (failure is non-fatal, routes to profile with a retry toast) → `refreshBrokerData()` → land on Dashboard. New row defaults: `verificationStatus=PENDING`, `subscriptionTier=FREE`, `responseCredits=0`.

**Verification is the recurring gate.** Everywhere the broker tries to act while `PENDING`, they hit a **first-class native `VerificationPendingCard`** (not an inline banner):

- **Requests feed** returns **403** for unverified brokers — render the pending card with a "Back to dashboard" link, not an error state.
- **Request detail / respond** and **message send** are blocked server-side (`checkBrokerCanMessage → BROKER_NOT_VERIFIED`).
- **REJECTED** shows a distinct **danger** card with the reason and hides avatar controls (avatar upload-url endpoint 403s REJECTED brokers).

Verification is an out-of-band admin action; the mobile app should surface the flip via push ("You're verified — start browsing requests") once admin push is wired.

---

### 3. Browse Requests (`/broker/requests`)

The marketplace feed of **`status === OPEN`** borrower requests. This is where the embargo and credit gates are most visible. Reuse the web's mobile card stack (`RequestCardMobile`) natively; convert "Load more" to infinite scroll and the sticky chip FilterBar to a native filter sheet.

- **Data:** `GET /api/requests?province&mortgageCategory&page` → `{ data, pagination, newCount }`. Server applies `nonPremiumVisibilityWhere` so **non-PREMIUM brokers never even receive in-embargo exclusive requests** — the embargo is enforced at the query, not hidden client-side.
- **Filters:** province picker, category picker, "Only unresponded" toggle (default ON, filters `hasMyConversation`).
- **Header eyebrow:** `★ {exclusiveCount}` (PREMIUM only) + `● {newCount}` new markers.
- **Row markers:** amber `●` "new" dot when no `BrokerRequestSeen` row (`isNew`); a **"Premium" exclusive badge** (amber) — only ever set for PREMIUM brokers on in-window requests.
- **Mark-seen:** on leaving the feed, best-effort `POST /api/brokers/mark-requests-seen` (scoped to visible requests, so a non-PREMIUM broker can't silently clear dots on requests they can't see); opening a detail fires `POST /api/brokers/requests/{id}/mark-seen`.

**Gating communicated on this screen:**

| Broker state | Feed behavior |
|---|---|
| Unverified | 403 → `VerificationPendingCard` (no feed) |
| FREE | Feed visible, but respond is blocked downstream → design a persistent "Upgrade to respond" hint |
| BASIC/PRO with 0 credits | Feed visible; "0 credits" reality surfaces at respond time |
| Non-PREMIUM, in-window requests exist | Those requests are simply absent (server filter) |
| PREMIUM | Sees exclusives first with ★ badge + perk |

**States:** loading (`RequestsSkeleton`); 403 pending card; `LOAD_FAILED` alert with retry; empty ("no matching requests" + toggle-to-include-responded CTA); populated.

---

### 4. Request Detail + Respond (`/broker/requests/[id]`)

Full borrower request (`RequestDetailBlocks` for residential/commercial: products, province/city, income/financials, timeline, notes) with the **credit-spend CTA**. This is the single money-adjacent action in the broker app — opening a conversation. Because for BASIC/PRO it spends a **real** response credit, a single tap must never spend one.

**The respond CTA is state-driven:**

| Precondition | CTA card | Behavior |
|---|---|---|
| Already responded (`hasResponded`) | green "already messaging" | → Messages thread |
| Unverified | `VerificationPendingCard` | blocked |
| FREE tier | warm **upgrade card** (`UPGRADE_REQUIRED`) | "Manage plan on mortly.ca" ↗ |
| BASIC/PRO, credits === 0 | warning **no-credits card** (`NO_CREDITS`) | "Manage plan on mortly.ca" ↗ |
| `PAST_DUE`/lapsed | danger card (`SUBSCRIPTION_PAST_DUE`) | "Manage on mortly.ca" ↗ |
| Non-PREMIUM, in-window | shouldn't appear (feed-filtered); if deep-linked, `PREMIUM_EXCLUSIVE` 403 card | "Manage on mortly.ca" ↗ |
| BASIC/PRO, has credits | **inline confirm** "Use 1 credit · {remaining} remaining" | native confirm sheet → spend |
| PREMIUM (ACTIVE) | "PREMIUM · unlimited responses" | one-tap, no confirm, no decrement |

**Respond flow:** confirm → `POST /api/conversations { requestId: publicId, message? }` → server runs the Serializable transaction (idempotent on `requestId_brokerId`; atomic `responseCredits > 0` decrement for non-PREMIUM; re-checks verification, entitlement, `REQUEST_NOT_OPEN`, block, and embargo at the chokepoint) → on success `refreshBrokerData()` → push into `/broker/messages?id={conversation.id}`.

**Critical design note:** the page-local "unlimited" here is `tier === PREMIUM` **without** a status re-check — a PAST_DUE PREMIUM could optimistically render "unlimited," but the **server 403 (`SUBSCRIPTION_PAST_DUE`) is authoritative** and must be caught and rendered as the danger hand-off card. Never treat client-side entitlement as truth for the spend.

The header carries the `#publicId` (mono), relative posted time, and a `ReportButton` (targetType `REQUEST`). Errors with codes `UPGRADE_REQUIRED` / `NO_CREDITS` / `SUBSCRIPTION_PAST_DUE` / `PREMIUM_EXCLUSIVE` render as **warm upgrade cards with the web hand-off**, not raw red alerts.

---

### 5. Messages — List + Chat Detail (`/broker/messages`)

The web 3-pane (list | thread | request-context) collapses to native **stack navigation**: list screen → chat screen → request-context as a bottom sheet.

**Conversation list:**
- `GET /api/conversations`; rows show borrower/request title (`getRequestTitle`), unread badge (9+ cap), CLOSED badge. Block-hidden threads never appear. Empty: `noConversationsDescBroker`.

**Chat detail:**
- Loads `GET /api/conversations/[id]` (participant-gated). Date-grouped bubbles; `isSystem` messages render as **centered notices**, never participant bubbles. Tokens: my bubble `forest-800`/`cream-100`, other bubble white/`cream-300`, system `cream-200`/`sage-500`.
- **Realtime:** subscribe to `chat-{conversationId}`, receive content-free `sync` nudge → refetch through the authenticated API (RLS stays deny-all — never read chat via the anon key). 5s poll fallback; subscribe on foreground / unsubscribe on background via `AppState`.
- **Send:** `POST /api/messages` (optimistic append, dedupe by message id). Gated server-side by `checkBrokerCanMessage` — **replies are free** for a broker in good standing (no credit). Body 1–5000 chars, can't start `[admin]`/`[system]`, 30/min. Spam guard: while `borrowerMsgCount === 0`, broker limited to `broker_initial_message_limit` (default 3) → 429; surface as a soft "waiting for the borrower to reply" state.
- **Entitlement loss mid-thread:** a broker who becomes FREE/PAST_DUE/de-verified **keeps thread access** but send returns 403 — replace the composer with an inline entitlement notice + "Manage on mortly.ca" ↗ (and the API strips rich borrower financials from the payload for a de-verified broker).
- **No close button:** brokers cannot close conversations (borrower/admin only) — CLOSED threads render read-only (`conversationClosed`).
- **Composer:** pinned with safe-area inset; guard Korean IME Enter (`isComposing`) so it doesn't submit mid-composition.
- **Request context sheet:** reuse `RequestContextPanel` as an 85dvh native bottom sheet showing the borrower's submission.

Push deep-links (`{ type:'conversation'|'message', conversationId }`) open the exact thread.

---

### 6. Profile Edit + Avatar (`/broker/profile`)

The broker's **editable** account screen (there is no public broker-profile route — borrowers only see brokers via `BrokerResponses` after a conversation starts, so no public screen is needed on mobile). Reached from the More sheet.

- **Fields:** same set as onboarding (`brokerageName`, `province`, `licenseNumber`, `phone`, `mortgageCategory`, `bio`, `yearsExperience`, `areasServed`, `specialties`); `email` read-only; `publicId` shown as support "User ID". Save via `PUT /api/brokers/profile`. `profilePhoto` is **not** writable here.
- **Verification pill:** PENDING (amber) / VERIFIED (forest) / REJECTED (red).
- **Avatar (JPEG upload/crop):** native image picker with **camera + library** sources → crop to square → resize to **512×512 JPEG** → `POST /api/brokers/avatar/upload-url` (signed URL) → `uploadToSignedUrl` direct to Supabase Storage at server-derived path `brokers/<userId>.jpg` → confirm `POST /api/brokers/avatar` (server verifies `image/jpeg`, ≤1MB, else deletes). Cache-bust the rendered URL with `?v=Date.now()` and `refreshBrokerData()` so the tab/list avatar updates immediately. Remove via `DELETE /api/brokers/avatar`.
  - **Gating:** avatar controls are **hidden for REJECTED** brokers ("Profile photo isn't available for this account"); PENDING is allowed. Avatar is only shown to borrowers once VERIFIED.
- **No in-app password change** for brokers (web parity) — a Security row links out to `/forgot-password`.
- **Danger Zone:** `DeleteAccountSection` — native two-step confirm; credentials accounts retype current password, OAuth-only send `ack:"DELETE_MY_ACCOUNT"`; send `x-mortly-mobile: 1`.

---

### 7. Plan & Credits — READ-ONLY (`/broker/billing`, reimagined)

This is the compliance-critical screen. **No in-app purchase, upgrade, downgrade, payment method, or resume** — the app displays entitlement bought elsewhere and hands off to the web for all changes. Design it as a **multiplatform-SaaS status screen**.

**What it shows (all read-only):**

| Block | Source | Notes |
|---|---|---|
| Current tier | `profile.subscriptionTier` | Badge; PREMIUM→accent, PRO→info, BASIC/FREE→neutral |
| Credits | `profile.responseCredits` | "Unlimited" **only** if PREMIUM & status ACTIVE; else raw number; red when 0 |
| Usage / renewal | `subscription.currentPeriodEnd`, `cancelAtPeriodEnd`, `pendingTier` | "Renews {date}", "Cancelling on {date}", "Downgrading to {tier} on {date}" |
| Status banner | `subscription.status` | `PAST_DUE` → high-priority danger banner |
| Monthly grant reference | `GET /api/tier-credits` | e.g. BASIC 5 / PRO 20 / PREMIUM unlimited |
| Premium perk row | `GET /api/premium-early-access` | Only when `enabled`, with live `{{hours}}h` window |

**Hand-off (the only actionable element):**

- A single **"Manage on mortly.ca" ↗** button that opens the **external system browser** (`Linking.openURL` / not an in-app payment WebView) to the broker billing page. This applies to every plan action: upgrade, downgrade, resume a cancelling sub, update a failed payment method, view invoices.
- **`PAST_DUE`** gets the most prominent treatment: danger banner + "Update payment on mortly.ca" ↗, complemented by a push when the `invoice.payment_failed` webhook fires.
- **No pricing, no plan-comparison cards, no Stripe Checkout/Portal WebView, no "Choose plan" CTAs** in-app — this is the deliberate conservative read of App Store **anti-steering** rules (which shifted 2024–2025). Ship **read-only status + external manage hand-off**; flag the exact link-out copy for review at submission time.
- **Invoices:** either omit from mobile or render as read-only rows opening PDFs in a native viewer; any "manage" tap routes to web.

**How gating maps to this screen:** every entitlement wall elsewhere in the app (FREE can't message, 0 credits, PAST_DUE, PREMIUM embargo) ends with the same call to action — **"Manage on mortly.ca"** — funneling the broker to this screen's hand-off rather than any in-app purchase. That single, consistent external hand-off is what keeps Mortly out of the 15–30% commission while still honoring entitlements.

**Refresh:** because there is no in-app purchase to poll against, replace the web's 15s post-checkout polling with **pull-to-refresh + refresh-on-foreground** (the broker returns from the external browser after paying); the Stripe webhook is the source of truth and `BrokerDataContext` picks up the new tier/credits on the next foreground refresh (or via a plan-change push once wired).

---

### Cross-screen gating summary

| Gate | Server signal | Where surfaced | In-app resolution |
|---|---|---|---|
| Verification | `verificationStatus` | Dashboard banner, Requests 403, Respond, Send | Wait (PENDING) / contact (REJECTED) — no self-serve |
| Tier / credits | `UPGRADE_REQUIRED`, `NO_CREDITS` | Respond CTA, Dashboard, Send | **Manage on mortly.ca** ↗ |
| Subscription status | `SUBSCRIPTION_PAST_DUE` | Dashboard danger banner, Respond, Send, Plan screen | **Manage on mortly.ca** ↗ (+ push) |
| PREMIUM embargo | `PREMIUM_EXCLUSIVE`, feed filter | Requests (absent), Respond (if deep-linked) | Wait for release / **Manage on mortly.ca** ↗ |

All four gates are enforced server-side, so the mobile app inherits them for free — the UX work is purely **communicating the wall clearly and routing every paid resolution to the external web hand-off**.

---

## 2D. Screens — Admin App

The admin experience is a single role-scoped stack inside the one Mortly app, entered when `session.user.role === "ADMIN"`. It is deliberately narrow and moderation-first: the phone is a triage tool, not a replacement for the desktop console. The design goal is **thumb-fast decisions on the go** — approve a broker, resolve a report, suspend an abuser, flip maintenance mode — with hard confirmations on anything irreversible, and (net-new vs. web) **push notifications so admins stop having to poll `/api/admin/queue`**.

All screens reuse the existing `withAdmin()`-gated JSON endpoints under `pages/api/admin/*` verbatim (sending `x-mortly-mobile: 1` for the CSRF bypass). Every mutation still writes an `AdminAction` audit row server-side, and the shared badge model (`pendingVerifications`, `pendingRequests`, `openReports`, derived `inbox`) still drives tab badges — but the mobile app replaces the web's 60s polling loop with **app-foreground refresh + push-triggered invalidate**.

### Admin navigation model (native)

| | |
|---|---|
| **Primary tabs** | `Inbox` · `People` · `Reports` · `Activity` (mirrors the web MobileTabBar 4-primary split) |
| **"More" sheet** | `Geography` · `System` · `Search` (Cmd+K replacement) · Sign out |
| **Urgent badges** | `Inbox` and `Reports` show the red `error-600` (#dc2626) badge; capped at `99+`. Other tabs use neutral badges. |
| **Auth gate** | A shared native session guard; a `null` `/api/auth/session` (tokenVersion revoked / status ≠ ACTIVE) routes to `/login`. Admins bypass the maintenance gate everywhere. |
| **No language switcher** | Admin console follows device/app locale (ko default); no in-app KO·EN toggle, consistent with the app-wide convention. |

Admins get **no notification bell and no in-app notices** (web parity — the bell is BORROWER/BROKER only). On mobile their signal channel is push (see the push policy at the end of this section) plus the tab badges.

---

### Admin Home / Moderation Inbox

The landing tab and the single most valuable mobile surface — a unified decision queue over pending requests, pending broker verifications, and open reports.

| Field | Detail |
|---|---|
| **Route / entry** | `/admin/inbox` (default admin landing); deep target of moderation push notifications |
| **Data source** | `GET /api/admin/queue` (documented STABLE, 25 items per stream; already consumed by `lib/api.ts adminGetQueue`) |
| **Purpose** | Approve/reject pending borrower requests, approve/reject broker verifications, resolve/dismiss open reports — without leaving the screen |

**Layout (native)**
- **Segmented filter** at top: `ALL / REQ (상담) / BRK (전문가) / REP (신고)`, each with a live count. Reports stream counts `OPEN + REVIEWED` (Prisma has no PENDING/REVIEWING status — keep this mapping).
- **Queue rows**, newest-first: type badge, `publicId` (mono), one-line summary, relative age, and a **red priority dot when `< 2h` old** (`isPriority`).
- **Row actions are swipe-first**: swipe-right = approve (green), swipe-left = reject/dismiss (red), tap = open the full-screen detail sheet. Large tap-target Approve/Reject buttons remain in the detail sheet for discoverability.

**Decision → API mapping**

| Stream | Approve | Reject | Endpoint |
|---|---|---|---|
| REQ | `status: OPEN` | `status: REJECTED` (+ optional reason) | `PUT /api/admin/requests/[publicId]` |
| BRK | `verificationStatus: VERIFIED` | `verificationStatus: REJECTED` | `PUT /api/admin/brokers/[id]` |
| REP | `status: RESOLVED` | `status: DISMISSED` | `PUT /api/admin/reports/[id]` |

**States**: loading skeleton · empty ("전부 정리됐어요") · error card with retry · per-row busy · **pending-undo** (row optimistically hidden with a 3s `UndoToast`).

**Business rules to preserve**
- **3-second undo grace** before the API call actually fires; only **one** pending undo at a time (a second decision is refused until the first commits/cancels). This maps perfectly to a mobile snackbar with an Undo action.
- Approving a request (`→ OPEN`) stamps `approvedAt` and clears `premiumReleasedAt`, restarting the PREMIUM early-access window; the borrower is notified (in-app AdminNotice + Expo push + bilingual email via `notifyUser`).
- If `BROKER_VERIFY_REQUIRES_TWO_ADMINS=true`, a single admin's Verify returns **HTTP 202 `PENDING_SECOND_REVIEW`** (logged as `RECOMMEND_VERIFY_BROKER`) — the sheet must show "awaiting a second admin," not "done."
- Report `targetId` may be a raw cuid that doesn't resolve to a `publicId` (deleted target) — render the raw id gracefully.

**Mobile-specific**: pull-to-refresh; foreground refresh instead of the web's timer; badges may be up to ~stale until the next refresh, so never compute a decision from a cached count — always re-read on open. Reason entry (reject/dismiss) opens a **bottom sheet** with a textarea (server-capped) and the danger-tone confirm.

---

### People / Users

Search and moderate all accounts; single or bulk suspend/ban/reactivate; entry point to User Detail and Create Admin.

| Field | Detail |
|---|---|
| **Route** | `/admin/people` (deep link `?role=BROKER` from broker-related flows) |
| **Data** | `GET /api/admin/users?page&limit=25&role&status&search` (searches name/email + `publicId`, SWR `keepPreviousData`) |

**Layout (native)** — the web's 860px min-width table does **not** port; redesign as **stacked cards**:
- Card: avatar, name, role badge (`ADMIN→dark`, `BROKER→accent`, `BORROWER→neutral`), status badge (`ACTIVE→success`, `SUSPENDED→warn`, `BANNED→danger`), and a subline — brokers show `brokerageName · tier` + credits; others show `N 요청 · N 대화`.
- **Filters**: debounced search field + role chips `ALL/BORROWER/BROKER/ADMIN` + status chips `ACTIVE/SUSPENDED/BANNED`.
- **Bulk** is desktop-oriented (multi-select) — on mobile prefer **per-row swipe actions** (Suspend / Ban / Reactivate); keep an optional "selection mode" for `POST /api/admin/users/bulk {ids,status}` when an admin needs to sweep several. Bulk skips ADMIN targets and self and returns a partial-failure summary toast.

**States**: loading · `loadFailed` error (distinct from empty) · empty ("조건에 맞는 사용자가 없습니다") · `isValidating` pulse.

**Business rules**: Suspend/Ban bumps `tokenVersion` (revokes the target's JWTs within ~5s). Cannot suspend/ban another admin or yourself (403). `PREMIUM` brokers show unlimited (`responseCredits = -1`).

**Create Admin** (`POST /api/admin/users/create`) is high blast-radius: requires typed ack `CREATE_ADMIN`, password ≥ 12 chars, is rate-limited 10/min, and emails all peer admins on success (`notifyAdminsOfNewAdmin`). **Recommend gating this behind an "Advanced" action on mobile with a typed-ack confirm** (see destructive-action pattern below), or deferring it to desktop.

---

### User Detail

Full account view and the hub for all per-user moderation + broker verification — reached from Inbox BRK rows, People cards, and Search.

| Field | Detail |
|---|---|
| **Route** | `/admin/users/[id]` (accepts cuid **or** 9-digit `publicId`) |
| **Data** | `GET /api/admin/users/[id]` |

**Layout (native)**: header (avatar with tap-to-lightbox, role + status badges) → info card → stats row (broker = credits + conversations; else requests / conversations / reports) → **Broker panel** (profile fields + Verify / Reject / Reset) → Account Actions → recent requests/conversations that deep-link into Activity.

**Actions (≤ 2 taps each)**

| Action | Endpoint | Notes |
|---|---|---|
| Suspend / Ban / Reactivate | `PUT /api/admin/users/[id] {status}` | Suspend/Ban bumps `tokenVersion`; blocked for ADMIN targets and self |
| Verify / Reject / Reset broker | `PUT /api/admin/brokers/[brokerId] {verificationStatus}` | Notifies the broker (in-app + push + email); 202 if two-admin gate |
| Adjust credits | `POST /api/admin/credits {brokerId, amount, reason}` | Non-zero int, `|amount| ≤ 10000`, can't go below 0; **`PREMIUM` rejects with `UNLIMITED_PLAN`** |
| Send notice | `POST /api/admin/notices {userId, subject, body}` | Surfaces in that user's Navbar bell |

**Edge cases**: a `BROKER`-role user may have **no Broker row** ("NO PROFILE") — guard verification/credit actions on `user.broker` existing. ADMIN targets render actions disabled with an explanatory note. Every action goes through a native `AConfirmDialog`-equivalent with danger tones for destructive ones.

**Mobile-specific**: photo lightbox and long broker profile fields need a mobile scroll layout; credit-adjust and send-notice are bottom-sheet forms.

---

### Reports — Detail & Resolution

Second-most-urgent on-the-go task: investigate and resolve abuse reports (Apple 1.2 UGC compliance).

| Field | Detail |
|---|---|
| **Route** | `/admin/reports` (list) + drawer/sheet detail; deep link `?id=<reportId>` from a report push |
| **Data** | `GET /api/admin/reports?status&targetType&limit=50`; counts from `/api/admin/reports/summary` |

**Layout (native)**
- **Filter chips**: status `OPEN / REVIEWED / RESOLVED / DISMISSED` (tones danger/warn/success/neutral) + target `BROKER / REQUEST / CONVERSATION`.
- **List rows**: `REP-XXXX` code (mono), `reporter → target`, the free-form reason inline (so the admin can often decide without opening the target), relative age.
- **Detail sheet**: reporter card, target card with an **"open target"** deep link (to the broker/request/conversation), `adminNotes` textarea (capped at `MAX_NOTES_LEN`), and resolution buttons.

**Actions** → `PUT /api/admin/reports/[id] {status?, adminNotes?}`: Mark Reviewed · Resolve · Dismiss · Save Notes. `RESOLVED`/`DISMISSED` stamp `resolvedAt`; audit actions `RESOLVE_REPORT` / `DISMISS_REPORT` / `UPDATE_REPORT`.

**States**: loading · empty · saving · deep-link opens the report directly.

**Mobile-specific**: notes + resolution live in a keyboard-aware bottom sheet; because a report often targets a conversation, tapping "open target" should push the **read-only admin conversation viewer** (below) and return cleanly.

**Admin conversation inspection** (`/admin/conversations/[id]`, `GET/PUT /api/admin/conversations/[id]`): read-only transcript ("관리자는 읽기 전용"), cursor-paginated 50/page. Admin close (`PUT {status: CLOSED, reason}`) posts a system message + writes the audit row in one transaction. The transcript viewer fits phones well; reason entry is a bottom sheet.

---

### Activity / Audit Feed

Interleaved requests + conversations feed for read-only inspection plus request approve/reject and conversation close — the lower-urgency "review history and context" surface.

| Field | Detail |
|---|---|
| **Route** | `/admin/activity` (deep links `?req=<publicId>`, `?id=<convId>`) |
| **Data** | `/api/admin/trends`, `/api/admin/stats`, request/conversation streams (25 each, "Load more") |

**Layout (native)**: type chips `ALL / REQ / CONV` + status chips → feed rows → detail sheets (Request sheet with borrower + conversations + approve/reject on `PENDING_APPROVAL`; Conversation sheet = read-only messages + admin-close).

**Actions**: approve request (`PUT /api/admin/requests/[id] {status: OPEN}`), reject (`{status: REJECTED}` + reason), admin-close conversation (`{status: CLOSED, reason}`).

**Mobile-specific**: only one sheet open at a time; "Load more" → infinite scroll; reason dialogs → bottom sheets. This tab doubles as the **audit trail reader** — a clean, scannable feed of `AdminAction` rows (time, admin, action, target, reason). The full audit log also lives under System → Audit.

---

### Geography Analytics

Cookieless visitor/session analytics — the hardest surface to put on a phone, so **list-first with an opt-in compact map**.

| Field | Detail |
|---|---|
| **Route** | `/admin/geography` (in the "More" sheet, not a primary tab) |
| **Data** | `GET /api/admin/geography?days=1|7|30|90` (aggregates `GeoVisit`) |

**Mobile layout — default to data, not maps**
1. **Range chips** `1 / 7 / 30 / 90` days.
2. **KPI cards**: sessions (+ sparkline), countries, cities, mobile % (`mobile / total`).
3. **Ranked bar lists** (`RankBlock`): countries, continents, cities, provinces, devices, referrers, roles — these are the mobile-first source of truth and render even if a map fails.
4. **Map is opt-in** via a `List / Map` toggle and a `World / Canada` scope switch. The d3-geo maps (`ssr:false`, `usePanZoom`, touch-pan + pinch) can be shown as a **compact bubble map** (World: gold `#c49a3a` @0.55 session bubbles; Canada: province choropleth + city bubbles). On small screens, consider **omitting the interactive map entirely** and leading with KPIs + bars.

**States**: loading · error ("불러올 수 없습니다") · empty (`AEmpty`, total 0) · map loading/failed fallback (rankings still shown).

**Mobile-specific**: no push relevance; this is a "check when curious" screen. Keep tooltips clamped near edges if the map is shown.

---

### System Settings

Working platform toggles + audit + trends. Lowest on-the-go priority (in "More"), but the **toggles** are genuinely useful from a phone.

| Field | Detail |
|---|---|
| **Route** | `/admin/system` |
| **Data** | `GET /api/admin/settings`; save via `PUT /api/admin/settings` (changed keys only) |

**Working settings (defaults) and mobile treatment**

| Key | Default | Mobile |
|---|---|---|
| `maintenance_mode` | `false` | **Toggle** — high blast-radius; requires an extra confirm |
| `premium_early_access_enabled` | `false` (dark-launched) | **Toggle** — enabling releases the current OPEN backlog |
| `premium_window_hours` | `12` | Number (advanced) |
| `free/basic/pro_tier_credits` | `0 / 5 / 20` | Number inputs (advanced sheet) |
| `max_requests_per_user` | `5` | Number (advanced) |
| `request_expiry_days` | `30` | Number (advanced) |

**Recommendation**: surface only the two impactful toggles (`maintenance_mode`, `premium_early_access_enabled`) prominently on mobile; keep numeric tier/credit config in an "Advanced" sheet or desktop-only. Save writes `UPDATE_SETTINGS` audit + bumps the KV `settings:version` cache. `getSettingInt` throws on non-integer input (loud fail) — surface that as an inline field error. `premium_valve_hours` must stay `< premium_window_hours`.

**Tabs**: Settings (dirty-field save) · Audit (`GET /api/admin/actions?limit=25`, readable mobile feed) · Trends (`GET /api/admin/trends` sparklines) · Manual (placeholder — omit on mobile).

**Mobile-specific**: `maintenance_mode` is platform-wide — a fat-finger blocks every non-admin, so it needs a confirm with a clear "this blocks all users" warning.

---

### Search (Cmd+K replacement)

The web's keyboard-driven `CommandPalette` has no mobile analog — replace with a **visible Search entry** in the "More" sheet (and optionally a header icon).

- Full-screen search over `GET /api/admin/users?search=&limit=5` (debounced 150ms, `AbortController`).
- Results → tap opens User Detail; **quick actions** (suspend/ban/reactivate/credits/notice) surface as a per-user **action sheet** that routes into User Detail rather than mutating in place (matching web semantics).

---

### Destructive / irreversible action confirmation pattern

A single consistent guard for anything that revokes access, moves money-adjacent state, or is platform-wide:

| Action | Guard |
|---|---|
| Suspend / Ban user | Danger-tone confirm sheet; reason optional; warns "signs the user out of all sessions" (`tokenVersion` bump) |
| Reject request / broker, Dismiss report, Close conversation | Confirm sheet with **reason textarea** (server-validated length) |
| Adjust credits | Confirm with amount + resulting balance; blocked outright for `PREMIUM` (`UNLIMITED_PLAN`) |
| Create Admin | **Typed-ack** ("CREATE_ADMIN") required; consider deferring to desktop |
| `maintenance_mode` ON | Explicit "this blocks all non-admin users" confirm |

Optimistic UI is allowed **only** where the web already does it (Inbox's 3s undo grace); everything else confirms first, then mutates, then `invalidate()`s the badge model.

---

### Push notification policy (net-new for admins)

Today admins receive **zero** real-time signal — no push, no in-app notice — and must poll the console. The single highest-value mobile improvement is targeting Expo push (`lib/push.ts sendPushToUsers`) at `ADMIN` users. Recommended policy:

| Event | Push? | Deep link | Priority |
|---|---|---|---|
| New broker awaiting verification | **Yes** | `/admin/inbox` (BRK filter) → detail | Normal |
| New report filed | **Yes** | `/admin/reports?id=<id>` | **Urgent** (reports are red-badge) |
| New request pending approval | Yes (batchable/digest) | `/admin/inbox` (REQ filter) | Normal |
| Priority item (`< 2h` old and still unactioned) | Optional escalation | Inbox | Urgent |
| Second-admin review needed (`PENDING_SECOND_REVIEW`) | Yes → the *other* admins | User Detail broker panel | Normal |

Notes:
- **Privacy**: keep bodies generic and structured (`type + targetId` in the data payload), deep-linking into the auth-gated screen — never leak reporter/target identities or borrower financials in the OS notification.
- Register the admin's device on login via `POST /api/notifications/register-device` (`platform IOS/ANDROID`), honoring the existing token-hijack `409` guard and `pushEnabled`/`mutedUntil`.
- Drive the **OS app-icon badge** from the derived `inbox` count (`pendingVerifications + pendingRequests + openReports`).
- Because push can outpace the badge poll, tapping a notification should **`invalidate()` and re-fetch** the relevant queue before rendering, so the admin never acts on a stale count.

**Open items to confirm before build**: whether destructive actions (`ban`, `maintenance_mode`, `create-admin`) are permitted on mobile at all or desktop-only; whether the deployment runs with the two-admin verification gate on (changes Verify UX from "done" to "recommended"); and the exact digest-vs-immediate policy for the high-volume request-pending stream.

---

## 3. Mobile Design System Spec

This section defines the native design system for the Mortly RN + Expo + NativeWind app. It is a faithful port of the web "Midnight & Gold" language (source of truth: `tailwind.config.ts`) with the deltas that native platforms require (bundled fonts, native shadows, gesture-driven sheets, safe-area insets, OS reduce-motion). The rule of the system stays intact: **sharp corners (`rounded-sm`), 1px cream borders, cream surfaces, forest ink, a single amber accent, and IBM Plex Mono for meta/labels.**

The mobile `tailwind.config.ts` for the RN app must re-declare these scales verbatim so NativeWind classes (`bg-forest-800`, `text-amber-600`, etc.) resolve identically to web. Do **not** rely on Tailwind defaults — `amber` and `sage` intentionally override built-in palettes.

---

### 3.1 Color palette (exact hexes + semantic roles)

Port every family below into `theme.extend.colors`. Semantic families (`success/error/warning/info`) ship **only** shades `50/100/500/600/700` — using e.g. `success-300` silently fails, exactly as on web.

#### Core families

| Family | Key shades (hex) | Full range |
|---|---|---|
| **forest** (midnight-navy ink / dark surfaces) | 500 `#3d4f82` · 700 `#1f2d52` · **800 `#0f1729`** · 900 `#080c18` | 50 `#f0f2f7`,100 `#dde1ed`,200 `#b8c0d9`,300 `#8a96be`,400 `#5d6da3`,500 `#3d4f82`,600 `#2e3d68`,700 `#1f2d52`,800 `#0f1729`,900 `#080c18` |
| **cream** (surfaces / borders) | 50 `#fefefe` · **100 `#f8f7f4`** · 200 `#f0eeea` · 300 `#e5e2dc` | 50 `#fefefe`,100 `#f8f7f4`,200 `#f0eeea`,300 `#e5e2dc`,400 `#d5d0c7`,500 `#c0b9ad` |
| **amber** (gold accent — overrides TW amber) | 50 `#fdf9ef` · 400 `#d4a853` · **500 `#c49a3a`** · 600 `#a8812e` · 700 `#8a6825` | 50 `#fdf9ef`,100 `#f9f0d5`,200 `#f2dfa8`,300 `#e6c96e`,400 `#d4a853`,500 `#c49a3a`,600 `#a8812e`,700 `#8a6825`,800 `#6f531f`,900 `#5a441a` |
| **sage** (muted slate text — overrides TW) | 400 `#7681a1` · **500 `#576285`** · 600 `#454e6b` | 50 `#f2f4f7`,100 `#e2e5ed`,200 `#c5cad9`,300 `#9ea6bd`,400 `#7681a1`,500 `#576285`,600 `#454e6b`,700 `#383f57`,800 `#2e3447`,900 `#262b3b` |

#### Semantic families (50/100/500/600/700 only)

| Family | 50 | 100 | 500 | 600 | 700 |
|---|---|---|---|---|---|
| **success** | `#f0fdf4` | `#dcfce7` | `#22c55e` | `#16a34a` | `#15803d` |
| **error** | `#fef2f2` | `#fee2e2` | `#ef4444` | `#dc2626` | `#b91c1c` |
| **warning** | `#fffbeb` | `#fef3c7` | `#f59e0b` | `#d97706` | `#b45309` |
| **info** | `#eff6ff` | `#dbeafe` | `#3b82f6` | `#2563eb` | `#1d4ed8` |

#### Semantic role map (what to reach for)

| Role | Token | Notes |
|---|---|---|
| Screen background | `cream-100` `#f8f7f4` | App-wide body bg. |
| Card / sheet / tab-bar surface | `cream-50` `#fefefe` | Elevated surfaces. |
| Hover/pressed neutral fill | `cream-200` `#f0eeea` | Native pressed state on light rows. |
| Hairline border | `cream-300` `#e5e2dc` | 1px `border` everywhere. |
| Primary ink | `forest-800` `#0f1729` | Titles, body, dark surfaces, status bar. |
| Secondary ink | `forest-700` `#1f2d52` | Sub-headings. |
| Muted/inactive text | `sage-500` `#576285` | Captions, inactive tabs. |
| Glyph / placeholder | `sage-400` `#7681a1` | Icons, input placeholders. |
| Primary accent / CTA / active | `amber-500` `#c49a3a` | Buttons, active-tab underline, badges. |
| Accent hover / eyebrow text | `amber-600` `#a8812e` | Pressed CTA, `eyebrow` labels. |
| Eyebrow on dark surface | `amber-400` `#d4a853` | Verified check, dark-card eyebrow. |
| Urgent / destructive | `error-600` `#dc2626` | Admin inbox/reports badges, destructive btn. |
| Admin dark rail (if surfaced) | `forest-800` bg / `forest-700` `#1f2d52` hover | Admin-only chrome. |

#### Chat-specific colors (load-bearing, from messaging facet)

| Element | Spec |
|---|---|
| My/sent bubble | `bg-forest-800` text `cream-100` |
| Other/received bubble | `bg-cream-50` border `cream-300` text `forest-800` |
| System/notice bubble | `bg-cream-200` text `sage-500`, centered |
| Unread badge | `bg-error-500` white, caps `9+`, ≥16px circle |
| Active thread accent | `border-l-amber-500` |
| Unread row tint | `bg-amber-50/40` |

#### Status → tone mapping (reuse `tones.ts` verbatim)

Port `components/admin/primitives/tones.ts` as a framework-agnostic switch. `Tone` = `neutral | accent | success | danger | info | warn | dark`. Native badge classes:

| Tone | Classes |
|---|---|
| neutral | `bg-cream-200 text-forest-700 border-cream-300` |
| accent | `bg-amber-50 text-amber-700 border-amber-200` |
| success | `bg-success-50 text-success-700 border-success-100` |
| danger | `bg-error-50 text-error-700 border-error-100` |
| info | `bg-info-50 text-info-700 border-info-100` |
| warn | `bg-warning-50 text-warning-700 border-warning-100` |
| dark | `bg-forest-800 text-cream-100 border-forest-800` |

Domain mappings to reuse: request `OPEN→accent`, `IN_PROGRESS/PENDING_APPROVAL→warn`, `REJECTED→danger`, `EXPIRED/CLOSED→neutral`; verification `VERIFIED→success`, `PENDING→warn`, `REJECTED→danger`; tier `PREMIUM→accent`, `PRO→info`, `BASIC/FREE→neutral`; report `OPEN→danger`, `REVIEWED→warn`, `RESOLVED→success`, `DISMISSED→neutral`; user status `ACTIVE→success`, `SUSPENDED→warn`, `BANNED→danger`. **Canonical decision:** adopt the **admin `tones.ts`** mapping app-wide (resolves the web `StatusBadge` vs `tones.ts` disagreement on `OPEN`/`IN_PROGRESS`) so borrower, broker, and admin surfaces render identical badges.

#### Dark mode strategy

**Do not ship dark mode at v1.** Rationale: `forest` is an *ink* scale, not a dark-theme surface set; there is no dark-surface/ink-inversion token set on web, and `theme`-pref plumbing exists in `/api/preferences` but is unwired. Decisions:

- Force **light** UI regardless of OS setting; set `userInterfaceStyle: "light"` in `app.json` (Expo) so the OS doesn't auto-invert.
- Status bar: `dark` content (dark glyphs) on the cream app background; **light** content on `forest-800` headers/chat/admin rail.
- **Fix the brand-color drift on native:** web's PWA `theme-color` `#1B3A2D` (legacy green) does not match `forest-800 #0f1729`. Use `forest-800` for the splash/status-bar/nav-container theme color — do not carry the green over.
- Reserve a future dark theme as a semantic-alias layer (`surface`, `ink`, `muted`, `line`) so screens don't hardcode raw hexes; that indirection is the only forward-compatibility we build now.

---

### 3.2 Typography

Web loads Outfit + Pretendard via CDN `<link>` and forces Pretendard on Korean via `html[lang=ko] * !important`. Native cannot do either — **bundle fonts as local assets** and select face in JS by locale.

#### Font faces

| Role | Latin (en) | Korean (ko, default) | Fallback |
|---|---|---|---|
| display / body | **Outfit** (300/400/500/600/700) | **Pretendard** (or `Noto Sans KR`) | `system-ui` / SF Pro / system Korean |
| mono (labels, IDs, badges, timestamps) | **IBM Plex Mono** | IBM Plex Mono (kept mono in **both** locales) | `ui-monospace`, SFMono |

Implementation: load with `expo-font`/`useFonts`; expose `useAppFont()` that returns the Outfit weight for `en` and the Pretendard weight for `ko`. **Korean forces `font-weight: 600` on display/headings** (mirror web's override). Mono labels stay IBM Plex Mono in both locales — never swap them to Pretendard. Confirm Outfit + Pretendard redistribution licensing before store submission; if blocked, fall back to system faces (SF Pro / system Korean) for display/body only.

#### Type ramp (native, sp/pt)

Web has no fluid clamp on native; use fixed steps. Sizes are pt (RN uses density-independent points).

| Token | Size / Line | Weight | Family | Usage |
|---|---|---|---|---|
| `display-xl` | 30 / 36 | 600 | display | Onboarding/marketing hero (rare in-app) |
| `heading-lg` | 24 / 30 | 600 | display | Screen title in native header |
| `heading-md` | 20 / 26 | 600 | display | Section title, card group header |
| `heading-sm` | 17 / 24 | 600 | display | Card title, list section |
| `body` | 15 / 22 | 400 | body | Default paragraph / message text |
| `body-strong` | 15 / 22 | 600 | body | Emphasis, sender name |
| `body-sm` | 13 / 18 | 400 | body | Secondary detail, helper text |
| `button` | 15 / 20 | 600 | body | Button label (see 3.7) |
| `caption` | 12 / 16 | 400 | body | Timestamps prose, meta |
| `eyebrow` | 11 / 14 | 600 | **mono** | UPPERCASE, `tracking ~0.12–0.15em`, `text-amber-600` (`amber-400` on dark) |
| `mono-label` | 10–11 / 14 | 600 | **mono** | Input labels, tab labels, `#publicId`, credits chip |
| `badge` | 10 / 12 | 600 | **mono** | UPPERCASE, `tracking 0.1em` |

Notes: web body is 13px but reads correctly on desktop; **bump default body to 15pt** on mobile for touch legibility (iOS/Android minimum comfortable reading size). Inputs use ≥16pt text to avoid iOS zoom-on-focus. Letter spacing tokens: `tightest -0.04em`, `tightest2 -0.05em` on large display headings only. Respect the OS "larger text"/Dynamic Type up to a capped multiplier (~1.3) using `allowFontScaling` with `maxFontSizeMultiplier` so headers don't break tab bars.

---

### 3.3 Spacing scale

Keep the default Tailwind spacing scale (web adds no custom spacing). Practical native rhythm:

| Token | pt | Usage |
|---|---|---|
| `1` | 4 | Icon-to-label gap, badge inset |
| `2` | 8 | Tight stack, chip padding-y |
| `3` | 12 | Compact row gap |
| `4` | 16 | **Default screen horizontal padding**, card content pad-x |
| `5` | 20 | Section gap |
| `6` | 24 | **Card default padding** (matches web `ACard` 24px) |
| `8` | 32 | Between major sections |
| `10`/`12` | 40/48 | Empty-state vertical breathing |

Global rules: screen gutters `px-4`; cards `p-6`; list rows min-height 44pt with `py-3`. Always append safe-area insets rather than fixed values: `pt-[safe]` on headers, `pb-[safe]` on tab bars, sheets, and pinned composers (`pb-[env(safe-area-inset-bottom)]` equivalent via `react-native-safe-area-context`).

---

### 3.4 Radius (sharp)

Sharp-corner system carries over. There is no radius extension in config; enforce by convention.

| Token | RN value | Applies to |
|---|---|---|
| `rounded-sm` (**default**) | 2 | Cards, buttons, inputs, sheets, modals, badges, chips, banners, toasts, images |
| `rounded-full` (**exception**) | 9999 | Avatars, count pills, radio dots, verification/status **pills**, stepper circles |

`rounded-md/lg/xl/2xl` are **legacy drift — do not use.** One nuance: status/verification pills use `rounded-full` (an intentional exception alongside avatars and count pills), while the `MobileTabBar` badge stays `rounded-sm`.

---

### 3.5 Elevation / shadows

Web shadows use `rgba(15,23,41,·)` (forest ink). Map to platform-correct props; RN needs both iOS `shadow*` and Android `elevation`. Prefer **borders over shadows** — the system is deliberately flat.

| Token | iOS (`shadowColor #0f1729`) | Android `elevation` | Usage |
|---|---|---|---|
| `card` | opacity 0.06, radius 3, offset (0,1) | 1 | Default card (usually border-only is enough) |
| `card-hover`/pressed-raise | opacity 0.08, radius 8, offset (0,4) | 3 | Active/selected card |
| `elevated` | opacity 0.10, radius 16, offset (0,8) | 8 | Modals, floating sheets, FAB |
| `amber-glow` | color `#c49a3a`, opacity 0.25, radius 14, offset (0,4) | 6 | Primary CTA emphasis (use sparingly) |

Bottom sheets and modals get `elevated` **plus** a scrim (see 3.10). Most list cards should ship border-only (`border border-cream-300`) with no shadow to match the flat editorial feel.

---

### 3.6 Cards

- Base: `bg-cream-50 border border-cream-300 rounded-sm p-6`.
- Interactive (tappable): wrap in `Pressable`; pressed state → `border-amber-500` + `active:opacity-90` (or `active:scale-[0.99]`). No focus ring (touch, not keyboard).
- Selected: `border-amber-500` (2px) — the native equivalent of web `ring-2 ring-amber-500`.
- Hero/dark card (e.g. PREMIUM early-access perk, dashboard highlight): `bg-forest-800 text-cream-100 p-8 rounded-sm`; eyebrow uses `amber-400`.
- Stat cards (borrower/broker dashboards): `p-6`, mono label (`sage-500`) + large display number (`forest-800`); credits value turns `error-600` when 0, shows `t('common.unlimited')` for ACTIVE PREMIUM.

---

### 3.7 Buttons

Build one `<Btn variant size loading disabled>` primitive over `Pressable`. Base: `flex-row items-center justify-center gap-1.5 rounded-sm`, label `font-body font-semibold`, `active:scale-[0.99]` (or `active:opacity-90`), min touch target **44×44pt**.

#### Variants

| Variant | Default | Pressed | Text |
|---|---|---|---|
| **primary** (amber) | `bg-amber-500` | `bg-amber-600` | `text-white` |
| **dark** | `bg-forest-800` | `bg-forest-700` | `text-cream-100` |
| **secondary** (outline) | `border border-forest-800 bg-transparent` | `bg-forest-800` + `text-cream-100` | `text-forest-800` |
| **ghost** | `border border-cream-300 bg-transparent` | `bg-cream-200` | `text-forest-800` |
| **destructive** | `bg-error-500` | `bg-error-600` | `text-white` |
| **link** | none | `opacity-70` | `text-amber-600 underline` |

#### Sizes

| Size | Padding | Text |
|---|---|---|
| `sm` | `px-3 py-1.5` | 13pt |
| `md` (default) | `px-4 py-2.5`, min-h 44 | 15pt |
| `lg` | `px-5 py-3`, min-h 48 | 15pt |

#### States

- **Loading:** replace/prefix label with a small `ActivityIndicator` (spinner) tinted to the label color; keep width stable to avoid layout jump; disable press. Used on Save profile, Send message, plan-change confirm, verify-code submit.
- **Disabled:** `opacity-50`, no press feedback (`disabled` prop). Used for step-gated `Next` in RequestForm, submit-until-6-digits on verify-email, "Already on this plan" tier CTA.
- **Full-width** primary CTAs on forms (`w-full`); the primary destination button on a screen should be thumb-reachable near the bottom.

---

### 3.8 Inputs

All inputs: `rounded-sm border border-cream-300 bg-cream-50 px-4 py-3`, text ≥16pt (avoid iOS zoom), placeholder `sage-400`. Label above field: `mono-label` (`font-mono text-[11px] uppercase tracking-[0.12em] text-sage-500`).

| Type | Spec |
|---|---|
| **Text field** | Single-line `TextInput`. Focus → `border-amber-500` (native has no ring; use border color + subtle `bg-amber-50/20` optional). Return-key + `blurOnSubmit` per context. |
| **Error state** | `border-error-500`; helper text below `text-error-700 text-[13px]`. Used for `auth.passwordMismatch`, `auth.passwordTooShort`, commercial-financials mismatch. |
| **Multiline / composer** | Auto-grow up to ~5 lines then scroll; chat composer capped at 5000 chars (message limit); pinned above safe-area; **Korean IME guard** — do not submit while `isComposing`/mid-composition (reimplement web's `isComposing` for RN `TextInput`). |
| **Select** | No native `<select>`; use an action-sheet / bottom-sheet picker showing options as rows (e.g. Province — 13 `PROVINCES`; Timeline — `TIMELINE_OPTIONS`). Trigger looks like a text field with a chevron glyph `sage-400`. |
| **Toggle / switch** | Native `Switch`; track-on `amber-500`, thumb white, off-track `cream-300`. Used for notification prefs (email/push), "Only unresponded" broker filter. |
| **Segmented / radio group** | Row of `Pressable` cards; selected → `border-forest-600 bg-forest-50`. Used for mortgageCategory (RESIDENTIAL/COMMERCIAL/BOTH), role picker, request category. |
| **OTP / code** | 6-box numeric field; enable OS one-time-code autofill (`textContentType="oneTimeCode"` / Android autofill); box `h-12 w-12 border-2 border-cream-300 rounded-sm font-mono text-xl`, focused box `border-amber-500`; auto-advance + backspace-to-prev. |
| **Stepper (numeric)** | For yearsExperience (0–50) etc.: `[−] value [+]` with `rounded-sm` ghost buttons min 44pt, clamp at bounds. Currency inputs (annual income) use numeric keypad + `$` prefix + grouped `toLocaleString` formatting. |

Focus behavior is touch-first: no `focus-visible` rings; rely on the amber border + the keyboard appearing. Wrap forms in `KeyboardAvoidingView` and keep the active field visible.

---

### 3.9 Nav bars / headers & bottom tab bar

#### Native header (replaces web `AppTopbar`)

- Layout: `bg-cream-50` (or `forest-800` for chat/admin) with 1px bottom `border-cream-300`, `pt-[safe]`, height ~52pt content.
- Left: back chevron (`sage-400`, 44pt target) on pushed screens. Title: `heading-sm`/`heading-md` display, centered or leading per platform. Optional eyebrow line above title (`eyebrow`, e.g. "STEP 2/3", "상담 요청").
- Right: actions slot (e.g. `+ 새 요청`, ReportButton flag, request-context button). Max 2 icons; overflow → action sheet.
- Chat detail header is `forest-800` with `cream-100` title and a request-context button (opens sheet). **Hide the tab bar on the chat-detail screen** (native equivalent of `hideMobileTabBar`).

#### Bottom tab bar (port `MobileTabBar` contract)

Reuse the `TabBarItem` model `{ key, href, label, glyph, badge }` and the per-role `NAV_ITEMS` arrays. Use a real native tab navigator (expo-router tabs), not the web bottom-tab emulation.

- Surface `bg-cream-50`, top 1px `border-cream-300`, `pb-[safe]`, each tab **min-h 56pt**.
- Label `font-mono text-[10px] uppercase tracking-[0.06em]`; glyph ~17pt.
- Inactive: label/glyph `sage-500`. Active: label/glyph `amber-600` + a top indicator bar (`inset-x-4 h-0.5 bg-amber-500`).
- Badge: `bg-amber-500` white `font-mono`, **cap `9+`** (tab bar), `rounded-sm`. Drive from the role data context counters (borrower `activeRequests`/`unreadMessages`; broker `newRequests`/`unreadMessages`; admin `pendingVerifications`/`pendingRequests`/`openReports`/`inbox`). Admin **urgent** badges (inbox, reports) use `bg-error-600`.

Per-role primary tabs (secondary items + Sign Out in a "More" sheet):

| Role | Primary tabs | In "More" |
|---|---|---|
| **Borrower** | Dashboard · Messages · Profile | Sign out |
| **Broker** | Dashboard · Requests · Messages | Profile, Billing, Sign out |
| **Admin** | Inbox · People · Activity · Reports | Geography, System, Sign out |

---

### 3.10 Modals & bottom sheets

Reimplement web dialogs/sheets as native modals with gesture dismissal + safe-area insets (web relied on `document.body` scroll-lock + `Escape`, neither of which exists natively).

- **Scrim:** `bg-forest-900/40` (chat/sheet) or `bg-forest-800/55` (confirm dialogs). Add `backdrop-blur` only where cheap (iOS `BlurView`); Android may fall back to solid opacity.
- **Bottom sheet:** `bg-cream-50 rounded-sm` (top corners may stay sharp per system) sliding up (`slideUp` 220ms ease-out), `pb-[safe]`, drag-handle affordance, swipe-down + scrim-tap to dismiss. The **request-context panel** is a bottom sheet at ~85% height (`85dvh` equivalent) reused across borrower & broker chat (port `RequestContextPanel` behavior). The **"More"** menu and filter pickers are shorter sheets.
- **Confirm dialog** (port `AConfirmDialog`): centered card `max-w` ~340pt, `elevated` shadow; title (`heading-sm`), body, optional reason `TextInput` (`reasonMaxLength` 500), Cancel (ghost) + Confirm (variant by intent — destructive/dark). Default cancel label Korean `취소`; `requireReason: 'required'` disables Confirm until non-empty. Used for: close/delete request, sign-out, delete account, admin approve/reject with reason.
- **Delete-account flow:** two sequential native confirm dialogs → conditional password prompt for credentials accounts (mirrors the designed `DeleteAccountSection`). Keep destructive Confirm as `bg-error-500`.

---

### 3.11 Toasts / snackbars

Port `Toast` semantics: auto-dismiss 5s, `aria-live` → RN accessibility announcement, top-anchored below the header (respect `pt-[safe]`), `max-w` ~360pt, `rounded-sm`, tone-tinted.

| Type | Bg / Border / Text |
|---|---|
| success | `bg-success-50` / `border-success-500/20` / `text-success-700` |
| error | `bg-error-50` / `border-error-500/20` / `text-error-700` |
| warning | `bg-warning-50` / `border-warning-500/20` / `text-warning-700` |
| info | `bg-info-50` / `border-info-500/20` / `text-info-700` |

Special case — **Admin inbox undo toast** ("UndoToast"): a bottom-anchored snackbar with a 3-second countdown and an **Undo** action; the moderation API call fires only after the grace window (port the web optimistic-hide + 3s-undo pattern; one pending undo at a time). Use success/neutral tone with an amber action label.

---

### 3.12 Badges / pills / chips

- **Status badge** (`rounded-sm`, `px-2 py-0.5`, `font-mono text-[10px] font-semibold tracking-[0.1em] uppercase`), colored via the `tones.ts` tone map (3.1). Used for request/verification/tier/report/user statuses across all roles. Labels come from i18n `statusLabel.<STATUS>`; unknown → raw with underscores→spaces.
- **Count pill** (`rounded-full`, `bg-amber-500 text-white font-mono text-[10px]`): tab/nav counters, cap `9+`; sidebar/list contexts cap `99+`. Urgent admin counts → `bg-error-600`.
- **Filter chip** (`rounded-sm`, min-h 44pt, `border-cream-300`): selected → `bg-forest-50 border-forest-600` or amber-accented; used for broker request filters, admin queue/role/status chips, geography date ranges. Convert web sticky chip bars to a horizontal scroll row or a filter bottom-sheet.
- **Verification pill** (`rounded-full`): PENDING `bg-warning-100 text-warning-700`, VERIFIED `bg-forest-100 text-forest-800` (with `amber-400` check), REJECTED `bg-error-100 text-error-700`.
- **Tier chip** (broker header): PREMIUM `accent`, PRO `info`, BASIC/FREE `neutral`; PAST_DUE adds a small amber dot + "payment due" (tier still reads its paid value).
- **"New"/"Premium exclusive" markers** (broker feed): `amber-500` dot for new, small `accent` "Premium" badge for in-window exclusives (gate on `/api/premium-early-access.enabled`).

---

### 3.13 Avatars

- Sizes: 40pt (chat rows, response cards), 32pt (compact lists), 64–96pt (profile/detail).
- Shape: `rounded-full` (the sanctioned exception). Admin/dashboard contexts may use `rounded-sm` per the admin convention.
- Source: pass the stored object **path** (e.g. `brokers/<userId>.jpg`); build a Supabase transform URL at **2× size** for retina and `resize=cover` to keep mobile egress small (`avatarTransformUrl`). Cache-bust replaced photos with `?v=<updatedAt>`.
- Fallback: initials box (name-derived) on missing path **or** load error; reset the failed state when the URL changes so a new upload retries.
- Broker avatar is only shown to borrowers once the broker is **VERIFIED**; hide upload controls for REJECTED brokers ("photo unavailable").

---

### 3.14 Loading (skeletons & spinners)

Port the `Skeleton*` family as per-screen native blueprints: `SkeletonDashboard`, `SkeletonProfile`, `SkeletonRequestList`, `SkeletonRequestDetail`, `SkeletonBilling`, `SkeletonForm`, and chat skeletons (`ConversationListSkeleton`, `ThreadSkeleton`, `RequestContextSkeleton`).

- Skeleton block: `bg-cream-200 rounded-sm` with a subtle pulse (opacity 1↔0.5, ~1s) or shimmer; **respect OS reduce-motion** (drop animation → static blocks).
- Spinner: native `ActivityIndicator`, color `forest-800` (or `amber-500` for on-brand emphasis, `cream-100` on dark surfaces). Shell-level gate shows a centered spinner + "Loading…" while the session/role gate resolves (mirror web shells).
- **Prefer skeletons over spinners** for first paint of list/detail screens; use spinners for inline button loading and pull-to-refresh.
- Replace web 30s polling with pull-to-refresh + push-driven refresh; show the `RefreshControl` tinted `amber-500`. Broker/admin counter contexts refresh on app-foreground rather than a fixed interval.

---

### 3.15 Empty, error & success states

Unify into an `<EmptyState>` primitive (port `UEmpty`): centered, `py-10`, optional glyph (`sage-400`), title (`heading-sm`), body (`text-body-sm text-sage-500`), optional primary CTA.

#### Empty states (real copy anchors)

| Screen | Copy / CTA |
|---|---|
| Borrower dashboard, no requests | "Create your first request" → `/borrower/request/new` |
| Borrower no active requests | "No active requests" |
| Request responses empty | `brokerIntros.noIntros` |
| Messages (either role) | no conversations → `noConversationsDescBroker` / borrower variant |
| Broker feed empty | "No matching requests" + include-responded CTA |
| Admin inbox clear | "전부 정리됐어요" (all caught up) |
| Admin people/reports empty | "조건에 맞는 사용자가 없습니다" / status-specific |

#### Error states

- **Inline error banner** (recoverable, data present): tone-tinted card above content (e.g. broker `requestsError`, borrower dashboard with cached data). `bg-error-50 border-error-100 text-error-700`, `rounded-sm`.
- **Full-screen retry card** (fetch failed, no cache): title + body + **Retry** button (ghost/dark). Critically, borrower dashboard on load failure shows a *retry* card, **not** the "create your first request" empty state (prevents duplicate submissions during an outage) — preserve this distinction natively.
- **Not-found:** request 404 → route back to dashboard; generic 404/500 → native error screen with "Back"/"Retry".
- **Gate/entitlement screens** (broker, first-class): verification pending, FREE→upgrade, 0 credits (BASIC/PRO), PAST_DUE, PREMIUM_EXCLUSIVE — render as full warm cards with the right CTA (upgrade → external web billing hand-off; fix payment → external Stripe portal), not inline toasts.
- **Session revocation:** on `null` session / 401 (tokenVersion bump from password change or admin ban), route gracefully to login rather than crashing.
- **Maintenance:** poll `/api/maintenance` on launch/foreground; show a native full-screen "Under Maintenance" card (`🔧`, `common.maintenanceTitle/Desc/Note`).

#### Success states

- Transient success → success toast (5s) with real keys: `settings.profileUpdated`, `settings.passwordChanged`, `request.editSuccess` (web shows ~4s), `broker.onboardingSuccess`, `broker.planUpgraded`.
- Persistent success context → inline `success` banner or badge (e.g. one-time broker "verified" congrats banner, gated by a per-broker seen flag in AsyncStorage; billing `?checkout=success` "Subscription activated" banner after returning from the external Stripe browser hand-off).
- Verified/approved status is otherwise communicated through the `success`-tone status badge, not a toast.

---

### 3.16 Motion & accessibility

- Animation timings from web keyframes: `fade-in` 600ms, `slide-up` 220ms, `scale-in` 400ms, all `ease-out`. Sheets use `slide-up`; toasts `fade-in`; pressed cards `active:scale-[0.99]`.
- **Respect OS reduce-motion** (`AccessibilityInfo.isReduceMotionEnabled`) — collapse animations to near-instant, matching web's `prefers-reduced-motion` reset.
- Minimum touch target 44×44pt everywhere; hit-slop on small glyph buttons.
- Honor Dynamic Type up to a capped multiplier; ensure tab labels and headers don't overflow.
- Contrast: `sage-500` on `cream-50` and `amber-500` on white both pass AA for the text sizes used; keep body text at `forest-800`/`forest-700` for maximum legibility.

---

## 4. Core User Flows

This section walks each core journey end-to-end as it should feel on the Mortly mobile app, anchored to the real routes, endpoints, Prisma enums, and tokens the web already enforces. The rule throughout: **the phone is a thin, trusted client over the existing `pages/api/*` surface** — every gate (role, verification, tier, entitlement, embargo, rate limit, `tokenVersion`) stays server-authoritative, and the app sends `x-mortly-mobile: 1` on mutating calls to bypass the same-origin CSRF gate. Mobile inherits all business rules for free; its job is to make them fast, legible, and thumb-reachable, and to fail gracefully when a 403/409 comes back.

Legend for the "Server gate" column: the endpoint + the sentinel code the app must map to localized copy.

---

### 4.1 Sign Up (email/password)

**Ideal mobile flow**

| Step | Screen / action | Endpoint | Notes |
|---|---|---|---|
| 1 | Role picker (Borrower / Broker), default **BORROWER**; locked if launched from a role-specific deep link (`?role=`) | — | Korean-default copy; role cards use sharp `rounded-sm` selection state |
| 2 | Name, email, password (≥8), confirm; mandatory Terms + Privacy checkbox linking to in-app `/privacy` + `/terms` | — | Client mirrors web validation (`nameRequired`, `invalidEmail`, `mustAgreeToTerms`, `passwordTooShort`) |
| 3 | Submit → account created UNVERIFIED, 6-digit code emailed via Resend | `POST /api/auth/signup {name,email,password,role,locale,legalVersion}` | **Must send `legalVersion=2026-04-06` and explicit `locale`** — server defaults to `ko`, but the device may be `en` |
| 4 | Route to native OTP screen | — | Pass `email`; if send failed, server returns `emailSent:false` → open with resend countdown already at 0 |

**Risky edge cases**

- **Legal version drift:** if `legalVersion` ≠ `CURRENT_LEGAL_VERSION` the server 400s. Bundle the constant but also read it live where possible so an app pinned to an old build doesn't hard-block signups after a legal bump.
- **Duplicate email → 409 `emailExists`**, rate limit (5/min/IP) → 429 `tooManyRequests`. Show inline, keep the form populated.
- **Email send failure but account created:** don't strand the user — land them on OTP with immediate resend, and copy that says "we couldn't send the code, tap resend."
- **App Store review:** account creation must be reachable without payment (it is — borrowers/brokers both sign up free), and the flow must be completable in-app.

---

### 4.2 Email Verification (OTP)

**Ideal mobile flow**

- Native single-field OTP with **iOS/Android SMS-less autofill + paste** (web's 6-box paste-splitting is DOM-specific; reimplement with a RN `TextInput` that accepts one-time-code content type).
- Submit → `POST /api/auth/verify-email {email, code}` → success routes to Login prefilled (`verified=true`).
- Resend → `POST /api/auth/resend-code {email, locale}` with a visible countdown.

**State machine the app must honor**

| Server response | Meaning | Mobile copy |
|---|---|---|
| success | verified | route to login, autofocus password |
| 400 (generic) | invalid **or** unknown email **or** already verified (enumeration-safe) | `auth.invalidCode` — never reveal which |
| 400 `{expired:true}` | code expired **or** 5-attempt burn | `auth.codeExpired` — distinct copy, push "request a new code" |
| 429 `{retryAfter}` | resend cooldown (60s/account) or 3/min/IP cap | disable resend, count down `retryAfter` |

**Risky edge cases**

- **5-attempt burn nulls the code** — the app must treat "expired" and "too many attempts" identically in UI (both need a fresh code) but distinct from "invalid, try again."
- **Deep-link from email:** if verification links open the app, extract email+code and pre-fill; never auto-submit silently — show the user what's happening.
- No authenticated session is required to verify, so the app can run this before any token exists.

---

### 4.3 Login (credentials + Apple/Google)

**Credentials.** The web relies on the `__Secure-next-auth` HttpOnly cookie, which native storage can't use. The mobile app must obtain a **raw JWT** it can persist in secure storage (Keychain/Keystore), not a cookie. Two viable paths, in priority order:

1. **Native OAuth via the existing mobile endpoint** for Apple/Google (already built, returns a 30-day JWT).
2. **A token-minting credentials path** for email/password (either reuse the credentials callback with token capture or a small mobile login endpoint) — flag as an integration dependency; the recon confirms `mobile-oauth` exists but a first-class mobile credentials-token endpoint is the one open build item.

**Apple / Google (native SDK, not web redirect)**

| Step | Action | Endpoint | Notes |
|---|---|---|---|
| 1 | Native Sign in with Apple / Google SDK → `idToken` | — | Google audience must include `GOOGLE_IOS_CLIENT_ID`; Apple audience = bundle `app.mortly.mobile` + service `app.mortly.mobile.signin` (already server-supported) |
| 2 | Exchange token | `POST /api/auth/mobile-oauth {provider, idToken, name?}` | Returns `{sessionToken (30-day), user:{needsRoleSelection, needsNameEntry}}` |
| 3 | Persist `sessionToken` in secure storage | — | This is the session for 30 days; no refresh endpoint exists (see risk) |
| 4 | Branch on flags | — | `needsNameEntry` → name screen; `needsRoleSelection` → role picker; else role dashboard |

**Sentinel-code mapping (reuse web contract verbatim)**

| Code | Mobile behavior |
|---|---|
| `EMAIL_NOT_VERIFIED` | route to OTP screen with email |
| `GOOGLE_ACCOUNT` | "This account uses Google sign-in" |
| `INVALID_CREDENTIALS` / `MISSING_CREDENTIALS` | generic error, keep form |
| `ACCOUNT_SUSPENDED` / `ACCOUNT_BANNED` | terminal message, no retry |
| `RATE_LIMITED` | back off (per-IP 30 / per-email 5 over 15 min) |

**Risky edge cases**

- **Apple returns name only on first authorization.** If the very first server call failed, `name` is null forever unless backfilled → `needsNameEntry=true`. Build the native name-entry screen (no web equivalent exists) and `PATCH /api/users/me {name}` — which also returns a **fresh 30-day `sessionToken`** the app must swap in.
- **30-day JWT, no rotation.** There's no refresh-token endpoint. On any `401`/null `/api/auth/session`, drop to login gracefully. Consider silently re-running native OAuth on cold start if the token is near expiry.
- **`tokenVersion` revocation (see 4.14):** a valid-looking stored JWT can be dead within ~5s of a password change or admin ban elsewhere. Treat "session says null" as authoritative, not the presence of a stored token.
- **Anti-hijack on device token:** unrelated to auth, but register the push `DeviceToken` only after login (4.13); a token bound to another user 409s.

---

### 4.4 Role Selection (post-OAuth, first-time only)

**Ideal flow:** if `needsRoleSelection`, show a native Borrower/Broker picker → `POST /api/auth/select-role {role}` **with `x-mortly-mobile: 1`** → server strips the flag, invalidates its session cache, and **returns a fresh 30-day `sessionToken`** the app must persist → route to the role dashboard.

**Risky edge cases**

- First-time-only: a second call or an already-onboarded user gets **409**; ADMIN role change is **403**. The app should never show this screen once `needsRoleSelection` is false.
- Handle `needsNameEntry` **and** `needsRoleSelection` together (Apple no-name new user): name first, then role, then dashboard.

---

### 4.5 Broker Onboarding → Verification

**Ideal mobile flow (stepped wizard, not the web single-scroll)**

| Step | Fields | Validation |
|---|---|---|
| 1 Business | `brokerageName*` (≤200), `province*` (13-item `PROVINCES`), `licenseNumber` (`/^[A-Z0-9-]{1,50}$/i`, optional) | required-field gates |
| 2 Contact + category | `phone*` (+1 UI, stored E.164 `/^\+[1-9]\d{6,14}$/`), `mortgageCategory` (RESIDENTIAL/COMMERCIAL/BOTH, default BOTH) | |
| 3 Profile | `bio` (≤2000), `yearsExperience` (0–50), `areasServed`/`specialties` (≤1000) | |
| 4 Photo (optional) | native image picker + crop → 512² JPEG | **non-fatal** |

Submit → `POST /api/brokers/profile` creates the Broker row: `verificationStatus=PENDING`, `subscriptionTier=FREE`, `responseCredits=0`. Then **deferred** avatar upload via signed URL (`POST /api/brokers/avatar/upload-url` → `uploadToSignedUrl` → `POST /api/brokers/avatar` confirm). Route to `/broker/dashboard` (or profile if only the avatar failed).

**Verification wait (a first-class native gate screen, not an inline banner)**

- While PENDING, the requests feed `GET /api/requests` **403s** — the app shows a "Verification pending" screen everywhere the feed would be, with a link to the dashboard. Do **not** surface this 403 as an error (the recon notes web treats a feed-403 as an expected gated state, not `requestsError`).
- Admin verifies out-of-band → next dashboard visit shows a **one-time green congrats banner** (guard with a local flag keyed to broker id, best-effort like web's `mm_verified_seen_{id}`).
- REJECTED → distinct danger state; avatar controls hidden (upload-url 403s for REJECTED), broker can revise.

**Risky edge cases**

- **Avatar upload is non-fatal** — onboarding must succeed even if the photo fails; route to profile with a retry toast.
- **Confirm-step server validation:** the stored object must be image/jpeg ≤1MB or it's deleted server-side (`INVALID_IMAGE_TYPE`/`IMAGE_TOO_LARGE`). The native cropper must output JPEG within budget.
- **Verification is manual + can require two admins** (`BROKER_VERIFY_REQUIRES_TWO_ADMINS`): the broker experience doesn't change, but don't imply instant approval.

---

### 4.6 Borrower Request: Create → Approval → Broker Responses

**Create (native stepper mirroring web's 3 steps)**

| Step | Content | Client gate |
|---|---|---|
| 1 Basics | category RESIDENTIAL/COMMERCIAL + ≥1 product (from `lib/requestConfig.ts`) | ≥1 product |
| 2 Details | `province*` + city; residential: `purposeOfUse` + income types + up to 2yr income; commercial: `businessType` + 2yr income/expense parity; `desiredTimeline*` | required fields + commercial income/expense year parity (`commercialFinancialsHelper`) |
| 3 Review & Submit | edit-jump chips + **required notes** | non-empty notes |

Submit → `POST /api/requests` (rate-limited 10/min) → status **PENDING_APPROVAL** → route to `/borrower/request/{publicId}`.

**Approval lifecycle (`RequestStatus`: PENDING_APPROVAL → OPEN → IN_PROGRESS → CLOSED/EXPIRED/REJECTED)**

- New requests are **invisible to brokers** until an admin sets OPEN (stamps `approvedAt`, resets the PREMIUM window). Borrower dashboard shows an amber "Pending Approval" banner; detail shows the `ConsultationStepper` at step 1.
- Approval fires **push + email + in-app notice** ("Your request is live"). On mobile this is the moment push earns its keep — tapping it deep-links to the request detail.
- **REJECTED** → danger banner with `rejectionReason`; stepper hidden; borrower creates a new request (no reopen path).

**Broker responses hub**

- There is **no borrower "browse brokers" screen** — `/borrower/brokers/[requestId]` is a redirect to `request/{id}#responses`. Discovery is reactive: `<BrokerResponses>` cards appear once brokers open conversations, sortable **fastest** (earliest `createdAt`) / **most experienced** (`yearsExperience` desc). Native this is a "Responses" section/tab on request detail.

**Risky edge cases**

| Case | Server | Mobile handling |
|---|---|---|
| Active-request cap (5 in PENDING_APPROVAL/OPEN/IN_PROGRESS) | 400 `ACTIVE_REQUEST_CAP` | block submit with clear count copy |
| Edit after a broker responded | 409 `EDIT_LOCKED_BY_CONVERSATIONS` | pre-warn in edit mode; **send only changed fields**; only notes/timeline persist |
| Delete with conversations | 409 | hide Delete, offer Close only |
| Close from terminal state | 400 `CLOSE_INVALID_STATUS` | only show Close for OPEN/IN_PROGRESS |
| Request 404 | — | route back to dashboard (web does `router.replace`) |
| Draft loss | — | persist wizard to **native storage** (not `sessionStorage`); unsaved-changes guard on back nav (no `beforeunload`) |
| Detail doesn't subscribe to realtime | — | poll or pull-to-refresh for status/response changes (open question inherited from web) |
| Dashboard fetch fails with empty cache | — | show retry card, **not** the "create your first request" empty state (prevents duplicate submissions during an outage) |

---

### 4.7 Broker Browse → Respond (embargo + credits)

**The three gates that decide everything:** `verificationStatus===VERIFIED` (feed + messaging), `subscriptionTier` (FREE can't message; BASIC/PRO spend 1 credit per new conversation; PREMIUM unlimited), and `subscription.status` (PAST_DUE/EXPIRED/CANCELLED revoke paid entitlement even while tier still reads its paid value).

**Ideal flow**

1. **Browse** `/broker/requests` → `GET /api/requests?province&mortgageCategory&page` → native card stack (adopt web's `RequestCardMobile`), **infinite scroll** instead of "Load more", filter chips in a native sheet. Gold "new" dot from `BrokerRequestSeen`; ★ premium-exclusive badge only ever set for PREMIUM brokers.
2. **Open detail** `/broker/requests/[id]` → fires mark-seen (`/api/brokers/requests/{id}/mark-seen`); leaving the list fires bulk `mark-requests-seen` (best-effort).
3. **Respond (the money action):** for BASIC/PRO show a **native confirm sheet "Use 1 credit · N remaining"** so a single tap can't spend real money; PREMIUM shows "unlimited responses," no confirm. Confirm → `POST /api/conversations {requestId: publicId}` → on success route to `/broker/messages?id={conversation.id}`.

**Blocked-response states → design first-class native gate screens, not inline banners**

| Server code | Cause | Native screen |
|---|---|---|
| `UPGRADE_REQUIRED` | FREE / no tier | "Upgrade to message" → hand-off to web billing (4.11) |
| `NO_CREDITS` | BASIC/PRO at 0 credits | "Out of credits" → manage plan on web |
| `SUBSCRIPTION_PAST_DUE` | lapsed status | "Payment needed" → web portal |
| `PREMIUM_EXCLUSIVE` | non-PREMIUM on in-window request | shouldn't appear in feed; if hit, "Available to all soon" |
| `REQUEST_NOT_OPEN` | request left OPEN/IN_PROGRESS | "No longer available" |
| `BROKER_NOT_VERIFIED` | de-verified | verification-pending screen |

**Risky edge cases**

- **Credit spend is atomic + idempotent** (Serializable tx, `requestId_brokerId` unique key). Two fast taps won't double-spend, but the app should still debounce the button and refresh credits from `BrokerDataContext` after success.
- **PREMIUM early-access embargo is dark-launched** (`premium_early_access_enabled=false`). Gate all ★/perk UI on `GET /api/premium-early-access {enabled}` — don't advertise while disabled. Confirm whether it's ON at launch (feed contract changes if so).
- **Detail-page "unlimited" ≠ dashboard "unlimited":** detail uses `tier===PREMIUM` only; a PAST_DUE PREMIUM is visible-but-can't-act (server 403 is the real gate). Never let the client's optimistic "unlimited" bypass a server 403.
- **Non-PREMIUM can't mark in-window exclusives seen** — don't try to clear dots on requests the broker can't see.

---

### 4.8 Messaging (realtime, unread, block/report, auto-close)

**Architecture the app must respect:** chat content is **never** streamed. Supabase Realtime carries only a content-free `sync` nudge on topic `chat-<conversationId>`; the app responds by refetching through the **authenticated, participant-gated** `GET /api/conversations/[id]`. `public.messages`/`public.conversations` are RLS deny-all for anon — **the app must never read chat via the anon key.**

**Ideal flow**

| Action | Endpoint | Mobile detail |
|---|---|---|
| List | `GET /api/conversations` | native list; unread badges cap at "9+"; suppress unread on CLOSED |
| Open thread | `GET /api/conversations/[id]` | stamps `lastReadAt` (marks read); optimistically zero the list badge with rollback on failure |
| Send | `POST /api/messages {conversationId, body}` | optimistic append; **dedupe strictly by message id** (optimistic + nudge-refetch can both add it) |
| Receive | subscribe `chat-<id>` `broadcast:sync` | on nudge, refetch + merge by id |
| Close (borrower only) | `PUT /api/conversations/[id] {status:CLOSED}` | brokers have no close action |

**Realtime lifecycle on mobile:** subscribe on **foreground/screen-focus**, unsubscribe on background (RN `AppState` replaces web's `visibilitychange` + `refresh-unread` window events). Keep a light poll (web uses 5s) as backstop when Realtime is unavailable (`isSupabaseConfigured=false`), and **push is primary** for waking the app. On foreground, also refresh conversation **status** (a stale tab posting into a just-closed thread → 409 `CONVERSATION_CLOSED`).

**Send gates (broker side)**

- Must be VERIFIED + paid tier + good standing (`checkBrokerCanMessage`); replies are **free**. Spam guard: while `borrowerMsgCount===0`, broker limited to `broker_initial_message_limit` (default 3) → **429**. Body 1–5000 chars, can't start with `[admin]`/`[system]`, 30/min rate limit.

**Block & Report (Apple 1.2 — partly net-new)**

- **Report** exists on web: `POST /api/reports {targetType (BROKER/REQUEST/CONVERSATION), targetId, reason}` (1–2000 chars, 10/day, duplicate→409). Reachable from thread header + `BrokerResponses`. Consider predefined reason chips for faster mobile input.
- **Block is backend-only today (no web UI).** The mobile app **must build it** to pass review: block/unblock affordance in the thread header + a **Blocked Users** list in Settings (`GET /api/users/blocked`, `POST/DELETE /api/users/[publicId]/block`). Block is symmetric — hides conversations both ways and 403s new messages/conversations.

**Auto-close & system messages**

- A daily cron closes threads inactive >72h and never-started threads after 7 days, writing a bilingual `isSystem` message and cascading IN_PROGRESS requests to closed. Render `isSystem=true` as **centered notices, never participant bubbles**.
- **Confirm the production cron actually fires** (`vercel.json` declares only `/api/cron/daily`; Hobby 2-cron limit) — mobile UX depends on stale threads closing.

**Risky edge cases**

- **De-verified broker keeps thread access but the API strips borrower financial fields** — the app must render a thread with missing `notes/details/desiredTimeline` gracefully.
- **Korean IME Enter guard:** don't submit mid-composition (`isComposing` → RN `TextInput` composition handling).
- **Chat disclaimer** (per-conversation, `localStorage` on web) → AsyncStorage; borrower vs broker copy differs.
- **Broadcast failures are swallowed** — polling/push must backstop; never surface a nudge failure as an error.
- **Notice bell vs push vs chat-unread** are three separate counters today; reconcile into one coherent inbox and drive the OS app-icon badge from `GET /api/messages/unread` (which counts only ACTIVE conversations, and returns `{unread:0}` early for not-yet-onboarded brokers).

---

### 4.9 Notifications (push permission + deep-link)

**Ideal flow**

1. **After login** (not before — avoids a cold permission prompt), request OS push permission with a value-framed pre-prompt ("Get notified when a broker responds / a borrower replies").
2. Obtain Expo token → `POST /api/notifications/register-device {token, platform (IOS/ANDROID/WEB), locale, deviceName, appVersion}`. Re-register on **locale change** (push is delivered per stored device locale) and refresh `lastActiveAt`.
3. **Deep-link on tap:** payload carries minimal `{type, conversationId|requestId}`. Route `type=conversation` → thread; `type=request` → request detail. Content bodies are **intentionally generic** ("New message / 새 메시지") and must never leak sender text, loan amounts, or income.
4. On logout → `DELETE /api/notifications/register-device {token}`.

**Risky edge cases**

- **Token hijack guard:** a token already bound to another user → **409**; the other account must unregister first. Handle silently (don't error the user).
- **Invalid/`DeviceNotRegistered` tokens are pruned server-side** — the app should re-register on next launch if a send failed.
- **Admins get zero push today** — the single biggest gap. If mobile admin ships (4.12), add ADMIN-targeted push for new pending requests, verifications, reports, and <2h priority items via the existing `sendPushToUsers` infra.
- **Deep-link into auth-gated content while logged out / token revoked:** stash the target, route through login, then resume.
- Respect `pushEnabled` + `mutedUntil`; build the notification-preferences UI the web never had (see 4.10).

---

### 4.10 Profile & Settings

**Borrower** (`/borrower/profile`, `GET/PUT /api/borrowers/profile`): edit name; **change password** (`{currentPassword, newPassword≥8}` → bumps `tokenVersion`, logging out all other sessions within ~5s); email immutable; `publicId` shown as support "User ID". OAuth-only accounts have no `passwordHash` → surface "Password change not available" instead of the form.

**Broker** (`/broker/profile`, `GET/PUT /api/brokers/profile`): business fields + avatar + verification pill; **no in-app password change** (route to `/forgot-password`); email immutable.

**Net-new mobile settings the web lacks:**
- **Notification preferences** — `/api/preferences` already validates `emailNotifications`/`pushNotifications`/`locale`/`theme` but no web UI writes them. Mobile is the first surface: email vs push toggles (push toggle also drives `DeviceToken.pushEnabled` / register-device DELETE).
- **In-app language control** — the web's "marketing-only, no in-app switcher" rule is explicitly a marketing-site convention; the app is not the marketing site, so it needs its own language setting (follow device locale and/or write the `locale` preference, which only accepts `en`/`ko`). This does **not** contradict the locked "no in-app switcher for the app-authenticated area (web)" decision — it's the mobile-specific exception the recon calls out.
- **Blocked Users list** (4.8), **Legal/About** links to `/privacy` + `/terms` (App Store requirement).

**Risky edge cases**

- Split the long web forms into grouped list rows (Profile / Security / Notifications / Legal / Danger Zone).
- Password change elsewhere revokes this device's JWT (~5s) — detect null session and re-auth (4.14).
- Preferences payload >10KB → 400; unknown keys silently dropped.

---

### 4.11 Subscription Status + Web Hand-off (READ-ONLY, the critical constraint)

**Locked constraint:** the app performs **no in-app purchase** — only brokers pay, and all checkout/upgrade/downgrade/payment-method/resume happens on the website via Stripe to avoid the 15–30% commission. In-app, billing is **read-only** plus an external hand-off.

**What the app shows (read-only)** via `GET /api/brokers/profile` + `GET /api/tier-credits` + `GET /api/premium-early-access`:

| Element | Source | Display |
|---|---|---|
| Current tier | `subscriptionTier` FREE/BASIC/PRO/PREMIUM | plan chip |
| Credits + usage | `responseCredits` (PREMIUM = `-1` sentinel) | "Unlimited" **only when status ACTIVE**, else raw number; red when 0 |
| Renewal / period | `subscription.currentPeriodEnd` | date |
| PAST_DUE banner | `subscription.status` | high-priority alert + "Update payment on mortly.ca" |
| Pending downgrade / cancelling | `pendingTier` / `cancelAtPeriodEnd` | inline notice |

**Hand-off flow (the core interaction)**

1. Broker taps **"Manage on mortly.ca"** (upgrade, downgrade, resume, update card, cancel, invoices).
2. App opens the **external system browser** (not an in-app payment WebView, not a Stripe PaymentSheet) to the broker billing page / Stripe portal.
3. Broker completes changes on web; Stripe webhooks (`pages/api/webhooks/stripe.ts`) mutate the tier/credit/status server-side.
4. Broker returns to the app → **the app does not poll a Stripe result**; instead it refreshes `GET /api/brokers/profile` on **foreground / pull-to-refresh** to reflect the new tier or cleared PAST_DUE. (Replace web's 15s client poll with foreground refresh + optionally a push when the webhook lands.)

**How new state surfaces**

| Web change | Webhook effect | App reflects (on next profile refresh) |
|---|---|---|
| Upgrade | immediate prorated, tier flips | new tier + refreshed credits, message gates open |
| Downgrade | scheduled at period end, `pendingTier` set | "pending downgrade" notice; tier changes at renewal |
| Payment fails | `invoice.payment_failed` → PAST_DUE, credits reset to 0 (bonus kept) | PAST_DUE banner; messaging blocked (`SUBSCRIPTION_PAST_DUE`) |
| Recovery | `invoice.paid` → ACTIVE, credits regranted | banner clears, credits restored |
| Cancel | `cancelAtPeriodEnd=true` | "cancelling on {date}" notice |

**Risky edge cases / compliance**

- **App Store anti-steering (the flagged risk):** the app links out to an external web purchase for a digital subscription. Apple's rules on external links shifted 2024–2025 and remain contentious. **Default to the conservative read-only posture: no in-app pricing, no in-app "buy/upgrade" language that reads as a CTA to purchase, no price display that could be construed as steering — a neutral "Manage your subscription on mortly.ca" hand-off.** Verify current guideline text at submission; be prepared to soften copy. Treat this as a launch-gate review item, not an afterthought.
- **PREMIUM `-1` sentinel:** all credit math/UI must special-case negatives ("Unlimited" only if ACTIVE).
- **PAST_DUE PREMIUM keeps early-access visibility but can't open conversations** — "visible but can't act." Don't advertise "unlimited" for a PAST_DUE PREMIUM.
- **Invoices** (`GET /api/stripe/invoices`) can render read-only in-app; PDF opens in a native document viewer / external browser.
- If Apple ultimately mandates IAP for these subs, the entire purchase model changes — this is the single largest external dependency and should be socialized before build.

---

### 4.12 Admin Moderation (from the phone)

The locked scope includes ADMIN as a role in the one app, with its own tab/stack for on-the-go moderation. The two highest-value mobile tasks are **approve/reject** (Inbox) and **resolve reports**.

**Approve / reject a broker verification**

1. Admin tab → **Inbox** (`GET /api/admin/queue`, stable contract, 25 each; filter chips REQ/BRK/REP).
2. Select a BRK row → detail (broker profile + checklist).
3. **Approve** → `PUT /api/admin/brokers/[id] {verificationStatus:VERIFIED}`; **Reject** → `{verificationStatus:REJECTED}`. Use large tap targets / swipe-to-approve/reject with the **3-second undo toast** (optimistic hide, cancels the API call on undo).
4. Broker is notified (in-app + push + email); every mutation writes an `AdminAction` audit row.

**Resolve a report**

1. Admin tab → **Reports** (`GET /api/admin/reports?status&targetType`) → status chips OPEN/REVIEWED/RESOLVED/DISMISSED.
2. Select → mobile sheet with reporter/target cards + `adminNotes` textarea.
3. **Resolve/Dismiss/Mark reviewed** → `PUT /api/admin/reports/[id] {status, adminNotes}` (stamps `resolvedAt`; audit `RESOLVE_REPORT`/`DISMISS_REPORT`).

**Approve/reject a request** (Inbox REQ): `PUT /api/admin/requests/[publicId] {status:OPEN|REJECTED}` → notifies borrower + resets/starts PREMIUM window on OPEN.

**Risky edge cases**

- **Two-admin verification gate** (`BROKER_VERIFY_REQUIRES_TWO_ADMINS`): a single admin's verify returns **HTTP 202** `PENDING_SECOND_REVIEW` (RECOMMEND logged) — the app must show "awaiting a second admin," not "done."
- **`tokenVersion` on suspend/ban:** the target's sessions die immediately; admins can't suspend/ban another admin or themselves (403).
- **Stale badges:** `AdminDataContext` counts can lag up to 60s; show the stale-data error banner and add pull-to-refresh — don't let the admin act on a stale count.
- **High-blast-radius toggles** (`maintenance_mode`, create-admin) — gate behind confirms or keep desktop-only; the recon flags whether destructive admin actions belong on mobile at all.
- **Unresolvable report targets** (deleted target → raw cuid) must render gracefully.
- **Admins get no push today** — if mobile admin ships, adding ADMIN push (new queue items, <2h priority) is the marquee mobile-only win.
- **Command palette / Cmd+K has no mobile analog** — replace with a visible search icon → full-screen search + action sheet.

---

### 4.13 Push Permission Timing & Device Lifecycle (cross-flow)

Consolidated because it threads through login, messaging, and admin:

- **Register** `DeviceToken` right after a successful session exists, with a value-framed pre-prompt before the OS dialog.
- **Re-register** on locale change and app updates (`appVersion`), refresh `lastActiveAt` on foreground.
- **Unregister** on logout.
- Honor `pushEnabled` + `mutedUntil`; expose toggles in Settings (4.10).
- Deep-link payloads are minimal `{type, conversationId|requestId}` into auth-gated screens; resolve auth first, then route.

---

### 4.14 Logout & Account Deletion ("log out everywhere")

**Logout**

- Confirm modal → clear the stored JWT + `DELETE /api/notifications/register-device {token}` → route to the login screen (mirror web's redirect-to-`/login`, never home).
- **"Log out everywhere":** the mechanism is server-side `tokenVersion` bumping (`revokeUserSessions`). The web has no explicit user-facing button today; if mobile ships one, it triggers a `tokenVersion` bump (e.g. via password change or a dedicated action) and every outstanding JWT — including this device's — dies within the ~5s session-cache TTL. The app must detect the resulting null `/api/auth/session` and re-auth.

**Account deletion (App Store 5.1.1(v) — must be in-app, hardened)**

Two sequential native confirm dialogs, then a conditional re-auth, matching the web `DeleteAccountSection` (explicitly designed to mirror "two sequential native Alerts"):

1. Confirm → Final confirm.
2. First attempt: `DELETE /api/users/me {ack:"DELETE_MY_ACCOUNT"}` (with `x-mortly-mobile: 1`).
3. If server 400s on `/password/i` (credentials account), show a **password re-auth prompt** → retry `{currentPassword}`.
4. Success → clear session + route home.

Server does a hard cascade delete (messages, seen rows, conversations, requests, reports, subscription, broker row, notices, **device tokens**, user) + best-effort Supabase avatar removal (PIPEDA).

**Risky edge cases**

| Case | Behavior |
|---|---|
| **ADMIN self-delete** | **403** "Admin accounts cannot self-delete" — hide/disable the option for admins |
| Credentials account | must retype current password (defeats stolen-JWT delete) |
| OAuth-only account | `ack` string suffices today; recon flags a "future hardening" to require a fresh OAuth round-trip — consider requiring native Sign in with Apple/Google re-auth before deletion on mobile |
| `tokenVersion` mid-session | deletion bumps it; any lingering call from another device 401s → route to login |
| Copy | web uses `deleteAccountFailed` as generic fallback though `deleteAccountSuccess` exists — reuse the localized keys, don't invent |

---

### Cross-flow error contract (quick reference)

| Sentinel / status | Where | Mobile default |
|---|---|---|
| `EMAIL_NOT_VERIFIED` | login | → OTP screen |
| `RATE_LIMITED` / 429 | login, signup, messages, reports | back off, show retry timing |
| `ACTIVE_REQUEST_CAP` | create request | block + count copy |
| `EDIT_LOCKED_BY_CONVERSATIONS` / `EDIT_LOCKED` | edit request | send changed fields only |
| `UPGRADE_REQUIRED` / `NO_CREDITS` / `SUBSCRIPTION_PAST_DUE` | respond, send | gate screen → web hand-off |
| `PREMIUM_EXCLUSIVE` | respond | "available soon" |
| `REQUEST_NOT_OPEN` / `CONVERSATION_CLOSED` | respond, send | refresh status, "no longer available" |
| `PENDING_SECOND_REVIEW` (202) | admin verify | "awaiting 2nd admin" |
| null `/api/auth/session` | anywhere | treat as logged out, re-auth |

The unifying production principle: **the app never re-implements authority.** It renders state, offers the right action, sends the request with `x-mortly-mobile: 1`, and maps whatever gate the server returns to clear, localized, Korean-default copy — with the subscription hand-off and the Apple anti-steering read as the two compliance-sensitive flows to verify at submission.

---

## 5. Mobile UX Decisions

This section resolves the concrete mobile-constraint decisions that the screen specs, navigation, and API-reuse sections assume. Every decision is anchored to a real Mortly route, tier/status, design token, or existing endpoint so engineering can build against it without re-litigating tradeoffs. Defaults are set for the common device (notched iPhone / gesture-nav Android, one-handed use) and degrade gracefully on small/older hardware.

### 5.0 Guiding principles

- **Thumb-first, one-handed by default.** Every destructive or money-spending action (respond = spend 1 credit, close request, delete account, ban user) sits in the bottom third of the screen or in a bottom sheet, never a top-right corner tap.
- **The server is the authority; the client is optimistic but honest.** Because every gate (credit spend, `checkBrokerCanMessage`, `ACTIVE_REQUEST_CAP`, `PREMIUM_EXCLUSIVE`, `REQUEST_NOT_OPEN`) is enforced server-side, mobile can render optimistically and reconcile on the authoritative response — but it must never *hide* a server error behind an optimistic success.
- **Reuse the web's proven mobile behaviors.** `MobileTabBar`, the 85dvh `RequestContextPanel` bottom sheet, `hideMobileTabBar` on chat detail, the 5s poll + Realtime nudge, and the sessionStorage draft are already-validated patterns; port their *semantics*, re-implement their *mechanics* natively.

---

### 5.1 Small-screen layout & reachability

| Web pattern | Mobile decision |
|---|---|
| 240px broker/borrower sidebar, 72px admin dark rail | Native bottom tab bar (Section on nav). Primary tabs live in the reachable zone; overflow goes to a **More** sheet. |
| 3-column messages (list \| thread \| context) | Stack navigation: **list → thread (push)**; context panel is a bottom sheet, not a column. Tab bar hidden on the thread screen (mirrors `hideMobileTabBar`). |
| 4-column pricing/plan grid (`lg:grid-cols-4`) | Vertical card stack, PRO card pinned first with the "Most Popular" marker; sticky current-plan summary at top. |
| Admin People 860px min-width table | Stacked cards, one user per card; no horizontal table. |
| `AppTopbar` (eyebrow + serif title + actions) | Native header: back chevron left, serif title centered/left, max **one** primary action right; secondary actions move to a bottom action sheet. |

**Reachability rules**
- Primary CTAs render as full-width bottom-docked buttons above the safe area (e.g. "새 요청" on borrower dashboard, "Respond · Use 1 credit" on `/broker/requests/[id]`, "Send" composer).
- Top-right is reserved for **non-destructive, low-frequency** affordances only (context/info toggle, report flag). Never place approve/reject/ban/spend there.
- Minimum tap target **44×44pt** (already the web `min-h-[44px]` baseline); enforce with hitSlop where the visual is smaller (e.g. the 17px tab glyphs, 9+ badges).

---

### 5.2 Thumb-friendly interactions

- **Admin moderation** (highest-value on-the-go surface, `/admin/inbox`): replace the web keyboard flow (J/K/A/R/⌘⏎) with **swipe-to-approve / swipe-to-reject** on queue rows plus large tap buttons in the detail sheet. Preserve the web's **3-second undo grace** (`UndoToast`) — the API call fires only after the grace elapses, so a mis-swipe on `APPROVE_REQUEST` / `VERIFY_BROKER` / `RESOLVE_REPORT` is reversible. Keep the "one pending undo at a time" constraint.
- **Broker respond** (`/broker/requests/[id]`): the non-PREMIUM "Use 1 credit" confirmation is a **native action sheet**, not an inline button, so a single fat-finger can't spend real money (BASIC/PRO credits). PREMIUM shows "Unlimited responses" with no confirm step. Show remaining credit count in the sheet.
- **Pressed states**: map `active:scale-[0.99]` to a native `Pressable` scale/opacity. Respect OS reduce-motion (collapse the `animate-slide-up` sheet and `scale-in` to instant).
- **Pull-to-refresh** on all list surfaces (inbox queue, requests feed, conversation list, dashboard) — the native replacement for the web's 30s/60s polling loops.

---

### 5.3 Keyboard behavior

| Field context | Behavior |
|---|---|
| Login / signup email | `keyboardType="email-address"`, `autoCapitalize="none"`, `textContentType="username"`/`emailAddress`, `autoComplete` for OS password managers. |
| Password / new password | `secureTextEntry`, `textContentType="password"`/`newPassword` (enables Keychain/Google strong-password); confirm-password chains via return key. |
| **6-digit verify code** (`/verify-email`) | `keyboardType="number-pad"`, `textContentType="oneTimeCode"` (iOS SMS/email OTP autofill), `autoComplete="sms-otp"` (Android). Single native code field, not 6 DOM boxes. |
| **Money inputs** (request form annualIncome, corporate income/expenses, ownerNetIncome) | `keyboardType="decimal-pad"`, `$` prefix, live `toLocaleString` grouping (ko-KR / en-CA). No return key needed. |
| Phone (broker onboarding) | `keyboardType="phone-pad"`, live `(###) ###-####` mask, stored as `+1` E.164 (server accepts any E.164). |
| Chat composer | Multi-line, grows to ~4 lines then scrolls; **Send is a button, not return** (return inserts newline). Reimplement the **Korean IME guard**: do not submit while `isComposing`/mid-composition — critical since Korean is the default locale. |
| License number | `autoCapitalize="characters"` (regex `/^[A-Z0-9-]{1,50}$/i`). |

**Global keyboard mechanics**
- Wrap forms in `KeyboardAvoidingView` (iOS `padding`, Android adjustResize) so bottom-docked CTAs and the chat composer float above the keyboard.
- **Return-key chaining** on short auth/profile forms: `returnKeyType="next"` advances focus (name → email → password → confirm), last field `returnKeyType="done"`/`go` submits.
- Tap-outside and scroll-drag dismiss the keyboard (`keyboardShouldPersistTaps="handled"`) so users can reach validation errors and CTAs without a separate "Done" tap.

---

### 5.4 Safe areas & notches

- Use `react-native-safe-area-context`; never hard-code insets.
- **Bottom tab bar** and **chat composer** pad with `bottom` inset (the web already anticipates this with `pb-[env(safe-area-inset-bottom)]`).
- **Bottom sheets** (`RequestContextPanel` 85dvh, More sheet, action sheets, plan-change sheet) pad bottom inset and cap height at ~85% screen with an internal scroll + grabber handle.
- **Status bar**: set style per surface — light content on `forest-800` (#0f1729) headers and the admin dark context, dark content on `cream-100` (#f8f7f4) app backgrounds. **Reconcile the token drift**: the web PWA `theme-color` is `#1B3A2D` (legacy green) which does not match `forest-800`; the native status-bar/splash must use **`#0f1729`** (Midnight & Gold), not the stale green.
- Chat thread and long forms must keep the last message / submit button clear of the home indicator.

---

### 5.5 Offline & poor-network states

Mortly's core loops are chat and request submission; both need graceful degradation.

**Chat (highest sensitivity)**
- **Optimistic send**: append the message immediately with a `sending` state, then reconcile against the `POST /api/messages` response. **Dedupe strictly by message id** (the web already dedupes optimistic vs Realtime/poll inserts by id).
- **Retry queue**: on network failure, keep the bubble in a `failed` state with a tap-to-retry; do not silently drop. Restore the composer draft text on failure (web behavior).
- **Honest gating**: if the server returns `409 CONVERSATION_CLOSED`, `403 SUBSCRIPTION_PAST_DUE`, `403 UPGRADE_REQUIRED`, `429` (spam guard / rate limit), surface the specific state — never mask it as "sent". Refresh conversation status on foreground so a stale tab doesn't post into a just-closed thread.
- **Realtime is not guaranteed**: the `chat-<conversationId>` broadcast is a content-free nudge; when Supabase is unconfigured or WS drops, the **5s poll (foreground only)** is the sole path. Subscribe on `AppState` active, unsubscribe on background to save battery. **Never read chat via the anon key** — RLS is deny-all; always refetch through the participant-gated `GET /api/conversations/[id]`.

**Request form**
- **Native draft persistence** (AsyncStorage, replacing the web `sessionStorage` key `mortly:request-form-draft`) so a backgrounded/killed app doesn't lose a multi-step request. Rehydrate on mount, clear on successful `POST /api/requests`, keep on error.
- On submit failure show a retryable error; **do not** fall back to the "create your first request" empty state on load failure (the web deliberately shows a retry card to avoid duplicate submissions).

**Cache & read-only surfaces**
- Cache last-successful `GET /api/brokers/profile` / `/api/borrowers/profile`, counters, and the requests feed for instant paint on cold start; show a subtle "may be out of date" affordance (mirrors admin's stale-data banner) and refresh in background.
- Offline banner (thin, `warning`-toned) when no connectivity; disable spend/submit CTAs with an explanatory label rather than letting them fail.
- **Billing must fail closed**: never render "upgraded/unlimited" optimistically. Poll/refresh `/api/brokers/profile` after a Stripe hand-off return; the tier flip is webhook-driven and authoritative.

---

### 5.6 Push notifications

Push is the primary async channel on mobile (the web polls `/api/notices` + `/api/messages/unread` every 30s; mobile replaces polling with push + pull-to-refresh). Infra already exists: `expo-server-sdk`, `DeviceToken` model, `lib/push.ts`, and `POST/DELETE /api/notifications/register-device`.

**Permission timing**
- **Do not** ask on first launch. Register the Expo token and request OS permission **after the first meaningful engagement** — right after a borrower submits their first request (they now await approval + broker responses) or right after a broker completes onboarding / gets VERIFIED (they now await inbound conversations). Precede the OS prompt with a lightweight priming screen explaining value ("Get notified when a broker responds").
- On grant, `POST /api/notifications/register-device {token, platform, locale, deviceName, appVersion}`; on logout, `DELETE`. Handle the **409 token-hijack** case (token bound to another user) by prompting re-login/unregister.
- Send the normalized locale (`en`/`ko`, default `ko`) so `lib/push.ts` localizes per device.

**Categories & privacy** (bodies come from `lib/push.ts`)

| Category | Trigger | Body policy | Deep link (`pushData.type`) |
|---|---|---|---|
| New message | `POST /api/messages` | **Generic** "New message / 새 메시지" — never chat content, loan amount, location, or income | `type=conversation`, `conversationId` → thread |
| Conversation opened | broker/borrower opens conversation | May include brokerage/borrower name (open-event only) | `type=conversation` → thread |
| Request lifecycle | admin approve/reject, expiry (`notifyUser`) | Bilingual, no financials | `type=request`, request publicId → request detail |
| Billing (new) | `invoice.payment_failed` → PAST_DUE | High-priority; pair with in-app PAST_DUE banner | → `/broker/billing` |
| Admin ops (new) | new pending request / verification / report, `<2h` priority items | Count/summary only | → `/admin/inbox` or `/admin/reports` |

- Honor `DeviceToken.pushEnabled` and `mutedUntil`. Keep OS body generic by default; an **opt-in message-preview toggle** (schema reserves `preferences.pushPreviewEnabled`) can enable content previews.
- **Admin push is net-new and high value**: today admins get zero real-time signal and must poll the console. Route ADMIN-targeted pushes for new queue items and `<2h` priority escalations via the existing `sendPushToUsers`.
- Drive the **OS app-icon badge** and in-app tab badge from `/api/messages/unread` (ACTIVE conversations only, `9+` cap); suppress unread for CLOSED threads.

---

### 5.7 Deep links (universal links / app links)

- Domain: `mortly.ca` universal links + a custom scheme fallback.
- **Push deep links** carry the exact target (`conversationId` / request publicId) and must open the auth-gated screen; if the session is expired (tokenVersion bump / ban), route to login and resume the intended destination post-auth.
- **Email deep links**: verify-email code and password-reset token links point at web URLs. Decision: **email verification** opens the native verify screen (OTP autofill covers most cases); **password reset** opens the web reset page (no mobile-specific reset endpoint exists) or a native screen hitting the same `POST /api/auth/reset-password` — either way, force re-login afterward since the token bump revokes JWTs.
- **Legacy redirect routes** (`/borrower`, `/broker` index, `/borrower/brokers/[requestId]` → request `#responses`, `/admin/brokers/[id]` → user detail) are **not screens** — map them as deep-link resolvers to the canonical native destination.
- **Chat deep-link cold-start**: unlike the web (`mobileView` starts as `list`), a push into a specific thread must open the thread directly and set up the back-stack to the conversation list.
- **Billing return links**: Stripe Checkout/Portal `success_url`/`return_url` deep-link back into `/broker/billing`; refresh subscription state on return.

---

### 5.8 File uploads & camera/photo permissions (broker avatar)

Only the broker avatar is user-uploaded (`brokers/<userId>.jpg`, bucket `avatars`, via signed-URL flow).

- **Replace `react-easy-crop`/`AvatarCropper`** (browser-only) with a native image picker + crop (`expo-image-picker` + crop), preserving the pipeline: `POST /api/brokers/avatar/upload-url` → `uploadToSignedUrl` (contentType `image/jpeg`) → `POST /api/brokers/avatar` confirm.
- **Client constraints to match the server**: resize/compress to **512×512 JPEG ≤ 1MB** before upload (server deletes non-JPEG or >1MB with `INVALID_IMAGE_TYPE`/`IMAGE_TOO_LARGE`).
- **Permissions**: request **photo library** and **camera** access only at the moment of avatar edit (never at launch), with clear `Info.plist`/Android rationale strings ("Mortly needs photo access to set your profile picture"). Handle denial gracefully with a "Enable in Settings" path.
- **Gating**: avatar controls hidden for `verificationStatus === 'REJECTED'` (show "photo unavailable"), allowed while PENDING. Cache-bust rendered avatar (`?v=timestamp`) and refresh the broker data store so the tab/sidebar avatar updates immediately.
- Avatar is uploaded during onboarding **deferred and non-fatal** — profile save succeeds even if the upload fails; route to `/broker/profile` with a retry toast.

---

### 5.9 Form validation

- **Inline, on-blur + on-submit** (not on every keystroke) to avoid nagging. Errors render below the field in `error-700` (#b91c1c) with a 1px `error-100` border on the input; keep the web's sentinel-code → i18n mapping (e.g. `invalidCredentials`, `emailExists`, `passwordTooShort`, `mustAgreeToTerms`).
- **Auth screens**: client mirrors web rules (name required, email regex, password ≥8, passwords match, terms required) but the server sentinel codes remain canonical; on error auto-scroll to the first invalid field and move focus for VoiceOver/TalkBack.
- **Request long-form** (`/borrower/request/new`, 3 steps): validate **per step** and block "Next" until the step gate passes, matching web:
  - Step 1: ≥1 productType.
  - Step 2: province + desiredTimeline; residential → ≥1 purposeOfUse + ≥1 incomeType + a year-1 income amount; commercial → businessType present; **commercial income/expense year parity** (`request.commercialFinancialsHelper`).
  - Step 3: non-empty notes to submit.
- Server-authoritative errors on submit map to specific copy: `ACTIVE_REQUEST_CAP` (max 5 active), `EDIT_LOCKED_BY_CONVERSATIONS`, `REQUEST_NOT_OPEN`. Show these as inline banners, not generic toasts.

---

### 5.10 Long forms — progress, autosave, drafts

Two long forms: the **3-step request wizard** and **broker onboarding**.

- **Request wizard**: native segmented progress header ("STEP n/3", replacing the web `RequestFormLayout` rail + live summary). Persist the draft to AsyncStorage after each change; back-navigation triggers an **unsaved-changes guard** (native alert), the RN replacement for the web `beforeunload`. Money fields use decimal-pad; edit-jump chips from Step 3 return to a specific step.
- **Broker onboarding**: consider a **stepped wizard** (brokerage/license/contact → category → bio/experience → photo) rather than one long scroll, given required fields (`brokerageName`, `province`, `phone`) and optional avatar. Save is create-only (`409` if a broker row exists); avatar upload deferred/non-fatal.
- Autosave never blocks submit; show a subtle "Draft saved" affordance. Clear draft on successful submit only.

---

### 5.11 Search & filtering

- **Broker requests feed** (`/broker/requests`): port the web mobile card stack (`RequestCardMobile`). Filters (province `ChipSelect`, category `ChipSelect`, "only unresponded" toggle default ON) move into a **native filter sheet** or a sticky horizontal chip row; "Load more" pagination becomes **infinite scroll** (`GET /api/requests?province&mortgageCategory&page`, honoring `newCount`). Preserve the gold "new" dot (`isNew`) and the PREMIUM "exclusive" badge. Fire `POST /api/brokers/mark-requests-seen` on leave and per-detail `mark-seen` on open (best-effort) — note non-PREMIUM brokers must not mark in-window exclusives seen.
- **Admin People / Command Palette**: ⌘K has no mobile analog → a **persistent search icon** opening a full-screen search screen against `GET /api/admin/users?search=`. Debounce ~150–200ms with request cancellation; per-user quick actions become a native action sheet that routes to `/admin/users/[id]` (the palette itself never mutates).
- Verification gate: an unverified broker hitting the feed gets `403` → render the first-class **Verification Pending** screen, not an empty list.
- **Borrower has no broker-browse**: `/borrower/brokers/[requestId]` is a redirect only; keep discovery reactive via the request-detail `BrokerResponses` section (sortable fastest / most_experienced). Do not build a broker directory unless product explicitly adds one.

---

### 5.12 Accessibility

- **Dynamic Type / font scaling**: support OS text scaling; layouts must reflow (no fixed-height text rows that clip at large sizes). Cap extreme scale where it would break the 56px tab bar, but let body/content scale. Bundle Outfit (weights 300–700) + Pretendard (Korean, default locale) or fall back to system faces (SF Pro / system Korean) if licensing for app distribution is unresolved; keep IBM Plex Mono for IDs/labels/badges.
- **VoiceOver / TalkBack**: every icon-only control (tab glyphs, report flag, context toggle, avatar menu, undo toast) needs an `accessibilityLabel` and `accessibilityRole`. Badges announce counts ("Messages, 3 unread"). Chat messages announce sender + time; system messages announce as notices. Bottom sheets trap focus and are dismissible via the accessibility rotor/back gesture.
- **Contrast**: the Midnight & Gold tokens are largely AA-safe (`forest-800` on `cream` surfaces, `error-700` text on `error-50`). **Watch the amber accent**: `amber-500` (#c49a3a) white text on buttons is acceptable for large/bold button text but verify small `amber-600` eyebrow labels on cream meet AA; muted `sage-400`/`sage-500` secondary text must not be used for essential info at small sizes. Never rely on color alone — status uses badge label + tone (the `tones.ts` mapping).
- **Touch targets**: enforce 44×44pt minimum (hitSlop for smaller glyphs); keep spacing between adjacent destructive actions (approve/reject) to avoid mis-taps.
- **Reduce Motion**: honor the OS setting (web already collapses animations under `prefers-reduced-motion`) — disable slide-up/scale transitions.
- **Reachable legal**: expose `/privacy` and `/terms` from Settings → Legal (App Store requirement); keep the DeleteAccountSection reachable (guideline 5.1.1(v)).

---

### 5.13 Performance

- **List virtualization**: use `FlashList` (or `FlatList` with `getItemLayout`) for all potentially long lists — requests feed, conversation list, chat thread (inverted, windowed), admin queue/People/activity/reports. The chat thread uses cursor pagination (`before`, default 50 / max 100) — load older messages on scroll-to-top.
- **Image caching**: use `expo-image` with disk+memory cache for avatars; request Supabase image-transform URLs (`avatarTransformUrl`, size-squared, `resize=cover`) to keep egress and decode cost low. Cache-bust only on avatar change.
- **Bundle & startup**: expo-router file-based lazy routes; keep the heavy `RequestForm` (39KB on web) as its own lazily-loaded route rather than in the initial bundle. Hermes engine on. Defer non-critical work (analytics, token registration prompt) until after first paint.
- **Realtime/poll efficiency**: subscribe to `chat-<conversationId>` only for the open thread; run the 5s poll foreground-only; drop polling in favor of push + pull-to-refresh elsewhere to conserve battery/data.
- **Reuse the Skeleton family** (`SkeletonDashboard/RequestList/Chat/Billing/…`) as native loading blueprints so perceived performance matches the web's per-screen skeletons; render cached data first, then reconcile.

---

### 5.14 Open items to confirm before build

- **Billing/IAP**: whether Apple/Google permit external Stripe web checkout for digital subscriptions (anti-steering rules shifted 2024–2025). Default per locked decision: **read-only status + external "Manage on mortly.ca" hand-off**, no in-app pricing/checkout — this is the single biggest compliance risk to verify at submission.
- **Block/Unblock UI is net-new** (backend exists, no web UI, no i18n keys) and is required for Apple 1.2 — place block/unblock in the thread header + a "Blocked users" list in Settings (`GET /api/users/blocked`).
- **Language control**: the web has no in-app switcher by design; mobile needs its own — default to **device locale**, backed by the `preferences.locale` (`en`/`ko`) API and `DeviceToken.locale`. (Do not build a marketing-style switcher.)
- **Push preview opt-in**, per-conversation/global **mute**, and a **Notifications settings screen** (email/push toggles the `/api/preferences` API already validates but no web surface exposes) are mobile-first surfaces to design.

---

## 6. Implementation Guidance

This section specifies *how* to build the Mortly mobile app: repo layout, folder tree, shared-code boundaries, state/auth/API architecture, the three role navigators, the no-IAP billing hand-off, and the test + design-QA gates. It assumes the screen inventory, design tokens, and navigation model defined in earlier sections and does not re-derive them.

### 6.1 Guiding principles

1. **The Next.js `pages/api/*` routes are the backend.** The mobile app is a second client of an already-multiplatform API. No screen invents server behavior; every gate (entitlement, credits, embargo, RLS) is server-enforced and inherited for free.
2. **Reuse the pure `lib/*` modules; never port server-only ones.** `lib/tiers.ts` already documents itself as "dependency-free on purpose so it's safe to import into the client bundle." That boundary is the model for what mobile may share.
3. **Chat content is never read via the anon Supabase key.** Realtime carries only a content-free `sync` nudge on `chat-<conversationId>`; the app refetches through the authenticated `GET /api/conversations/[id]`. This is a launch-blocker-level security contract (RLS deny-all, verified by `npm run check:rls`) and the mobile client must honor it exactly.
4. **No in-app purchase, ever.** Billing is read-only in-app; all checkout/portal happens on `mortly.ca` in the system browser. Treat this as an architectural invariant, not a screen detail (§6.8).

### 6.2 Repository strategy: promote to a light monorepo

The web repo today is a single Next.js app (`package.json` name `mortgage-marketplace`) with all business logic under `lib/*` and locales under `public/locales/{ko,en}/common.json`. Rather than a hard fork (which guarantees drift on tiers, statuses, validators, and 385+ i18n keys the feature review already flagged as fragile), extract a **shared package** and add the mobile app as a workspace sibling.

Recommended target (npm/pnpm workspaces — keep it boring, no Nx/Turbo required at this size):

```
mortly/                         # repo root (workspaces)
├── apps/
│   ├── web/                    # the existing Next.js app (moved as-is)
│   └── mobile/                 # new Expo app
├── packages/
│   └── shared/                 # @mortly/shared — isomorphic, no next/prisma-runtime imports
│       ├── src/
│       │   ├── tiers.ts        # moved from lib/tiers.ts (already client-safe)
│       │   ├── requestConfig.ts# products/timelines/provinces/validators + label keys
│       │   ├── brokerEntitlement.ts  # checkBrokerCanMessage codes (pure predicate form)
│       │   ├── premiumAccess.ts# isExclusiveToPremium / window helpers (read-time flags)
│       │   ├── validate.ts     # assertString/assertPhone/LICENSE_RE (client mirrors)
│       │   ├── statusTones.ts  # Tone enum + tones.ts mapping tables
│       │   ├── errorCodes.ts   # NEW: sentinel + API code union (single source)
│       │   └── types.ts        # DTOs derived from Prisma (see §6.4)
│       └── locales/{ko,en}/common.json  # single source; web reads via next-i18next, mobile via i18next
└── package.json                # workspaces: ["apps/*","packages/*"]
```

**Migration is incremental and low-risk:** move `apps/web` first with a path alias (`@mortly/shared` → `packages/shared/src`) so web keeps compiling, then re-point the handful of already-pure `lib/*` imports. Server-only `lib/*` (`prisma.ts`, `stripe.ts`, `auth.ts`, `push.ts`, `notify.ts`, `settings.ts`, `withAuth.ts`, `rls.ts`) **stays in `apps/web/lib`** and is never referenced by `packages/shared` or `apps/mobile`. Guard this with an ESLint `no-restricted-imports` rule in `packages/shared` banning `@prisma/client`, `next/*`, `stripe`, `fs`.

If the team wants zero disruption pre-launch, the fallback is a **git submodule or a copied-and-linted `shared/` folder with a CI drift check** (a test that diffs `apps/mobile`'s copy of `tiers.ts`/`common.json` against web and fails on divergence). The workspace is strongly preferred because i18n key drift is already a known pain point.

### 6.3 Folder structure — Expo + expo-router

`expo-router` file-based routing mirrors the Pages Router mental model the team already lives in. Use **route groups** (`(group)` folders that don't appear in the URL) to model the three role stacks + auth + public, and a single root guard that swaps stacks by `session.user.role`.

```
apps/mobile/
├── app/                                  # expo-router routes
│   ├── _layout.tsx                       # Root: providers (Query, i18n, SessionGate, Theme), font load, splash
│   ├── index.tsx                         # Boot router: reads session → redirect to role/auth/onboarding
│   │
│   ├── (auth)/                           # unauthenticated stack (mirrors web /login,/signup,...)
│   │   ├── _layout.tsx                   # Stack, no tab bar
│   │   ├── login.tsx                     # signIn(credentials) → mint token; sentinel-code → t()
│   │   ├── signup.tsx                    # role toggle + legalVersion + terms
│   │   ├── verify-email.tsx              # 6-digit OTP (native autofill), resend cooldown
│   │   ├── forgot-password.tsx
│   │   ├── reset-password.tsx            # opened via universal link ?token=
│   │   ├── select-role.tsx              # POST /api/auth/select-role (x-mortly-mobile:1) → 30d token
│   │   └── name-entry.tsx               # NEW: needsNameEntry (Apple no-name) → PATCH /api/users/me
│   │
│   ├── (borrower)/                       # role stack — BORROWER
│   │   ├── _layout.tsx                   # Tabs: dashboard | messages | profile (BorrowerDataProvider)
│   │   ├── dashboard.tsx
│   │   ├── request/
│   │   │   ├── new.tsx                    # 3-step wizard (RequestForm ported to native stepper)
│   │   │   └── [id].tsx                   # detail + #responses hub (BrokerResponses)
│   │   ├── messages/
│   │   │   ├── index.tsx                  # conversation list
│   │   │   └── [conversationId].tsx       # thread (hides tab bar; composer owns bottom)
│   │   └── profile.tsx                    # settings + DeleteAccountSection
│   │
│   ├── (broker)/                         # role stack — BROKER
│   │   ├── _layout.tsx                   # Tabs: dashboard | requests | messages | More (BrokerDataProvider)
│   │   ├── onboarding.tsx                # first-run profile gate (skipProfileGate equivalent)
│   │   ├── dashboard.tsx                 # tier badge + credits chip + PAST_DUE banner
│   │   ├── requests/
│   │   │   ├── index.tsx                  # marketplace feed (infinite scroll, filter sheet)
│   │   │   └── [id].tsx                   # detail + "Use 1 credit" confirm (credit spend)
│   │   ├── messages/
│   │   │   ├── index.tsx
│   │   │   └── [conversationId].tsx
│   │   ├── billing.tsx                    # READ-ONLY tier/credits/renewal + "Manage on mortly.ca"
│   │   └── profile.tsx                    # avatar + verification pill + delete
│   │
│   ├── (admin)/                          # role stack — ADMIN
│   │   ├── _layout.tsx                   # Tabs: inbox | people | activity | reports | More (AdminDataProvider)
│   │   ├── inbox.tsx                      # queue: approve/reject requests, verify brokers, resolve reports
│   │   ├── people/
│   │   │   ├── index.tsx
│   │   │   └── [id].tsx                   # user detail + moderation action sheet
│   │   ├── activity/
│   │   │   ├── index.tsx
│   │   │   └── conversation/[id].tsx      # read-only transcript
│   │   ├── reports.tsx
│   │   ├── search.tsx                     # replaces Cmd+K palette (full-screen search)
│   │   └── more/                          # "More" sheet: geography, system
│   │       ├── geography.tsx              # default to List/RankBlocks; map opt-in
│   │       └── system.tsx                 # maintenance_mode + premium toggle only
│   │
│   ├── (legal)/                          # in-app webviews / native long-form
│   │   ├── privacy.tsx
│   │   └── terms.tsx
│   │
│   └── +not-found.tsx                     # native 404/empty
│
├── src/
│   ├── api/                              # typed client over pages/api (§6.6)
│   │   ├── client.ts                     # fetch wrapper: base URL, x-mortly-mobile, auth header, error mapping
│   │   ├── endpoints/                     # one file per resource: requests, conversations, brokers, stripe, admin...
│   │   └── queries/                       # TanStack Query hooks (useRequests, useConversation, ...)
│   ├── auth/
│   │   ├── SessionProvider.tsx           # token in SecureStore, /api/auth/session validation, revocation handling
│   │   ├── secureToken.ts                # expo-secure-store wrapper
│   │   └── oauth.ts                       # native Google/Apple SDK → /api/auth/mobile-oauth
│   ├── realtime/
│   │   └── useConversationSync.ts         # subscribe chat-<id>, refetch on 'sync', 5s poll fallback, AppState-aware
│   ├── push/
│   │   └── useDeviceRegistration.ts       # register/unregister DeviceToken, deep-link routing
│   ├── billing/
│   │   └── openManageBilling.ts           # expo-web-browser hand-off + return sync (§6.8)
│   ├── components/                        # native design-system primitives (UBadge/UBtn/UCard equivalents)
│   ├── theme/
│   │   ├── tokens.ts                      # Midnight & Gold hexes (ported verbatim from tailwind.config.ts)
│   │   └── nativewind.config / tailwind.config.js  # NativeWind maps the same tokens
│   ├── i18n/
│   │   └── index.ts                       # i18next init, locale from device/pref, common.json
│   └── store/
│       ├── ui.ts                          # Zustand: transient UI (composer draft, filter chips, sheets)
│       └── session.ts                     # derived session snapshot for non-React reads
├── app.json / app.config.ts               # scheme "mortly", universal links, bundle IDs
└── package.json
```

Notes:
- **Route groups map 1:1 to the web shells.** `(borrower)/_layout.tsx` = `BorrowerShell` gate + `MobileTabBar`; `(broker)` = `BrokerShell`; `(admin)` = `AdminShell`. Each group layout mounts its existing data/badge context (`BorrowerDataProvider`/`BrokerDataProvider`/`AdminDataProvider` shapes, reused as view-models).
- **Chat detail as its own route** (`messages/[conversationId].tsx`) makes "hide the tab bar in chat" trivial — it's a pushed screen outside the tab layout, exactly what `hideMobileTabBar` emulated on web.
- **Deep-linking** for push (`{type, conversationId|requestId}`) and universal links (reset-password `?token=`) is native to expo-router route params.

### 6.4 Shared vs NOT-shared logic

| Category | Share via `@mortly/shared` | Keep web-only (`apps/web`) | Reimplement natively (mobile) |
|---|---|---|---|
| Tier/credit constants | `tiers.ts` (`TIER_RANK`, `TIER_PRICING`, `creditLabel`, `isUpgrade`) | Stripe price mapping (`stripe.ts`), `settings.ts` DEFAULTS | — |
| Request domain | `requestConfig.ts` (products, `INCOME_TYPES`, `TIMELINE_OPTIONS`, `PROVINCES`, validators, `getRequestTitle`) | — | Wizard UI/stepper (RequestForm is 39KB DOM) |
| Entitlement | `brokerEntitlement` codes + predicate | server-side charge/decrement (Serializable tx) | credit-confirm UX only |
| Premium embargo | `premiumAccess` read-time flags (`isPremiumExclusive`, `premiumWindowEndsAt`) | release cron | perk/teaser cards |
| Status → color | `statusTones.ts` (Tone enum + maps) | — | Native badge component consuming tones |
| Validation | `validate.ts` mirrors (client pre-checks) | authoritative server validation | native form error rendering |
| Error codes | `errorCodes.ts` union (sentinel + API) | — | code → `t()` mapping table |
| i18n copy | `locales/{ko,en}/common.json` | next-i18next config | i18next init, device-locale selection |
| Types/DTOs | hand-authored or `prisma-generated` DTO types (see below) | Prisma runtime client | — |
| SSR / routing | — | `getServerSideProps`, `adminSSR`, redirect shims | expo-router equivalents |
| Styling | design **tokens** (hex/spacing/radius) | Tailwind web classes, `globals.css`, grain-overlay, `html[lang]` override | NativeWind classes + bundled fonts |
| Auth transport | sentinel-code contract | NextAuth cookie/session strategy | SecureStore + Bearer token |

**Types strategy:** do **not** import `@prisma/client` into mobile (pulls runtime). Instead generate a types-only module — either `prisma generate` with a **types-only** generator whose output lives in `packages/shared/src/prisma-types.ts`, or hand-mirror the enums that matter (`Role`, `UserStatus`, `SubscriptionTier`, `SubscriptionStatus`, `RequestStatus`, `VerificationStatus`, `ReportStatus`, `ConversationStatus`). API response DTOs should be defined in `@mortly/shared` and (ideally) validated at the API boundary with a shared `zod` schema so both web and mobile parse identically. Since the web currently uses hand validation (`lib/validate.ts`) rather than zod, adopting zod in the shared package for **DTO parsing on mobile** is a pragmatic incremental step that doesn't require rewriting the API.

**Explicitly NOT shared:** anything importing `next/*`, `next-auth`, `stripe`, `@prisma/client` runtime, `document`/`window`, Tailwind web utility classes, `react-easy-crop`, the `grain-overlay` SVG, `::selection`/`backdrop-blur` CSS, and the `html[lang="ko"] * !important` font swap (do locale font selection in JS on mobile).

### 6.5 State management

**Server state → TanStack Query (React Query).** The web uses SWR; mobile should use TanStack Query for its stronger mutation/invalidation/`AppState` refetch story and mature RN support. Model the existing per-area providers as query groups:

| Web source | Mobile query | Refresh trigger |
|---|---|---|
| `BorrowerDataProvider` (30s poll) | `useBorrowerCounters` (`/api/requests`, `/api/messages/unread`, `/api/conversations`, `/api/borrowers/profile`) | app-focus refetch + push-driven invalidate + pull-to-refresh (drop the 30s poll to save battery) |
| `BrokerDataProvider` | `useBrokerProfile`/`useBrokerCounters` | same |
| `AdminDataProvider` (60s badges) | `useAdminQueue` (`GET /api/admin/queue`), `useAdminBadges` | foreground + post-mutation `invalidate()`; admin badges may keep a slow poll since admins act on freshness |

Conventions: query keys namespaced by role + resource + params (`['broker','requests',{province,page}]`); mutations call `queryClient.invalidateQueries` on the affected keys (mirrors web's `invalidate()`/`refreshBrokerData()`); optimistic updates for message send + read-marking with rollback (web already does optimistic send + dedupe-by-id — replicate strictly).

**Client state → Zustand (thin).** Only truly ephemeral, non-server state: composer draft text per conversation, active filter chips, open bottom-sheet, wizard step + in-progress request draft (persist the draft with `AsyncStorage`/`expo-secure-store` middleware so a backgrounded app doesn't lose it — the web `sessionStorage` `mortly:request-form-draft` behavior). Chat disclaimer acceptance and "premium perk seen" flags → `AsyncStorage`. Do not mirror server data into Zustand.

**Auth/session → `SessionProvider` + `expo-secure-store`.**
- Token acquired from `/api/auth/mobile-oauth` (OAuth) or the credentials path, and refreshed to a **30-day JWT** by `/api/auth/select-role` (`x-mortly-mobile:1`). Store it **only** in `expo-secure-store` (Keychain/Keystore), never `AsyncStorage`.
- Attach as `Authorization: Bearer <token>` (or the header the mobile-oauth path expects) plus `x-mortly-mobile: 1` on every request (the header both routes CSRF-bypass and triggers the 30-day token minting).
- **Revocation handling:** the server's `tokenVersion`/`status` gate can invalidate a JWT mid-session within ~5s (password change elsewhere, admin SUSPEND/BAN, deletion). The client must treat a `null`/401 from `/api/auth/session` or any 401 as "session revoked" → clear SecureStore → route to `(auth)/login`. There is **no refresh-token endpoint**, so on 30-day expiry the user simply re-authenticates; surface this gracefully.
- `needsRoleSelection` → route to `select-role`; `needsNameEntry` (Apple no-name) → route to the new `name-entry` screen and block role dashboards until a name is set (PATCH `/api/users/me` returns a fresh token on mobile).

### 6.6 API integration

**Typed client (`src/api/client.ts`).** A single `fetch` wrapper that:
1. Prefixes the production base URL (`https://mortly.ca`), injects `x-mortly-mobile: 1`, `Authorization`, and `Accept-Language`/locale.
2. Parses JSON DTOs (optionally zod-validated in dev).
3. Normalizes errors into a typed `ApiError { httpStatus, code, message, retryAfter? }` and throws it, so React Query `onError` and screens map on `code`, never on prose.

**Sentinel/API code handling (`errorCodes.ts` + a `t()` map).** Centralize the full union so every screen maps codes to localized copy consistently:

| Domain | Codes | UX |
|---|---|---|
| Auth (login) | `MISSING_CREDENTIALS`, `INVALID_CREDENTIALS`, `GOOGLE_ACCOUNT`, `EMAIL_NOT_VERIFIED` (→ push to verify-email), `ACCOUNT_SUSPENDED`, `ACCOUNT_BANNED`, `RATE_LIMITED` | inline banner / redirect |
| Requests | `ACTIVE_REQUEST_CAP`, `EDIT_LOCKED_BY_CONVERSATIONS`, `CLOSE_INVALID_STATUS`, `REQUEST_NOT_OPEN` | inline warning; pre-warn banners |
| Conversations/msg | `UPGRADE_REQUIRED`, `NO_CREDITS`, `SUBSCRIPTION_PAST_DUE`, `PREMIUM_EXCLUSIVE`, `CONVERSATION_CLOSED`, `BROKER_NOT_VERIFIED` | first-class gate screens (verification-pending, upgrade, 0-credits, past-due, exclusive) → CTA to billing hand-off |
| Billing | `SUBSCRIPTION_NEEDS_ATTENTION` | "fix payment on mortly.ca" |

**Supabase Realtime client (`useConversationSync`).** `@supabase/supabase-js` runs in RN. Subscribe to `supabase.channel('chat-<conversationId>').on('broadcast',{event:'sync'}, …)`; on a nudge, `invalidateQueries(['conversation', id])` (authenticated refetch) — **never read `messages`/`conversations` tables with the anon key** (RLS deny-all). Backstops: a 5s poll while the thread is foregrounded and a refetch on `AppState` `active`. Subscribe on screen focus / foreground, unsubscribe on blur / background. Guard for `isSupabaseConfigured === false` (Realtime silently disabled → poll is the only path; the app must not hard-depend on the socket).

**Push (`useDeviceRegistration`).** On login and on locale change, obtain the Expo token and `POST /api/notifications/register-device {token, platform, locale, deviceName, appVersion}`; `DELETE` on logout. Handle the 409 token-hijack case (token bound to another user) by prompting re-login. Route push `data.type` → the matching route; drive the OS app-icon badge and tab badges from `/api/messages/unread` (respect the `9+` cap). Keep OS notification bodies generic (server already defaults to privacy-safe "New message").

### 6.7 The three role-based navigators

One app, role chosen post-login (exactly like web). The root `app/index.tsx` reads the validated session and `router.replace`s into the correct group:

```
role === 'BORROWER' → /(borrower)/dashboard
role === 'BROKER'   → broker.profileExists ? /(broker)/dashboard : /(broker)/onboarding
role === 'ADMIN'    → /(admin)/inbox
needsRoleSelection  → /(auth)/select-role
needsNameEntry      → /(auth)/name-entry
no session          → /(auth)/login
```

Each group `_layout.tsx` is the single **session guard + role check** (consolidating the duplicated web shell gates) and mounts that role's tab bar + data provider:

| Group | Primary tabs | "More" sheet | Notes |
|---|---|---|---|
| `(borrower)` | Dashboard, Messages, Profile | Sign out | badges: activeRequests, unreadMessages |
| `(broker)` | Dashboard, Requests, Messages, More | Profile, Billing, Sign out | tier label + credits chip in header; PAST_DUE banner |
| `(admin)` | Inbox, People, Activity, Reports | Geography, System, Sign out | matches web's 4-primary + demote split; urgent (inbox/reports) badges in `error-600` |

Because there is no in-app language switcher by design, the group layouts expose **no** locale toggle in the app-authenticated area; locale follows device/`preferences.locale` and is set once at i18n init.

### 6.8 Billing hand-off — no in-app purchase

This is the highest-compliance-risk area and must be implemented conservatively.

- **In-app is strictly read-only.** `(broker)/billing.tsx` renders current tier (`FREE`/`BASIC`/`PRO`/`PREMIUM`), monthly credits + usage, renewal date, and a `PAST_DUE` banner from `/api/brokers/profile` + `/api/tier-credits`. **No prices as purchasable options, no plan cards with a "Buy" button, no checkout webview.** (Showing the informational `TIER_PRICING` table as *status/comparison* is acceptable; wiring it to purchase is not.)
- **Hand-off (`openManageBilling.ts`):** the single "Manage on mortly.ca" action opens the **system browser** via `expo-web-browser` `openBrowserAsync` (or `Linking.openURL`) to a `mortly.ca` billing entry URL. Never `WebView`, never an in-app payment sheet, never Stripe PaymentSheet. The web handles Stripe Checkout/Portal/upgrade/downgrade/resume/payment-method.
- **App/Play review posture:** this is a "reader"/multiplatform-SaaS app that honors entitlements purchased elsewhere; only brokers pay, borrowers/admins never see billing. **Anti-steering nuance to verify at submission:** rules on linking out to external purchase shifted 2024–2025 and remain platform- and region-specific. Default to the conservative read-only status + external hand-off with no in-app pricing/CTA-to-buy. Do a review pass before submission and keep the hand-off behind a remote-config flag so it can be softened (e.g. "manage your subscription" wording, no price) if review pushes back.
- **Entitlement sync on return:** `expo-web-browser` resolves when the browser dismisses. On resolve (and on next `AppState` `active`), `invalidateQueries` for `brokerProfile` + `tierCredits` so tier/credits/PAST_DUE reflect the Stripe-driven change. Do not poll for 15s like web; rely on refetch-on-return plus the webhook + push (recommend adding a push on `payment_failed`/downgrade-applied so the app learns of state changes even without a return trip). Never write subscription state client-side — Stripe + the webhook remain the single source of truth.

### 6.9 Testing strategy

| Layer | Tool | What it covers |
|---|---|---|
| **Unit** | Vitest/Jest | `@mortly/shared` purity: `tiers` (rank/creditLabel/`-1` unlimited), `requestConfig` validators, `premiumAccess` window math, entitlement predicate, error-code → `t()` mapping. These are the highest-ROI tests and run identically for web + mobile. |
| **Component** | React Native Testing Library + jest-expo | Screens with mocked API: request wizard step gates, credit-confirm sheet ("Use 1 credit" cannot fire on single tap), gate screens (verification-pending, upgrade, past-due, PREMIUM_EXCLUSIVE), chat optimistic-send dedupe, OTP entry, DeleteAccountSection two-step + password branch. Mock the typed client, not `fetch`. |
| **Realtime/contract** | RNTL + a fake Supabase channel | `sync` nudge triggers exactly one authenticated refetch; 5s poll fallback fires when Realtime unconfigured; AppState background unsubscribes. |
| **E2E** | **Maestro** (preferred) | Cross-platform YAML flows on real/simulated devices: login (credentials + sentinel error), Google/Apple OAuth stub, borrower create-request → PENDING_APPROVAL, broker spend-credit → conversation, chat send/receive, billing hand-off opens system browser + returns, account deletion, deep-link from push into the right thread, maintenance-gate screen. Maestro over Detox for lower flake and simpler CI; Detox only if a native-module edge needs it. |
| **Auth/security regression** | scripted + manual | Verify the app cannot read `messages`/`conversations` via anon key (attempt a direct table read → expect deny); confirm `x-mortly-mobile` header present on all mutations; confirm SecureStore (not AsyncStorage) holds the token; confirm 401 → session clear. |

CI: run unit + component on every PR (fast), Maestro on a nightly/pre-release matrix (iOS + Android). Add the **drift check** test from §6.2 (mobile shared copy vs web) to the PR gate if not using the workspace.

### 6.10 Design-QA checklist

Ship-gate for each screen (owned by the design + engineering DoD, aligning with the existing i18n/tests/verify workflow):

- **Tokens:** colors resolved from the ported Midnight & Gold `tokens.ts` (forest `#0f1729`, cream `#faf8f3`/`#f0eeea`/`#f8f7f4`, amber `#c49a3a`, sage `#9ea6bd`); **no** hardcoded hexes; `amber`/`sage` are the overridden values (amber-500 = gold `#c49a3a`, not default `#f59e0b`).
- **Radius:** `rounded-sm` (sharp) everywhere; `rounded-full` only for avatars + count pills. No `xl/lg/2xl` (legacy drift).
- **Fonts:** Outfit (display/body) + Noto Sans KR/Pretendard (KO) + mono bundled as local assets (no CDN `<link>`); Korean renders the KR face, mono labels stay mono in both locales.
- **Touch targets:** ≥44×44; tab items ≥56px; pressed state via Pressable opacity/scale (native equivalent of `active:scale-[0.99]`).
- **Safe areas:** composer + bottom sheets honor `safe-area-inset-bottom`; chat detail hides the tab bar and the composer owns the bottom edge.
- **Bilingual:** every string from `common.json` (ko + en); Korean is default; no orphaned/hardcoded copy (the review flagged 385 missing keys — verify none regress).
- **States:** each screen renders loading (skeleton), empty, and error variants; error+cached distinguishes from empty (don't show "create your first request" during an outage).
- **Motion:** respect OS reduce-motion; slide-up sheet ~0.22s parity.
- **Status-bar/splash:** reconcile the `#1B3A2D` (legacy green) vs `#0f1729` (navy) drift — pick navy for native chrome.
- **Badges:** `9+` cap in tab bar / OS icon; urgent admin badges in `error-600`.
- **Billing:** no purchasable price/CTA in-app; only status + external hand-off (compliance line item).

### 6.11 Tooling & config summary

- **Expo (latest SDK), TypeScript strict**, expo-router, **NativeWind** (maps the same tailwind tokens so classes and hexes match web), `@tanstack/react-query`, `zustand`, `expo-secure-store`, `expo-web-browser`, `expo-notifications`, `@supabase/supabase-js`, `i18next`/`react-i18next`, native Google/Apple sign-in modules.
- **`app.config.ts`:** scheme `mortly://`, associated domains / intent filters for universal links (`mortly.ca/reset-password`, push deep links), bundle IDs already reflected server-side (`app.mortly.mobile`, `app.mortly.mobile.signin` for Apple audience; `GOOGLE_IOS_CLIENT_ID` for Google).
- **Environments:** point at production `mortly.ca` by default; use an EAS build profile / remote config to swap the API base and the billing hand-off URL, and to toggle the anti-steering wording flag.
- **Rollout order:** (1) workspace extraction + `@mortly/shared` + drift CI; (2) auth (mobile-oauth, credentials, secure token, session guard, select-role/name-entry); (3) borrower stack (dashboard, request wizard, chat + realtime, push); (4) broker stack (feed, credit-spend, chat, read-only billing hand-off); (5) admin stack (inbox/reports first — the on-the-go value); (6) block/unblock UI (net-new, required for App Store 1.2) and a notification-preferences screen (backend `/api/preferences` exists, no UI yet). Ship borrower + broker to review before admin if timelines compress.

---

## 7. Risks & Open Questions

### Top risks (ranked)

| # | Risk | Impact | Mitigation / decision needed |
|---|------|--------|------------------------------|
| R1 | **App Store anti-steering / IAP rules** for the web-billing hand-off | App rejection or forced 30% IAP | Ship as a "multiplatform SaaS" app: subscriptions bought on web are honored in-app; in-app billing is read-only. Default to a conservative posture (status + external "Manage on web", **no in-app pricing/checkout copy that steers**). Verify current guidelines at submission; consider Apple's External Purchase Link Entitlement / Google's alternative-billing where the modest link-out is worth it. **Decide the exact "manage" CTA wording + whether to show prices in-app.** |
| R2 | **Mobile auth/session model** — NextAuth is cookie/JWT web-first | Blocks everything | The web already has `pages/api/auth/mobile-oauth.ts` (Apple/Google) but a **credentials (email/password) mobile login path + a long-lived session token stored in SecureStore/Keychain** is needed. Reuse `tokenVersion` for "log out everywhere". Confirm token format the API will accept (Bearer vs cookie) and refresh strategy. |
| R3 | **Supabase Realtime auth on device** | Broken/insecure chat | The RLS relies on the user's identity; the mobile client must pass a valid Supabase JWT (or the app's session) so RLS scopes rows correctly. Confirm how the web mints the realtime token and replicate it for RN. |
| R4 | **Financial-services app review** | Delays, extra disclosures | Mortgage/financial apps draw scrutiny (licensing claims, "not a lender" disclaimers, data handling). Prepare privacy nutrition labels / Data Safety form, demo admin+broker accounts for reviewers, and clear disclaimers. |
| R5 | **Push notification setup** (APNs + FCM via Expo) | No re-engagement | Server already targets `DeviceToken`; wire Expo push tokens on device, permission priming, and categories/deep links. Decide notification preferences granularity. |
| R6 | **Korean + Latin typography in RN** | Brand/legibility regressions | Bundle Outfit + Noto Sans KR; verify line-height/letter-spacing parity and dynamic-type behavior for mixed ko/en strings. |
| R7 | **Offline & flaky-network chat** | Lost/duplicated messages | Optimistic send + idempotent retry queue; cache last-N conversations; clear "sending/failed/sent" states (mirror how the web handles it). |
| R8 | **OTA update + versioned API** | Silent breakage | Use EAS Update for JS-only fixes; version the API contract and gate on minimum-supported-app-version to force upgrades when the server changes. |
| R9 | **Deep-link security** | Spoofed navigation | Validate deep-link targets against the session role; never trust a link to bypass a role/verification gate. |

### Open questions

**All product questions resolved (2026-07-01):**
1. ~~Billing CTA policy~~ → **status-only, neutral copy** (no prices/steering).
2. ~~Mobile auth~~ → **yes**: credentials endpoint + mobile JWT in Keychain/Keystore, `tokenVersion` logout, optional biometric unlock.
3. ~~Admin v1 scope~~ → **moderation-first** (inbox approve/reject/resolve + read-only context + push; management deferred to web).
4. ~~Repo shape~~ → **monorepo** (`apps/web` + `apps/mobile` + `packages/core`); extract `packages/core` first as the low-risk path.
5. ~~Borrower on mobile~~ → **full peer** (create requests + chat + browse at launch).
6. ~~Notifications granularity~~ → **per-category toggles + a master switch**: New response · New message · Request status (approved/rejected/expired) · New matching request (broker) · Admin alerts.
7. ~~App identity~~ → **one app, both stores** (single Expo codebase → App Store + Google Play), listing "Mortly" (bilingual KR/EN). **No** role-specific install onboarding — role is resolved at login and the app adapts post-auth.

*(A fuller list of facet-level open questions surfaced during the codebase audit is appended at the end.)*

---

## 8. Prioritized Build Order

Sequenced to ship **borrower + broker marketplace value first** (the revenue/marketplace core), with admin as a strong fast-follow (admins already have the responsive web). Each phase is independently shippable to TestFlight / internal track.

### Phase 0 — Foundation (1–2 wks)
Expo app + expo-router skeleton · NativeWind wired to the exact `tailwind.config.ts` tokens · shared `core` package (types, i18n JSON, tier/credit constants, validation) · **auth/session** (mobile credentials + OAuth via existing endpoints, SecureStore token, `tokenVersion` logout) · typed API client + error/sentinel handling · Supabase Realtime client with device auth · base design-system primitives (Button, Input, Card, Sheet, Toast, Tab bar, Header, states).

### Phase 1 — Auth & Onboarding (1 wk)
Splash/welcome · login (email + Apple + Google) · signup → **6-digit email verification** → role select · forgot/reset password · **broker onboarding** (multi-step + license + avatar) · borrower first-run. *Exit: any user can create an account and land on the right role home.*

### Phase 2 — Borrower core (1.5–2 wks)
Borrower dashboard · **create-request long-form** (the multi-field mortgage request; numeric keypads, inline validation, draft autosave) · my-requests + request detail (status lifecycle + responses) · browse brokers + broker profile · **messages list + realtime chat**. *Exit: a borrower can post a request and chat once approved.*

### Phase 3 — Broker core (1.5–2 wks)
Broker dashboard (KPIs + verification + **read-only plan/credits**) · verification/onboarding status · **browse requests** (premium-embargo + credit gating states) · request detail → respond/start conversation · chat · **profile edit + avatar (JPEG crop, camera/library)** · **read-only Subscription screen + "Manage on mortly.ca" external hand-off**. *Exit: a verified broker can find requests, respond within entitlement, chat, and see their plan.*

### Phase 4 — Notifications & polish (1 wk)
Expo push tokens + permission priming · deep links into request/chat/report · notification preferences · offline/retry for chat · empty/error/loading polish · accessibility pass (dynamic type, VoiceOver/TalkBack, 44pt targets). *Exit: re-engagement works; app feels finished.*

### Phase 5 — Admin app · **moderation-first** (~1 wk)
Scope per the resolved decision: Moderation **inbox** (approve/reject brokers + resolve reports, reason entry, confirm on destructive actions) · **read-only** context views (user/broker/request/conversation detail) · admin push alerts (new report, broker awaiting verification). **Deferred to web (not in v1 app):** user mutations (suspend/ban/adjust-credits), create-admin, system settings, geography maps. *Exit: admins can triage verifications + reports from the phone; heavy management stays on the responsive web.*

### Phase 6 — Hardening & store submission (1 wk)
Offline resilience · performance (list virtualization, image caching) · EAS Update channel · privacy labels / Data Safety · **compliance review of the billing hand-off (R1)** · reviewer demo accounts + disclaimers · screenshots/metadata · TestFlight/closed-track beta → phased rollout.

> **Rough order-of-magnitude: ~8–10 focused weeks to a polished v1** across the three roles, front-loaded on the borrower↔broker marketplace. Admin (Phase 5) can be pulled earlier if moderation volume demands it, since much of its API surface already exists.

---

## Appendix — Facet-level open questions from the codebase audit

_Surfaced by the recon agents while mapping the live app; triage alongside §7._

- **[routes-nav]** Does the mobile app include the public marketing pages (/, for-borrowers, for-brokers, how-it-works, pricing, contact) and legal pages (privacy, terms), or only the authed app + admin?
- **[routes-nav]** Since there is no in-app language switcher by design (marketing-only), how does a mobile app user change language — OS locale only, or is a settings toggle needed for the app?
- **[routes-nav]** Web /pricing is broker-gated (borrowers redirected away, anonymous -> /signup?role=broker); should mobile pricing/plan-management be its own tab or live inside broker billing?
- **[routes-nav]** Admin has 6 destinations but only 4 become mobile primary tabs (system+geography in 'More') — confirm that split is acceptable for the native admin experience.
- **[routes-nav]** Notification delivery: keep 30s polling of /api/notices + /api/messages/unread, or fully switch mobile to push via the existing register-device endpoint?
- **[routes-nav]** The ⌘K admin CommandPalette has no obvious mobile analog — what interaction replaces it (dedicated search tab, header search, FAB)?
- **[routes-nav]** Do redirect-only web routes need URL/deep-link parity on mobile (universal links) or can they be dropped?
- **[routes-nav]** borrower 'profile' and broker 'profile' are settings/account screens that also host DeleteAccountSection — confirm whether account deletion + Stripe portal (broker billing) belong in a native Settings tab.
- **[design-system]** Public StatusBadge.tsx and admin tones.ts disagree on OPEN and IN_PROGRESS tones (OPEN: accent vs success; IN_PROGRESS: warn vs info). Which mapping should the mobile app adopt as canonical?
- **[design-system]** Should the mobile app fix the theme-color / brand color drift (#1B3A2D green vs forest-800 #0f1729 navy), or is the green intentionally retained anywhere?
- **[design-system]** Fonts: is bundling Outfit + Pretendard licensed for app distribution, or should mobile fall back to system fonts (SF Pro / system Korean) for the display/body roles?
- **[design-system]** The design system lives under components/admin/primitives/* and is re-exported via components/ui — is there an intent to extract a shared cross-platform token/package (the index.ts comment anticipates this) that mobile should consume rather than re-declaring hex values?
- **[design-system]** No dark-mode token set exists (forest is ink, not a dark theme); does mobile need a dark mode, and if so what surface/ink inversions apply?
- **[auth-onboarding]** No dedicated web name-entry screen exists for needsNameEntry (Apple no-name) — is the intent that ONLY mobile handles this, and should mobile block the dashboard until a name is set?
- **[auth-onboarding]** There is no borrower onboarding/first-run flow at all — confirm mobile should also send borrowers straight to the dashboard (no profile capture).
- **[auth-onboarding]** Email templates use a legacy dark-green brand (#1f3528 / #faf8f3) that diverges from the current navy tailwind palette — should mobile-triggered emails be rebranded first, or match web-as-is?
- **[auth-onboarding]** The 'forest'/'sage' color names are navy hexes (Midnight & Gold) — confirm the mobile design system should adopt the hex values (navy) and not the misleading token names.
- **[auth-onboarding]** Web sessions are 7-day JWT cookies while mobile/select-role mint 30-day JWTs — confirm 30 days is the desired mobile session lifetime and how refresh/rotation should work (no refresh-token endpoint exists).
- **[auth-onboarding]** verify-email endpoint has NO explicit success rate limit beyond the attempt/IP caps and does not require an authenticated session — is the code+email pair considered sufficient for mobile too?
- **[auth-onboarding]** License number is free-text/optional and NOT verified against any registry (verificationStatus stays PENDING) — does mobile onboarding need the same, or an added upload/verification step?
- **[auth-onboarding]** Phone is collected as +1 (CA/US) only in the UI though server accepts any E.164 — should mobile support international numbers?
- **[borrower-features]** Where is the OPEN -> IN_PROGRESS transition triggered? IN_PROGRESS is a valid 'active' status (counted active, allows conversations, referenced by auto-close-conversations cron) but no OPEN->IN_PROGRESS write was found in /api/requests or /api/conversations creation — it may be admin-set only or set elsewhere. Confirm the trigger for the mobile lifecycle model.
- **[borrower-features]** Borrower-initiated conversations are implemented server-side (/api/conversations POST with role BORROWER + brokerId) but there is NO borrower UI to browse/pick a broker (the /borrower/brokers route is only a redirect). Should mobile expose a broker-browse/direct-contact flow, or keep discovery reactive (respond-only) like web?
- **[borrower-features]** PREMIUM early-access embargo is dark-launched (premium_early_access_enabled=false). Does the mobile borrower experience need any awareness of it, or is it purely broker-facing?
- **[borrower-features]** Only status=CLOSED is accepted on the borrower PUT; borrowers cannot reopen. Confirm there is no borrower-facing reopen path for CLOSED/EXPIRED (they must create a new request).
- **[borrower-features]** Request detail (request/[id]) fetches directly and does not subscribe to realtime — status/response changes require a manual reload. Should native poll or subscribe for live status/response updates?
- **[broker-features]** Where/when are responseCredits actually granted per tier (basic=5/pro=20)? Only DEFAULTS + Stripe webhook were inferred; the exact top-up/reset logic on subscription change lives outside the read broker pages (likely /api/webhooks or /api/stripe) and should be confirmed for the mobile billing facet.
- **[broker-features]** Credits appear to be per-billing-period allotments, not monthly refills or purchasable packs — the 'buy more credits' copy (broker.noCreditsSubtitle) implies a purchase path; confirm whether an à-la-carte credit purchase exists (api/credits dir + /broker/billing) since it affects the mobile respond flow.
- **[broker-features]** PREMIUM early-access is dark-launched (premium_early_access_enabled=false) — confirm whether it will be ON at mobile launch, since it changes the requests feed contract (isPremiumExclusive, PREMIUM_EXCLUSIVE 403s).
- **[broker-features]** The broker's own /broker/profile is an EDIT page, not a public profile — there is no standalone public broker profile route; borrowers only see brokers via BrokerResponses after a conversation. Confirm mobile doesn't need a dedicated public broker-profile screen.
- **[broker-features]** Settings (broker.nav.settings key exists in BrokerShell but no /broker/settings page was found in pages/broker) — confirm whether a settings screen exists or is planned.
- **[billing]** App Store / Play Store policy: can the mobile app use Stripe web Checkout for digital subscriptions, or is native IAP (Apple/Google) mandatory? This is the biggest unknown and affects the entire purchase/upgrade/downgrade flow.
- **[billing]** If native IAP is required, how do Apple/Google receipt validation and their own proration/downgrade semantics reconcile with the Stripe-driven tier/credit ledger and the webhook state machine (which currently assumes Stripe is the single source of truth)?
- **[billing]** Should the Stripe Billing Portal (cancel + update payment) run in a WebView on mobile, or does cancel/payment-method management need a native re-implementation via Stripe SDK?
- **[billing]** Should PAST_DUE / payment-failed and downgrade-applied events also fire push notifications on mobile (currently only email + in-app AdminNotice)?
- **[billing]** No in-app language switcher exists (marketing-site-only per project convention) — confirm mobile billing copy just follows device/app locale for the KO/EN bilingual strings.
- **[billing]** Does mobile need to display the PREMIUM early-access perk/countdown differently, and should it surface premiumWindowEndsAt as a live countdown (helper exists but web doesn't render it)?
- **[messaging-notifications]** No web UI currently calls the block/unblock endpoints (POST/DELETE /api/users/[publicId]/block) or renders GET /api/users/blocked, and there are no block i18n keys — is Block a mobile-only surface to build, and where should it live (thread header? profile?) for Apple 1.2?
- **[messaging-notifications]** Push preview: schema/comments reference preferences.pushPreviewEnabled but it is never threaded through sendPushToUsers (always generic body). Does mobile want to implement per-recipient opt-in previews, and where is the toggle?
- **[messaging-notifications]** There is no per-conversation or global mute in the app beyond DeviceToken.mutedUntil (which nothing currently sets) — should mobile add mute controls, and should they be per-device or per-user?
- **[messaging-notifications]** Web has no dedicated notifications/settings screen for managing device tokens or push preferences — mobile will need one; what belongs there (push on/off, mute, preview, blocked users)?
- **[messaging-notifications]** Realtime uses the anon key over an HTTP broadcast endpoint with no per-topic authorization (security relies on the conversation id being an unguessable cuid) — is that acceptable for mobile, or should broadcasts be authenticated/RLS-authorized on the channel?
- **[messaging-notifications]** AdminNotice bell notices are plain subject/body strings with no type/category or deep-link/CTA field (only push carries pushData.type) — should mobile notices carry a structured type + deep link for tap-through?
- **[messaging-notifications]** No read receipts or typing indicators exist — are they in scope for the mobile chat experience?
- **[messaging-notifications]** Only borrowers can close conversations from the client; should brokers get a close/archive action on mobile?
- **[messaging-notifications]** vercel.json only declares the /api/cron/daily job (Hobby 2-cron limit) — confirm the production cron actually fires daily for auto-close/expire, since mobile UX depends on stale threads closing.
- **[messaging-notifications]** Message edit/delete and attachments/images are not supported (text-only, VarChar(5000)) — is that a deliberate mobile constraint too?
- **[settings-account-crosscutting]** There is no notification-preferences screen in the web app even though /api/preferences validates emailNotifications/pushNotifications and DeviceToken has pushEnabled — is the mobile app expected to be the first surface to expose these toggles, and should email vs push be independently controllable?
- **[settings-account-crosscutting]** Should mobile expose an explicit in-app language switcher (contradicting the web 'marketing-only' rule), follow device locale, or write the 'locale' preference? DeviceToken.locale only accepts en/ko.
- **[settings-account-crosscutting]** 'Log out everywhere' is described in code comments as a '(future)' explicit user action — is there a plan to add a user-facing button, and should mobile ship it?
- **[settings-account-crosscutting]** Theme preference (light/dark/system) is validated by /api/preferences but no web UI or Tailwind dark-mode wiring was found — is dark mode in scope for mobile?
- **[settings-account-crosscutting]** Broker profile has no password change and no email change; is a mobile 'Security' section expected to link out to /forgot-password, or should a broker password-change endpoint be added?
- **[settings-account-crosscutting]** Should mobile enforce/collect legal acceptance (CURRENT_LEGAL_VERSION) at signup the way OAuth does, and how is re-acceptance handled when the version bumps?
- **[settings-account-crosscutting]** The web account-deletion OAuth path only requires a typed ack (comment notes a 'future hardening pass should require a fresh OAuth round-trip') — should mobile require a real re-auth (Sign in with Apple/Google) before deletion?
- **[settings-account-crosscutting]** Notifications list is populated only by AdminNotice rows (admin-sent); are transactional events (new message, request approved, plan changes) meant to become in-app notices too, or stay push-only?
- **[admin]** Admins currently get zero real-time signal (no push, no in-app). Which events warrant a mobile push, and should priority (<2h) items escalate differently? Confirm desired push policy.
- **[admin]** Should destructive mobile actions (ban, maintenance_mode, create-admin) be allowed on mobile at all, or desktop-only? create-admin needs a typed 'CREATE_ADMIN' ack today.
- **[admin]** /admin/conversations/[id].tsx (full conversation page) and /admin/brokers/[id].tsx were not read in depth — confirm the standalone broker page is fully retired (its actions appear folded into users/[id]).
- **[admin]** Is there an existing mobile admin client already consuming /api/admin/queue (referenced as lib/api.ts adminGetQueue)? Confirm scope overlap before rebuilding.
- **[admin]** Two-admin verification gate is env-flagged off by default — will the mobile app run against a deployment where it's on? UX differs (RECOMMEND vs VERIFY).
- **[admin]** CSV/export buttons across admin pages are disabled placeholders — out of scope for mobile?
- **[admin]** Trends/audit-log tabs are thin (Manual tab is a placeholder) — include on mobile or defer?
- **[admin]** Should the geography interactive map be dropped entirely on phones, or is a simplified bubble map still desired?
