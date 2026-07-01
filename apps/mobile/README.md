# @mortly/mobile

The Mortly native app (Expo + expo-router + NativeWind), sharing `@mortly/core`
and the existing Next.js API with the web.

## Phase 0 foundation (what's wired)
- **Monorepo** — this app lives in `apps/mobile`; shared logic + tokens + i18n
  config come from `@mortly/core`.
- **Design tokens** — NativeWind pulls the Midnight & Gold palette/fonts from
  `@mortly/core/tokens` (one source with the web).
- **Auth** — `src/auth`: email/password via `POST /api/auth/mobile-login`
  (+ Apple/Google stubs → `/api/auth/mobile-oauth`); the minted next-auth JWT is
  stored in the device Keychain (`expo-secure-store`) and sent as the session
  **cookie**, so every existing endpoint authenticates it via `getServerSession`
  unchanged.
- **API client** — `src/api/client.ts`: typed, surfaces the backend's sentinel
  error codes.
- **i18n** — `src/i18n.ts`: loads the SAME `public/locales/{ko,en}/common.json`
  the web serves (ko-default).
- **Role router** — `app/_layout.tsx` redirects guests → `(auth)/login` and
  authed users → their role stack `(borrower|broker|admin)`, each showing a
  placeholder home (the Phase 0 exit proof).

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

Point it at a backend with `EXPO_PUBLIC_API_URL` (defaults to `https://mortly.ca`):
```bash
EXPO_PUBLIC_API_URL=http://<your-LAN-ip>:3000 npx expo start   # local `next dev`
```

Verify the bundle without a device:
```bash
npx expo export --platform ios   # Metro-bundles the whole app to disk
npx expo-doctor                  # dependency sanity (18/18)
```

## Vercel
No action needed. The root workspace is **web + `packages/core` only** — the RN
toolchain never enters the web install, so the production deploy is unaffected.

## Next (Phase 1+)
Onboarding + role selection, device-locale detection (`expo-localization`),
native Apple/Google sign-in, then the borrower/broker/admin screens, push
notifications, and Supabase Realtime chat. See `docs/MOBILE_APP_PLAN.md`.
