<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into Mortly. The following changes were made:

- **`instrumentation-client.ts`** — Created. Initializes PostHog on the client side using the Next.js 15+ `instrumentation-client.ts` pattern. Enables session replay, autocapture, and exception tracking.
- **`lib/posthog-server.ts`** — Created. Provides a singleton `getPostHogClient()` for server-side event capture in API routes.
- **`next.config.mjs`** — Updated. Added reverse-proxy rewrites for `/ingest/*` so PostHog requests are routed through the app's domain (improves ad-blocker resilience).
- **`.env.local`** — Created with `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST`.
- **`pages/signup.tsx`** — Added `posthog.identify()` and `posthog.capture("user_signed_up")` on successful signup. Added `posthog.captureException()` in the catch block.
- **`pages/login.tsx`** — Added `posthog.identify()` and `posthog.capture("user_logged_in")` on successful credentials login. Added `posthog.captureException()` in the catch block.
- **`pages/broker/onboarding.tsx`** — Added `posthog.capture("broker_onboarding_completed")` when a broker submits their profile for the first time.
- **`pages/borrower/request/new.tsx`** — Added `posthog.capture("loan_request_submitted")` after a new mortgage request is created.
- **`pages/borrower/brokers/[requestId].tsx`** — Added `posthog.capture("broker_selected")` when a borrower picks a broker and a conversation is initiated.
- **`pages/broker/introduction/new.tsx`** — Added `posthog.capture("broker_introduction_submitted")` when a broker submits an introduction to a loan request.
- **`pages/broker/billing.tsx`** — Added `posthog.capture("billing_plan_selected")` and `posthog.capture("billing_portal_opened")` for billing interactions.
- **`pages/api/webhooks/stripe.ts`** — Added server-side captures for `subscription_checkout_completed`, `subscription_renewed`, `subscription_payment_failed`, and `subscription_cancelled` using `posthog-node`.

| Event | Description | File |
|---|---|---|
| `user_signed_up` | User successfully creates an account | `pages/signup.tsx` |
| `user_logged_in` | User authenticates via credentials | `pages/login.tsx` |
| `broker_onboarding_completed` | Broker submits their profile for the first time | `pages/broker/onboarding.tsx` |
| `loan_request_submitted` | Borrower submits a new mortgage loan request | `pages/borrower/request/new.tsx` |
| `broker_selected` | Borrower selects a broker; conversation created | `pages/borrower/brokers/[requestId].tsx` |
| `broker_introduction_submitted` | Broker submits an introduction to a loan request | `pages/broker/introduction/new.tsx` |
| `billing_plan_selected` | Broker clicks to upgrade or downgrade their plan | `pages/broker/billing.tsx` |
| `billing_portal_opened` | Broker opens the Stripe customer portal | `pages/broker/billing.tsx` |
| `subscription_checkout_completed` | Stripe checkout completed; subscription activated (server) | `pages/api/webhooks/stripe.ts` |
| `subscription_renewed` | Subscription invoice paid; credits refreshed (server) | `pages/api/webhooks/stripe.ts` |
| `subscription_payment_failed` | Stripe invoice payment failed (server) | `pages/api/webhooks/stripe.ts` |
| `subscription_cancelled` | Subscription deleted; broker downgraded to FREE (server) | `pages/api/webhooks/stripe.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics**: https://us.posthog.com/project/367603/dashboard/1427312
- **Borrower Conversion Funnel** (loan request → broker selected): https://us.posthog.com/project/367603/insights/xP08kYTc
- **Broker Subscription Funnel** (plan selected → checkout completed): https://us.posthog.com/project/367603/insights/jJyr6Jfz
- **New Signups Over Time**: https://us.posthog.com/project/367603/insights/zIg61T8g
- **Subscription Churn Events** (payment failures & cancellations): https://us.posthog.com/project/367603/insights/BmPYexpw
- **Broker Activity: Introductions vs Loan Requests**: https://us.posthog.com/project/367603/insights/oJyDoM61

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-nextjs-pages-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
