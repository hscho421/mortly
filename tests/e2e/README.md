# E2E tests

These Playwright tests hit a real running Next.js server + real Postgres.

## Prerequisites

**1. Install the Chromium binary once:**
```sh
npx playwright install chromium
```

**2. A separate Postgres database — never point at production or dev:**
```sh
export DATABASE_URL="postgres://localhost/mortly_test"
export DIRECT_URL="$DATABASE_URL"
```

**3. Apply migrations + seed deterministic fixtures:**
```sh
npx prisma migrate deploy
npm run seed:mock
```

`seed:mock` calls `clearAll()` first, then creates the standard randomized dataset, then appends the deterministic E2E fixtures via `seedE2EFixtures()`:

| Email | Password | Role | Notes |
|---|---|---|---|
| `seed-e2e-borrower@mortly.test` | `password123` | BORROWER | verified |
| `seed-e2e-broker@mortly.test` | `password123` | BROKER | VERIFIED, BASIC tier, 10 credits, province ON |

Plus one pre-existing OPEN request (`publicId: 999000010`) owned by the E2E borrower — the flow uses this instead of creating-then-approving, keeping the test simple and deterministic.

## Re-seed between runs

The flow *mutates* the DB (creates a conversation, deducts a credit, writes messages, updates lastReadAt). Re-running without re-seeding will fail on the "unread >= 1" assertion because the conversation is already marked read from the prior run. **Always re-seed between full runs:**

```sh
npm run seed:mock && npm run test:e2e
```

## Running

```sh
npm run test:e2e              # headless chromium, starts dev server on :3100
npm run test:e2e:ui           # interactive Playwright UI mode
```

Or point at an already-running dev server:
```sh
npm run dev -- --port 3100 &
PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test
```

## Why these run serially

`playwright.config.ts` sets `fullyParallel: false` + `workers: 1` because the flow shares DB state across steps. If you add tests, either keep them in the same `describe.serial` block, or create fresh per-test users/requests so they're isolated.
