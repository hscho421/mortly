# Design: Broker Profile Photos (Supabase Storage)

**Status:** Design / not yet implemented · **Created:** 2026-06-14
**Stack context:** Next.js Pages Router, Prisma/Postgres on Supabase (Pro), NextAuth (JWT), `@supabase/supabase-js` already a dependency, Vercel hosting.

## 1. Goal & scope

Replace the initials-box avatars in messaging (and broker-facing surfaces) with real **broker** profile photos.

**Scope decision — brokers only (recommended):**
- **Brokers: yes.** A face on the person you're trusting with a mortgage is real conversion/trust value. Brokers are already identity-verified, which shrinks the moderation problem.
- **Borrowers: no (for now).** Low value in a mortgage chat, and it adds UGC moderation + extra PII for little upside. Borrowers keep the initials avatar.
- Net effect in chat: a borrower sees the broker's **photo** (good); a broker sees the borrower's **initials** (fine). Clean asymmetry, half the moderation surface.
- Borrower photos are documented as an optional later phase (§12) if ever wanted — the `<Avatar>` component is built generic so it's a small change.

The schema already has `Broker.profilePhoto String?` (currently a dead, write-only field) — we reuse it.

## 2. Architecture overview

```
Browser (broker profile page)
  1. pick file → validate type/size client-side
  2. downscale to ≤512×512, re-encode WebP (~150KB) via <canvas>  [also strips EXIF/GPS]
  3. POST /api/brokers/avatar/upload-url  (authed, broker-only) → returns a Supabase signed upload URL + object path
  4. PUT the resized blob directly to Supabase Storage using the signed URL  (file never touches our serverless fn)
  5. POST /api/brokers/avatar/confirm  → saves the object path on Broker.profilePhoto, returns the public URL
Supabase Storage  (bucket: avatars, public-read, size+MIME capped at bucket level)
Render: <Avatar> → next/image(public URL) with initials fallback
```

Key choices and why:
- **Direct browser → storage upload via signed URL.** Vercel serverless caps request bodies ~4.5MB and times out fast; routing image bytes through our API is fragile. The signed-URL pattern keeps bytes off our backend and keeps the service-role key server-only.
- **Deterministic object key** `brokers/<brokerUserId>.webp`. Re-uploading overwrites in place → no orphaned files, trivial delete, natural idempotency. (Add a `?v=<updatedAt>` cache-buster on the render URL so a replaced photo isn't served stale from the CDN.)
- **Store the object PATH, not a full URL,** in `Broker.profilePhoto` (e.g. `brokers/<id>.webp`). Build the public URL at render time. Survives domain/project changes and prevents storing arbitrary URLs.
- **Public-read bucket.** Verified brokers are public-facing professionals; public read is simpler and CDN-cacheable. (Borrower photos, if ever added, would warrant signed read URLs — another reason to keep them separate.)
- **Client-side resize is the storage-cost lever** (see fix-plan discussion): turns a 5–10MB phone photo into ~150KB before it's ever stored. Bucket-level caps are the abuse backstop.

## 3. Data model

- **Reuse `Broker.profilePhoto`** to store the object path (`brokers/<brokerUserId>.webp`) or `null`.
- **Optional moderation column (decision in §13):** if we want admin pre-approval, add `profilePhotoStatus` enum (PENDING/APPROVED/REJECTED) via migration. Recommended **NOT** for v1 — rely on verified-broker trust + a report/removal path (we already have `ReportButton` + admin reports). Keep v1 simple.
- No `User` change (borrowers excluded).
- Migration: only needed if we add the moderation column; otherwise zero schema change.

## 4. Supabase setup (dashboard — one-time)

1. Storage → New bucket: **`avatars`**, **Public** bucket.
2. Bucket settings: **max file size 5 MB**, **allowed MIME types** `image/webp, image/jpeg, image/png`. (Server-enforced — the abuse backstop regardless of client.)
3. RLS policies on `storage.objects` for the `avatars` bucket:
   - **read:** public (anyone) — broker avatars are public.
   - **insert/update/delete:** only the owner — restrict to the path prefix matching the broker's own user id. Because we mint signed upload URLs from an authed API, we can also keep writes service-role-only and skip per-user RLS; decide in §13 (signed-URL-only writes is simpler and avoids needing Supabase Auth context, which we don't have — we use NextAuth).
4. Confirm **Image Transformations** enabled (Pro feature) — used for the small chat variant.

## 5. Backend (API routes)

All under `withAuth`, broker-role-gated, and **verified-broker-gated** (only VERIFIED brokers can set a photo — keeps unverified/rejected accounts from seeding images).

- **`POST /api/brokers/avatar/upload-url`** → validates session is a VERIFIED broker; computes the deterministic path `brokers/<userId>.webp`; calls `supabaseAdmin.storage.from('avatars').createSignedUploadUrl(path)` (service-role key, server-only); returns `{ signedUrl, path }`.
- **`POST /api/brokers/avatar/confirm`** → body `{ path }`; verify the path matches this broker's deterministic path (no setting someone else's); set `Broker.profilePhoto = path`; return public URL. (Defends against a client confirming an arbitrary path.)
- **`DELETE /api/brokers/avatar`** → remove the storage object + set `profilePhoto = null`.
- **Lock down the existing `PUT /api/brokers/profile`:** it currently accepts an arbitrary pasted `profilePhoto` URL — an SSRF/abuse vector and the source of the "dead field." Change it to **ignore/reject** client-supplied `profilePhoto`; the field is now only mutated through the avatar endpoints. (Security fix bundled in.)
- New server util `lib/supabaseAdmin.ts` — a service-role client (`SUPABASE_SERVICE_ROLE_KEY`, server-only env, **not** `NEXT_PUBLIC_`). Never import into client code.

## 6. Frontend

- **`lib/resizeImage.ts`** — canvas downscale to ≤512×512, re-encode to WebP at quality ~0.85, return a Blob (~100–200KB). Re-encoding also **strips EXIF/GPS** automatically (privacy win).
- **`components/Avatar.tsx`** — generic: `{ name, src? , size }`. Renders `next/image` when `src` present, else the existing initials box. Single component replaces the ad-hoc initials markup everywhere.
- **Broker profile page (`pages/broker/profile.tsx`)** — add an avatar upload control: file input → resize → upload-url → PUT → confirm → optimistic preview + `refresh()`. Include a "Remove photo" action. Loading/error states + i18n (ko/en) for all copy.
- **Render sites** (swap initials → `<Avatar>`):
  - `pages/borrower/messages.tsx` + `pages/broker/messages.tsx` (chat list + thread header)
  - `pages/borrower/brokers/[requestId].tsx` (broker comparison cards — high-value trust surface)
  - `pages/broker/profile.tsx` (own profile)
  - admin broker detail (`pages/admin/brokers/[id].tsx`) — so admins can see/report photos
- **`next.config.mjs`** — add the Supabase storage hostname to `images.remotePatterns` so `next/image` will serve it. Use the transform URL (e.g. `?width=64&height=64`) for the small chat variant to minimize egress.

## 7. Security

- Service-role key **server-only** (`SUPABASE_SERVICE_ROLE_KEY`, never `NEXT_PUBLIC_`). Signed upload URLs are short-lived and path-scoped.
- Bucket-level MIME + 5MB cap = abuse/DoS backstop independent of the client.
- Deterministic per-broker path + `confirm` path-check = a broker can only write their own avatar.
- Remove the arbitrary-URL acceptance in `PUT /api/brokers/profile` (SSRF/abuse).
- Re-encode strips EXIF (no GPS leakage).
- Content moderation: v1 = verified-brokers-only + existing report→admin-removal flow; admin can `DELETE` an offending avatar. (Pre-approval is the §13 upgrade.)

## 8. Privacy / PIPEDA

- A photo is personal data → **account deletion must delete the storage object.** Extend the hard-delete transaction in `pages/api/users/me.ts` to also remove `brokers/<userId>.webp` from storage (best-effort, logged).
- EXIF stripped on upload.
- Add a one-line mention to the privacy policy that brokers may upload a profile photo stored on our infrastructure and removed on deletion.

## 9. Cost / staying on $25 Pro

With the §6 resize (~150KB stored) and bucket caps, ~100GB included storage ≈ ~500k broker avatars — storage will never be what moves you off Pro. Egress is served by the CDN with tiny transformed variants; negligible. (Numbers per supabase.com/pricing — verify, but the order of magnitude holds.)

## 10. Failure modes & edge cases

- **Upload succeeds, confirm fails:** deterministic path means the next attempt overwrites; no orphan accumulation. A periodic reconcile isn't needed at this scale.
- **Replace photo:** overwrite same path; bump `?v=updatedAt` cache-buster so CDN/browser don't serve the old image.
- **Remove photo:** delete object + null the column; UI falls back to initials.
- **Broker un-verified/rejected after setting a photo:** render gate can hide the photo for non-VERIFIED brokers (cheap defense).
- **Supabase Storage down:** render falls back to initials (no hard failure); upload shows an error toast.

## 11. Testing

- **Unit:** `resizeImage` (dimensions/format/size bound), `Avatar` (renders photo vs fallback).
- **Integration:** `upload-url` (rejects non-broker / unverified), `confirm` (rejects mismatched path), `PUT /api/brokers/profile` (ignores client `profilePhoto`), `DELETE /api/users/me` (removes the storage object — mock the storage client).
- **e2e:** broker uploads avatar → appears in their profile + in the borrower's broker-comparison view. (Playwright can set an input file.)
- Add the new endpoints to the i18n key-coverage + design-regression nets where relevant.

## 12. Optional later phase — borrower photos

If ever wanted: add `User.profilePhoto`, a separate (or signed-read) bucket path `users/<id>.webp`, reuse `<Avatar>` + `resizeImage` + the same upload pattern, and add borrower-side moderation. Deliberately deferred — extra PII + moderation for low value.

## 13. Open decisions (confirm before building)

1. **Admin pre-approval of broker photos?** Recommended **no** for v1 (verified-broker + report/removal). Yes → adds `profilePhotoStatus` column + admin queue work.
2. **Write path: signed-URL-only (service role) vs Supabase RLS per-user.** Recommended **signed-URL-only** — we use NextAuth, not Supabase Auth, so `auth.uid()` RLS doesn't apply cleanly; minting scoped signed URLs from our authed API is the natural fit.
3. **Borrowers in or out for v1?** Recommended **out** (§12).

## 14. Rollout — phased, each shippable

- **Phase 1 — backend + storage:** bucket + RLS, `lib/supabaseAdmin.ts`, `upload-url`/`confirm`/`DELETE` endpoints, lock down `profile` PUT, deletion cascade, `SUPABASE_SERVICE_ROLE_KEY` in Vercel. (No user-visible change yet.)
- **Phase 2 — broker upload UI:** `resizeImage`, upload control on broker profile, i18n, tests.
- **Phase 3 — render everywhere:** `<Avatar>` swapped into chat + comparison + admin; `next.config` remotePatterns. (The visible payoff.)
- **Phase 4 — polish/moderation:** report→admin-remove wiring, un-verified hide gate, privacy-policy line.

Not a launch blocker — ships independently of the current deploy.

## Status log
- 2026-06-14: Design written. Decisions confirmed: no pre-approval, brokers-only, signed-URL-only writes.
- 2026-06-14: **Phase 1 DONE** (backend + storage). Added `lib/supabaseAdmin.ts` (server-only service-role client, null-safe), `POST /api/brokers/avatar/upload-url` (verified-broker-gated signed URL), `POST/DELETE /api/brokers/avatar` (confirm/remove, server-derived path), locked down `PUT /api/brokers/profile` (no longer accepts client profilePhoto — SSRF fix), and avatar cleanup in account deletion (`users/me`). +7 tests. tsc 0, lint 0, 524/524 green.
  - **USER ACTIONS before Phase 1 works in prod:** (1) Supabase dashboard → create public bucket `avatars`, set max file size 5MB + allowed MIME `image/webp,image/jpeg,image/png`; (2) add `SUPABASE_SERVICE_ROLE_KEY` to Vercel (server-only, NOT NEXT_PUBLIC) — from Supabase → Project Settings → API.
  - Next: Phase 2 (broker upload UI + resize), Phase 3 (render `<Avatar>` in chat/comparison/admin + next.config remotePatterns), Phase 4 (moderation/report + privacy line).
- 2026-06-14: **Phase 2 DONE** (broker upload UI). Added `lib/resizeImage.ts` (center-crop → ≤512 WebP, strips EXIF), client-safe `avatarPublicUrl`/`AVATAR_BUCKET` in `lib/supabase.ts` (supabaseAdmin now re-exports them — single source of truth), and an avatar upload/change/remove section on `pages/broker/profile.tsx` (verified-brokers-only, resize → signed-URL → uploadToSignedUrl → confirm, cache-busted preview). 12 broker.avatar* i18n keys added to both catalogs. Preview uses a plain `<img>` so Phase 2 needs no next.config change. tsc 0, lint 0, 524/524 green, build 50/50.
  - Still needs the USER ACTIONS above (bucket + SUPABASE_SERVICE_ROLE_KEY) to function end-to-end in dev/prod.
  - Next: Phase 3 (the visible payoff — `<Avatar>` component into chat list/thread, broker comparison cards, admin broker detail; add Supabase host to `next.config.mjs` images.remotePatterns; use transform URL for the 64px chat variant).
