# Mortly Mobile — Phase 0 (Foundation) Task Breakdown

_Version 1.0 · 2026-07-01 · Companion to `MOBILE_APP_PLAN.md` (§6, §8)_

> **Goal of Phase 0:** a runnable Expo dev-client app where any user can **log in and land on a role-correct placeholder home**, with the full plumbing wired — monorepo + shared core, design tokens, typed API client, mobile auth/session, Supabase Realtime under RLS, and i18n — **without disturbing the live web app**. No feature screens yet (those are Phase 1+); this is the skeleton every later phase builds on.

## Guiding principles
1. **Additive & reversible.** Every Phase 0 step is a small, independently-revertible change. The just-launched web app and its Vercel pipeline stay working at all times.
2. **Web stays at repo root for now.** We do **not** move the web app into `apps/web` during Phase 0 (that touches the live Vercel deploy). We add `packages/core` + `apps/mobile` alongside the current root web, and defer the `apps/web` move to a later, isolated cleanup. _(Recorded low-risk path from the plan.)_
3. **Single source of truth.** Design tokens, i18n strings, tier/credit constants, request-field config, and validation live once in `packages/core` and are consumed by **both** web and mobile. No copy-paste drift.
4. **Reuse the backend as-is.** Only one small, additive web/API change is needed in Phase 0 (a mobile credentials-login endpoint that mints a token); everything else consumes existing `pages/api/*`.
5. **Each task has explicit acceptance criteria.** Phase 0 is "done" only when the exit criteria at the bottom all pass.

---

## Workstreams & sequencing

Four workstreams; A must land first, then B/C proceed largely in parallel, D integrates.

```
A. Monorepo & shared core ─┬─> B. Mobile app scaffold ─┐
                           ├─> C. Auth & data layer ────┼─> D. Integration (role router + exit proof)
                           └─> (C1 web endpoint) ───────┘
```

| ID | Task | Depends on | Parallelizable with |
|----|------|-----------|---------------------|
| A1 | npm workspaces skeleton (web stays root) | — | — |
| A2 | Extract design **tokens** to `packages/core/tokens` | A1 | A3 |
| A3 | Extract shared **constants / i18n JSON / validation / types** to core | A1 | A2 |
| B1 | Expo + expo-router app scaffold + Metro monorepo config | A1 | C1 |
| B2 | NativeWind wired to core tokens | B1, A2 | C-* |
| B3 | Base design-system primitives + state components | B2 | C-* |
| B4 | EAS project, env config, `mortly://` scheme, CI lane | B1 | anything |
| C1 | **Web:** mobile credentials-login endpoint (mints session token) | A1 | B1 |
| C2 | Auth client: SecureStore + AuthContext + session bootstrap | B1, C1 | C3 |
| C3 | Typed API client + TanStack Query + sentinel handling | B1, A3 | C2 |
| C4 | Supabase Realtime client under device auth (RLS smoke test) | C2, C3 | — |
| C5 | i18n runtime (react-i18next, ko-default, device locale) | B1, A3 | — |
| D1 | App shell + role router + placeholder role homes (**exit proof**) | B3, C2, C5 | — |

---

## A. Monorepo & shared core

### A1 — npm workspaces skeleton (web stays at root)
- **What:** Add `"workspaces": ["packages/*", "apps/*"]` to the existing root `package.json` (which remains the web app). Create empty `packages/core` (its own `package.json`, `tsconfig`, `src/index.ts`) and reserve `apps/mobile`. Add a root `tsconfig.base.json` with the `@mortly/core` path alias.
- **Why:** Establishes the shared-package boundary with zero disruption — the web keeps building from root.
- **Acceptance:**
  - `npm install` at root succeeds; web `npm run build` + `npm test` still green.
  - `@mortly/core` resolves in a throwaway web import.
  - **Vercel:** the production web build still installs/builds/deploys. Verify install time didn't balloon; if RN/Expo deps get hoisted once `apps/mobile` exists, scope Vercel's install (e.g. Turborepo prune, an ignored-build-step, or an install command limited to root + `packages/core`). _(Track as a sub-item once B1 lands.)_
- **Risk/notes:** The one place Phase 0 touches the live pipeline. Do it on a branch, verify a Vercel **preview** deploy, then merge. Fully revertible (delete the `workspaces` field).

### A2 — Extract design tokens to `packages/core/tokens`
- **What:** Move the palette/scales out of `tailwind.config.ts` into `packages/core/src/tokens.ts` (plain JS objects: `colors` forest/sage/cream/amber + shades, `spacing`, `radius`, `fontFamily`, `fontSize`, animations). Have the web `tailwind.config.ts` import from `@mortly/core/tokens`. Mobile (B2) will import the same.
- **Why:** One source of truth for "Midnight & Gold" so web and app never drift.
- **Acceptance:** Web renders identically (visual diff / the existing design-regression test passes); tokens importable in both a web and a mobile file.
- **Notes:** Pure data only — no Tailwind plugin logic moves.

### A3 — Extract shared constants / i18n / validation / types
- **What:** Move the **pure, server-independent** parts of shared logic into `packages/core`: the ko/en locale JSON (`public/locales` → `packages/core/i18n`, with the web loader pointed at core), tier/credit **constants + enums** (from `lib/tiers`, the `DEFAULTS` keys), **request field config** (`lib/requestConfig`), validation helpers (`lib/validate`, `normalizeEmail`, `isValidEmail`), shared **TS types** (roles, statuses, request/broker/conversation shapes), and an **API-contract** types module (request/response shapes + the error **sentinel codes** the web already throws). Leave anything importing Prisma / server-only in the web.
- **Why:** The app must speak the exact same tiers, statuses, request fields, validation rules, sentinel codes, and copy as the web.
- **Acceptance:** Web imports these from `@mortly/core`, gate stays green; a mobile file can import `TIERS`, `REQUEST_FIELDS`, `normalizeEmail`, sentinel codes, and locale JSON.
- **Notes:** Do it module-by-module (one small PR each), running the web gate each time. Be selective — extract only what's genuinely pure.

## B. Mobile app scaffold

### B1 — Expo + expo-router scaffold + Metro monorepo config
- **What:** `apps/mobile` via `create-expo-app` (TypeScript, expo-router). Configure Metro for the monorepo (`watchFolders` to repo root, `nodeModulesPaths` for hoisted + local deps) per Expo's monorepo guide. Boot to a placeholder screen on iOS + Android simulators.
- **Acceptance:** `npx expo start` runs the app on both simulators; it resolves an import from `@mortly/core`.
- **Notes:** Metro + workspace hoisting is the classic friction point — budget time here. Pin the Expo SDK.

### B2 — NativeWind wired to core tokens
- **What:** Install NativeWind; create the mobile `tailwind.config.js` that consumes `@mortly/core/tokens` (same colors/spacing/radius/type). Verify `className` styling works in RN.
- **Acceptance:** A test component styled `bg-forest-800 text-cream-50 rounded-sm` renders the correct brand values; a native color/spacing swatch matches the web.

### B3 — Base design-system primitives + state components
- **What:** Build the primitives from plan §3: `Button` (primary/secondary/ghost/destructive · sizes · loading/disabled), `Input` (text/select/toggle/stepper · focus/error), `Card`, `BottomSheet`, `Toast`, `Header`, `TabBar` (port the `MobileTabBar` `TabBarItem` contract), `Badge/Pill`, `Avatar`, plus **state components** `Loading/Skeleton`, `Empty`, `Error`, `Success`. Ship a "kitchen sink" dev screen.
- **Acceptance:** Kitchen-sink screen renders every primitive in every state; sharp corners + 44pt targets + safe-area padding verified; matches §3.

### B4 — EAS, env config, scheme, CI
- **What:** `eas.json` with dev/preview/prod profiles; env-based API base URL (`EXPO_PUBLIC_API_URL`) for local/staging/prod; `app.json` with `scheme: "mortly"`, bundle/package IDs, placeholder icon/splash; a CI lane running `tsc`/lint/test for `apps/mobile` + `packages/core`.
- **Acceptance:** `eas build --profile development` produces an installable dev client that boots on a physical device; CI runs green on a PR.

## C. Auth & data layer

### C1 — Web: mobile credentials-login endpoint _(the one additive web change)_
- **What:** Add an endpoint (e.g. `pages/api/auth/mobile-login`) that verifies email+password (reusing the existing bcrypt/`lib/auth` logic + rate limits + `emailVerified`/status checks + sentinel codes) and, on success, mints a **mobile session JWT** (embedding `tokenVersion` so "log out everywhere" works). Align its token shape with the existing `mobile-oauth` endpoint so Apple/Google and credentials return the same session-token contract.
- **Why:** The app needs a non-cookie credential path; OAuth already exists.
- **Acceptance:** `curl` with valid creds returns a token; invalid creds / unverified / suspended return the correct sentinel codes; rate limiting enforced. **Web unit/integration tests cover it.**
- **Risk/notes:** Security-sensitive — mirror the web login's exact guards. This is the item to review most carefully.

### C2 — Auth client: SecureStore + AuthContext + bootstrap
- **What:** Token stored in `expo-secure-store` (Keychain/Keystore); an `AuthContext`/store exposing `session`, `signIn` (credentials + Apple + Google via existing endpoints), `signOut` (clears token), and boot-time session restore. Optional **biometric app-unlock** (Face ID/fingerprint) gate on cold start. Handle `tokenVersion` invalidation (401 → sign out).
- **Acceptance:** Log in on device → token persisted → relaunch stays logged in → sign out clears it → a server-side `tokenVersion` bump forces re-auth on next call.

### C3 — Typed API client + TanStack Query + sentinel handling
- **What:** A `fetch` wrapper (base URL from env, `Authorization: Bearer` injection, JSON, timeout) that parses the web's **error sentinel codes** into typed errors; wire **TanStack Query** (React Query) for server state with sensible defaults (retry/stale/refetch-on-focus). Types come from `@mortly/core` API-contract.
- **Acceptance:** A typed `GET /api/users/me` returns the current user; a deliberately-triggered sentinel (e.g. auth error) surfaces as a typed, localizable error.

### C4 — Supabase Realtime under device auth (RLS smoke test)
- **What:** Instantiate `supabase-js` in RN using the user's identity/token so **RLS scopes rows correctly**; subscribe to a test channel and confirm authorization. Determine exactly how the web mints the realtime token and replicate it.
- **Acceptance:** An authenticated user can subscribe and receive only their own rows; an unauthenticated/foreign subscription is denied (proves RLS holds on device).
- **Risk/notes:** Realtime device-auth is risk **R3** — resolve the token-minting mechanism here.

### C5 — i18n runtime
- **What:** `react-i18next` in RN loading the shared ko/en JSON from `@mortly/core/i18n`; **ko default**, English secondary; detect device locale on first run; persist choice. **No in-app language switcher** (web convention).
- **Acceptance:** Strings render in ko and en per device locale; interpolation + the existing keys resolve; a KO device sees Korean by default.

## D. Integration

### D1 — App shell + role router + placeholder role homes (**Phase 0 exit proof**)
- **What:** The `expo-router` root layout that gates on `AuthContext` and routes to `(auth)` / `(onboarding)` / `(borrower|broker|admin)` groups (mirroring the web's `dashboardHref` derivation), each with a **placeholder home** showing the signed-in user + role + a working sign-out. Wire the maintenance-mode gate.
- **Acceptance:** Logging in as a borrower, broker, and admin each lands on the correct placeholder home; the wrong-role deep link is blocked; sign-out returns to `(auth)`. This screen is the living proof the whole stack works end-to-end.

---

## Phase 0 — Definition of Done
- [ ] Monorepo live (`packages/core` + `apps/mobile`); **web still builds, tests pass, and deploys from Vercel unchanged**.
- [ ] Design tokens, i18n JSON, tier/credit constants, request config, validation, sentinel codes shared from `@mortly/core` (no duplication).
- [ ] Dev client boots on iOS **and** Android from `eas build`.
- [ ] A user can sign in with **email/password, Apple, and Google**; token persists in Keychain/Keystore; `tokenVersion` logout works; optional biometric unlock.
- [ ] Typed API calls against the existing backend work, with sentinel errors surfaced and localizable.
- [ ] Supabase Realtime authorizes correctly under RLS on device.
- [ ] Strings render ko-default / en; design-system primitives + all states match §3 and the shared tokens.
- [ ] Role router lands borrower/broker/admin on correct placeholder homes; CI (tsc/lint/test) green for mobile + core.

## Phase 0 risks (resolve here, before feature work)
| Ref | Risk | Where it's resolved |
|-----|------|---------------------|
| R2 | Mobile token/refresh shape | C1 + C2 |
| R3 | Supabase Realtime device auth vs RLS | C4 |
| — | Vercel install pulling the RN toolchain into the web build | A1 (scope install / prune) |
| — | Metro + workspace hoisting | B1 |
| R6 | ko+Latin font rendering | B2/B3 + C5 (bundle Outfit + Noto Sans KR early) |
| R8 | OTA/versioning strategy | B4 (EAS Update channels) |

## Not in Phase 0 (deferred)
- Moving the web app into `apps/web` (later isolated cleanup once the monorepo is proven).
- Any feature screens (auth UI polish beyond login, onboarding forms, dashboards, chat, etc.) → Phase 1+.
- Push notifications wiring → Phase 4 (though `DeviceToken` registration can be stubbed in C2 if convenient).
