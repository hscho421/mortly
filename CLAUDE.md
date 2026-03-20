# CLAUDE.md

## Project

MortgageMatch — a privacy-first, bilingual (EN/KO) mortgage marketplace connecting Canadian borrowers with licensed mortgage brokers. See `project.md` for full product spec, data models, and milestones.

## Tech Stack

- Next.js 16 with Pages Router, React 19, TypeScript
- Prisma ORM 5 + PostgreSQL on Supabase
- NextAuth.js (JWT strategy, credentials provider)
- next-i18next for EN/KO translations
- Tailwind CSS (cream, forest, amber, sage palette)
- Supabase Realtime for chat messaging
- Deployed on Vercel with Vercel Cron

## Project Structure

```
pages/                  # Next.js Pages Router
  api/                  # API routes
    auth/               # signup, login, password reset
    admin/              # admin endpoints (users, brokers, requests, conversations, reports, credits, actions, stats)
    borrowers/          # borrower profile
    brokers/            # broker profile
    requests/           # borrower requests CRUD
    introductions/      # broker introductions
    conversations/      # conversations + messages
    reviews/            # review submission
    reports/            # user reports
  admin/                # admin pages (dashboard, users, brokers/, requests, conversations/, reports, activity, manual)
  borrower/             # borrower pages (dashboard, profile, request/, messages)
  broker/               # broker pages (dashboard, profile, onboarding, requests/, conversations/, billing, introductions)
components/             # shared React components (Layout, StatusBadge, etc.)
lib/                    # shared utilities (prisma.ts, auth.ts, publicId.ts, supabase.ts)
prisma/schema.prisma    # database schema
types/                  # TypeScript type declarations (next-auth.d.ts, index.ts)
public/locales/         # translation files (en/common.json, ko/common.json)
```

## Key Patterns

- **Pages Router**: All pages in `pages/`, API routes in `pages/api/`. No App Router.
- **Auth**: NextAuth JWT with `id`, `publicId`, and `role` in session. Role-based access on every API route via `getServerSession`.
- **i18n**: All user-facing strings use `t("key")` from `useTranslation("common")`. Every page needs `getStaticProps` (or `getServerSideProps` for dynamic `[id]` routes) with `serverSideTranslations`. Both EN and KO translation files must be updated together.
- **Client-side filtering**: Admin list pages fetch all data once on mount, then filter locally with `useMemo`. No re-fetch on filter/search changes.
- **Audit trail**: All admin actions logged to `AdminAction` table via `prisma.adminAction.create()` with action type, target, details JSON, and optional reason.
- **Public IDs**: Users have a 9-digit `publicId` (never expose internal CUIDs). Generated via `lib/publicId.ts` on signup.
- **Supabase MCP**: Use `mcp__supabase__apply_migration` for DDL changes. Always run `npx prisma generate` after schema changes.

## Commands

```bash
npm run dev             # start dev server (Turbopack)
npx prisma generate     # regenerate Prisma client after schema changes
npx prisma db push      # push schema to database (dev only)
npm run build           # production build
npm run lint            # run ESLint
```

## Style Guidelines

- Use existing Tailwind utility classes: `card-elevated`, `btn-primary`, `btn-secondary`, `input-field`, `label-text`, `heading-lg`, `heading-md`, `heading-sm`, `text-body`, `text-body-sm`, `divider`
- Animations: `animate-fade-in`, `animate-fade-in-up`, `stagger-1` through `stagger-9`
- Color palette: forest (primary green), cream (background), amber (accent/warning), sage (muted), rose (danger)
- Font families: `font-display` (DM Serif Display), `font-body` (Outfit), Korean uses Noto Sans KR automatically
- All admin pages must be admin-only (check `session.user.role !== "ADMIN"` and redirect)

## Database

- Supabase-hosted PostgreSQL. Connection via `DATABASE_URL` and `DIRECT_URL` env vars.
- Schema defined in `prisma/schema.prisma`. Key models: User, BorrowerRequest, Broker, BrokerIntroduction, Conversation, Message, Review, Report, AdminAction, Subscription, CreditPurchase.
- Migrations via Supabase MCP tool, not `prisma migrate`.

## Important Notes

- Never expose internal CUIDs to users — always use `publicId`
- Every admin action must be logged to AdminAction
- Translation keys must exist in both `en/common.json` and `ko/common.json`
- Dynamic routes (`[id].tsx`) require `GetServerSideProps`, static pages use `GetStaticProps`
- When restructuring files for nested routes (e.g., `brokers.tsx` → `brokers/index.tsx`), clear `.next` cache to avoid Turbopack issues
