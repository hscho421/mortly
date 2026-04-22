# Tests

Production testing layout for Mortly (Next.js 16 + Prisma + Stripe + NextAuth).

## Layout

```
tests/
  unit/            Pure functions, no DB/network. Fast.
  integration/     API route handlers w/ mocked Prisma + Stripe.
  component/       React components via @testing-library/react.
  invariants/      System-wide truths (credits, privacy, role fences).
  concurrency/     Real-DB race tests. Opt-in via TEST_DATABASE_URL.
  e2e/             Playwright against a real Next.js server + Postgres.
  fixtures/        Factory data (users, requests, stripe events).
  mocks/           vi.mock helpers for prisma / next-auth / stripe.
  utils/           createMocks + shared setup.
```

## Running

```sh
npm install                    # installs vitest, playwright, testing-library, etc.
npm test                       # all non-e2e suites
npm run test:watch             # dev loop
npm run test:unit              # just unit
npm run test:integration       # just API integration
npm run test:component         # just React components
npm run test:invariants        # just marketplace invariants
npm run test:coverage          # with v8 coverage report

# Real-DB concurrency — opt-in (requires seeded TEST_DATABASE_URL)
export TEST_DATABASE_URL=postgres://localhost/mortly_test
npm run seed:mock              # seed the test DB first
npm run test:concurrency

# E2E — see tests/e2e/README.md for DB prerequisites
npx playwright install --with-deps chromium  # first time only
npm run test:e2e
```

## What's covered

### Unit ([tests/unit/](unit/))
- `lib/requestConfig` — product-type validation across RESIDENTIAL/COMMERCIAL
- `lib/rate-limit` — bucket limits, reset window, IP extraction
- `lib/stripe` — tier ↔ priceId mapping, credit lookups
- `lib/publicId` — 9-digit generation + collision retry
- `lib/legal` — version shape + acceptance metadata

### Integration ([tests/integration/api/](integration/api/))
- **Auth**: `signup` (validation, dup, email send failure, rate limit, legal gate), `verify-email` (timing-safe compare, expiry, rate limit, idempotent already-verified, no existence leak)
- **Requests**: create RESIDENTIAL/COMMERCIAL w/ validation, max-active limit, broker-only sees OPEN, borrower scoping, close cascade, delete cascade, PATCH edit rules, competitor conversation stripping
- **Conversations**: credit atomic decrement (`updateMany gt: 0`), 0-credit → 403, PREMIUM skip, idempotent duplicate, FREE-tier block, block-list enforcement
- **Messages**: participant gate, block-list, broker 3-message spam cap + release once borrower replies, 5000-char cap, trim
- **Stripe webhooks**: signature verify, checkout.session.completed credit grant, idempotency on same period, PREMIUM `-1` unlimited, invoice.paid skips `subscription_create`, subscription.deleted → FREE+0 idempotent, payment_failed → PAST_DUE without revoking access, unknown events don't 500
- **Cron expire-requests**: 401 wrong secret, timing-safe compare, partial-prefix rejection, cutoff math ~30d, 405 unsupported method
- **Admin credits**: role gate, audit row written, negative floor at 0, 0-amount rejected

### Component ([tests/component/](component/))
- `<RequestForm />` — step gating, category switch resets products, submit payload shape, error banner, edit-mode `initialValues`

### Invariants ([tests/invariants/marketplace.test.ts](invariants/marketplace.test.ts))
System-wide truths, not endpoint behavior. Bias: money, privacy, fairness.
1. **Credit conservation** — FREE never decrements, PREMIUM never decrements, BASIC/PRO always uses `{ gt: 0 }` guard, duplicates never double-deduct, admin adjust never crosses zero
2. **Cross-tenant isolation** — borrower can't see/edit/close/delete another borrower's request via GET/PUT/PATCH/DELETE, marketplace list is scoped (OPEN for brokers, own-id for borrowers), broker read strips competitor conversations, non-participant can't send messages
3. **Role fences** — only BORROWER can POST /api/requests; only ADMIN can POST /api/admin/credits; unverified broker never reaches write paths
4. **Block-list symmetry** — blocks apply in both directions for messages + conversation-intro; credit must not be deducted when blocked
5. **No side effects on rejected input** — every validation failure path is asserted to NOT call `create`/`update`/`delete`

### Concurrency ([tests/concurrency/credits.test.ts](concurrency/credits.test.ts))
Real Postgres, opt-in via `TEST_DATABASE_URL`. Skipped silently if unset.
- N parallel decrements with N credits → all succeed, balance = 0, never negative
- N parallel decrements with M < N credits → exactly M succeed
- Parallel `POST /api/conversations` for same (request, broker) pair → exactly 1 conversation + exactly 1 credit decrement (unique constraint + in-tx decrement together enforce the invariant)

### E2E ([tests/e2e/](e2e/))
- Full flow: borrower creates request → broker sees it → broker opens conversation (credit deducted) → borrower reads → borrower replies → borrower closes
- Auth smoke: login + signup page render correctness

## Mocking strategy

- **Prisma**: deep-mocked via `vitest-mock-extended`. `$transaction(cb)` invokes the callback with the mock itself; `$transaction([...])` resolves the array. This matches real Prisma semantics so the handlers' `tx.broker.updateMany({ where: { gt: 0 } })` works.
- **next-auth**: `getServerSession` returns whatever `setSession(...)` installed. Helpers for borrower/broker/admin sessions live in [tests/mocks/next-auth.ts](mocks/next-auth.ts).
- **Stripe**: `getStripe()` returns a shared mock; each test drives `stripeMock.<resource>.<method>.mockResolvedValue(...)`.
- **Resend**: `lib/email` is mocked at the module level in the few tests that send emails.
- **Network**: no real HTTP calls in unit or integration suites.

## Adding a new test

1. For pure logic, drop a file under `tests/unit/lib/`.
2. For an API route, copy a similar file under `tests/integration/api/...` — start with the auth/permission matrix before happy path.
3. For a React component, use jsdom (enabled for everything under `tests/component/`). Mock `next-i18next` by returning the key as the translation (see existing component test).
4. E2E: only add if the flow spans multiple services and can't be verified at the integration layer. Seed data dependencies are real — document them in [tests/e2e/README.md](e2e/README.md).

## Coverage thresholds

The current thresholds (vitest.config.ts) are intentionally moderate (60% lines). Tighten as coverage grows — don't ratchet down.
