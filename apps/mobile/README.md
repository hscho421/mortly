# @mortly/mobile

The Mortly native app (Expo + expo-router + NativeWind), sharing `@mortly/core`
and the existing Next.js API with the web.

## Phase 0 foundation (what's wired)
- **Monorepo** — this app lives in `apps/mobile`; shared logic + tokens + i18n
  config come from `@mortly/core`.
- **Design tokens + primitives** — NativeWind pulls the Midnight & Gold palette
  from `@mortly/core` (one source with the web); `src/components` has the §3
  primitives (Button/Input/Card/Badge/Avatar/Header) + Loading/Empty/Error
  states. `app/kitchen-sink.tsx` shows them all (dev link on the role home).
- **Auth** — `src/auth`: email/password via `POST /api/auth/mobile-login`; native
  **Sign in with Apple** (lazy-loaded, dev-build only) → `/api/auth/mobile-oauth`;
  Google is a documented stub. The minted next-auth JWT is stored in the device
  Keychain (`expo-secure-store`) and sent as the session **cookie**, so every
  existing endpoint authenticates it via `getServerSession` unchanged.
- **API client + data** — `src/api/client.ts` (typed, sends `x-mortly-mobile: 1`,
  surfaces sentinel codes); `useMe()` (TanStack Query) proves the authed loop and
  signs out on 401.
- **Realtime** — `src/lib/supabase.ts` (anon client) + `useConversationSync()`:
  content-free "sync" broadcast, real content over the authed API — mirrors the
  web's RLS-deny-all model exactly.
- **i18n** — loads the SAME `public/locales/{ko,en}/common.json` the web serves;
  ko-default, en when the device is English (`expo-localization`).
- **Role router** — `app/_layout.tsx` redirects guests → `(auth)/login` and
  authed users → their role stack `(borrower|broker|admin)`, each a placeholder
  home (the Phase 0 exit proof) that live-calls `/api/users/me`.
- **CI** — `.github/workflows/mobile-ci.yml`: tsc · expo-doctor · Metro bundle ·
  jest, on any `apps/mobile` / `packages/core` / locale change.

## Install & run (on a Mac with Xcode / Android Studio)
**Expo SDK 54** (React 19.1, RN 0.81, Reanimated 4). This app installs
**standalone** (its own `node_modules`), NOT as part of the root workspace —
Expo pins `react` to an exact version that differs from the web's range, and
keeping the RN toolchain out of the web install keeps the Vercel deploy clean.
`@mortly/core` is linked via a `file:` dependency; Metro resolves it from the
monorepo.

> **Expo Go works right now** (SDK 54) — the Apple/Google sign-in buttons are
> still stubs, so no custom native code is bundled yet (only `expo-secure-store`,
> which Expo Go includes). Once native auth/push are wired, switch to a
> **development build** (`npx expo run:ios`).
```bash
cd apps/mobile
npm install          # installs the RN toolchain + links @mortly/core
npx expo start       # scan the QR with Expo Go, or press i (simulator) / a
```

Point it at a backend + Supabase Realtime with public env vars (all safe to ship
— `EXPO_PUBLIC_*` are the same anon values the web uses):
```bash
EXPO_PUBLIC_API_URL=http://<your-LAN-ip>:3000 \
EXPO_PUBLIC_SUPABASE_URL=<same as web NEXT_PUBLIC_SUPABASE_URL> \
EXPO_PUBLIC_SUPABASE_ANON_KEY=<same as web NEXT_PUBLIC_SUPABASE_ANON_KEY> \
npx expo start
```
Without the Supabase vars the app still runs; Realtime just reports "off".

Verify the bundle without a device:
```bash
npx expo export --platform ios   # Metro-bundles the whole app to disk
npx expo-doctor                  # dependency sanity (18/18)
```

## Vercel
No action needed. The root workspace is **web + `packages/core` only** — the RN
toolchain never enters the web install, so the production deploy is unaffected.

## Wired in code — need your machine / accounts to finish
These can't be verified from CI/Expo Go; they need a device, an EAS account, or
your OAuth credentials:
- **Dev build** — `npx expo run:ios` (or `eas build --profile development`) to
  test **native Apple sign-in** and **push** (Expo Go can't run these).
- **Push notifications** — the client (register + tap deep-linking) + backend
  are done. To enable: run `eas init` and add the project id to `app.json` under
  `expo.extra.eas.projectId` (registration no-ops without it), then test in a
  dev build. Unregisters on sign-out.
- **EAS build on iOS + Android** from `eas.json` (needs your Expo account).
- **Google sign-in** — add client IDs + `@react-native-google-signin` (or
  `expo-auth-session`) in a dev build; server verify already exists.
- **On-device Realtime smoke** — set the `EXPO_PUBLIC_SUPABASE_*` vars and
  confirm the `chat-<id>` broadcast nudge arrives.

## Next (Phase 1)
Onboarding + role selection, then the borrower/broker/admin screens, chat, and
push notifications. See `docs/MOBILE_APP_PLAN.md`.
