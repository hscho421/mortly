# Stripe test-mode smoke checklist

## Verified run — 2026-06 (deployed prod in test mode)

Executed end-to-end against the **live deployed site** running in Stripe **test mode** (no local `npm run dev`). It caught a real production bug. Approach + findings here; the detailed checklist follows.

### Approach: run production in test mode
- Set `ALLOW_TEST_STRIPE=1` + `sk_test_…` + test `STRIPE_PRICE_*` on the **Production** Vercel env. The escape hatch in `lib/env.ts` / `instrumentation.ts` relaxes the `sk_live_` boot check and warns loudly every boot. **Revert before launch.**
- Register a **test-mode** webhook endpoint in the Stripe Dashboard at the **canonical `www`** URL — `https://www.mortly.ca/api/webhooks/stripe` — subscribed to the 7 events; put its `whsec_` in the Production env.

### ⚠️ Gotchas that cost real time (read before re-running)
1. **Webhook URL must be the canonical host.** The apex `mortly.ca` **307-redirects** to `www`, and **Stripe never follows redirects** → every delivery silently fails. Register the **`www`** URL.
2. **`stripe trigger <event>` is useless here.** Its fixtures carry throwaway ids / no `metadata.brokerId`, so the handler returns 200 but changes nothing. Always drive **real** objects (real Checkout; test clock for renewals; a real dispute; real cancel/delete).
3. **Instant-dispute race.** The dispute test card files the chargeback ~300ms after checkout, which can beat the subscription row being written. Re-deliver the event later (see `replay:event`) to test the handler cleanly.
4. **Forcing a renewal failure.** You must set the **subscription's** `default_payment_method` — Checkout pins one there and it **overrides** the customer default. And the shared `pm_card_*` tokens can't be used as a `default_payment_method` value (Stripe spawns a fresh *unattached* instance). Create a real PM from `tok_chargeCustomerFail`, **attach** it, set it on the subscription, and **confirm** before advancing the clock.

### 🐞 Bug found + fixed (would have shipped)
`handleChargeDisputeCreated` mapped `dispute → charge → charge.invoice → subscription`, but **`charge.invoice` no longer exists** under the 2026 `clover` API — so the handler bailed on **every real chargeback** and disputes never revoked access. The mocked unit test passed only because it returned `charge { invoice: "in_1" }` (a fixture-vs-live gap). Fixed to map via `charge.customer → broker → subscription` (commit `7454893`). The sibling 2026 mapping — `invoice.parent.subscription_details.subscription` — was verified **alive** on a live invoice, so renewal / payment-fail were unaffected.

### Helper scripts
- `npm run verify:broker -- <email>` — prints a broker's live billing state (tier, credits, subscription, recent processed events, notices). The per-step oracle.
- `npm run replay:event -- <evt_id>` — clears one `ProcessedStripeEvent` ledger row so `stripe events resend <id>` re-processes (bypasses idempotency).
- `npm run set:customer -- <email> <cus_id>` — binds a broker to a test-clock customer before subscribing so renewals can be fast-forwarded.

### Result — all paths PASS
Subscribe ✅ · Upgrade (immediate) ✅ · Downgrade-schedule ✅ · Dispute ✅ *(after the fix)* · Renewal ✅ *(×3, period advances + re-grant)* · Payment-fail → PAST_DUE + **real dunning email via Resend** ✅ · Recovery (credits 0→5) ✅ · Cancel + customer-delete → FREE ✅.

### Before launch — revert the test-mode setup
- [ ] Remove `ALLOW_TEST_STRIPE`; restore `sk_live_…` + live `STRIPE_PRICE_*`; register a **live-mode** webhook endpoint at the **`www`** URL with a fresh `whsec_`, subscribed to all 7 events.
- [ ] Clean the test rows from the prod DB (test brokers + their subscriptions, `ProcessedStripeEvent`, `admin_notices`).
- [ ] Redeploy; confirm the boot warning is gone.

---

Run this **once in Stripe test mode** before trusting billing with real cards. Code
review + mocked tests prove the logic in isolation; this proves the real
integration (signature verification, webhook delivery/ordering, proration, 3DS,
disputes). Budget ~45–60 min.

Every step lists: **Do** → **Expect** (DB + UI) → _which fix it verifies_.

---

## 0. Setup (once)

- [ ] Use **test-mode** keys: `STRIPE_SECRET_KEY=sk_test_…`, `STRIPE_PRICE_*` = test-mode price IDs, `STRIPE_WEBHOOK_SECRET=whsec_…` for the test endpoint. (The boot validator only enforces `sk_live_` when `VERCEL_ENV=production`, so a preview/local run accepts test keys.)
- [ ] Webhook endpoint subscribes to **all** of: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, **`charge.dispute.created`** (newly required — easy to forget).
- [ ] Forward events locally: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` (copy the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET`).
- [ ] Have a verified BROKER test account. Useful test cards:
  - `4242 4242 4242 4242` — success
  - `4000 0025 0000 3155` — requires 3DS/SCA
  - `4000 0000 0000 0341` — attaches but **fails on the next charge** (dunning)
  - `4000 0000 0000 0259` — charge that can be **disputed**

---

## 1. Subscribe (happy path)

- [ ] **Do:** As the broker, go to `/broker/billing` → pick **PRO** → complete Checkout with `4242…`.
- [ ] **Expect:** redirect to `…/broker/billing?checkout=success`; within ~10s the UI shows PRO. DB: `Subscription` row `status=ACTIVE, tier=PRO, stripeSubscriptionId` set, period dates set; `Broker.subscriptionTier=PRO`, `responseCredits` = PRO grant. Webhook log shows `checkout.session.completed` → 200 (not 500, not duplicate-retry). _Core + B1 self-heal no-ops._

## 2. SCA / 3DS

- [ ] **Do:** New broker, subscribe with `4000 0025 0000 3155`, complete the 3DS challenge.
- [ ] **Expect:** access granted only **after** the challenge succeeds. If you cancel the challenge, **no** ACTIVE row / no credits. _Checkout payment-status guard._

## 3. Renewal (credit refresh — the B2 blocker)

- [ ] **Do:** Create the subscription on a **Stripe test clock**, then **advance the clock by one billing period** (Dashboard → test clock, or CLI). Optional: spend the broker's credits to 0 first.
- [ ] **Expect:** `invoice.paid` fires; `Broker.responseCredits` resets to the tier grant (+ any admin bonus). The renewal must refresh credits **even though `customer.subscription.updated` also fires** — verify by checking credits are back, not stuck at 0. _B2 (cursor ownership)._
- [ ] **Also:** if you granted an admin bonus (step 9) before this, confirm the renewal restores `tierGrant + bonus`, not bare tierGrant. _H5._

## 4. Upgrade (immediate, prorated)

- [ ] **Do:** On the ACTIVE PRO broker, pick **PREMIUM**.
- [ ] **Expect:** no new Checkout; immediate switch; `subscriptions.update` with `create_prorations`; UI flips to PREMIUM (unlimited). Only **one** live subscription on the customer in Stripe. _No-dup-sub._

## 5. Downgrade (scheduled at period end)

- [ ] **Do:** On PREMIUM, pick **BASIC**.
- [ ] **Expect:** `{updated:true, scheduled:true}`; `Subscription.pendingTier=BASIC`; a **subscription schedule** exists in Stripe; the broker keeps PREMIUM credits until the boundary. Advance the test clock to the boundary → renewal invoice bills the **BASIC** price and credits drop to BASIC. _Downgrade timing._

## 6. Cancel at period end

- [ ] **Do:** Cancel via the in-app flow / portal.
- [ ] **Expect:** `cancelAtPeriodEnd=true`; access persists until the period end. Advance the clock past the end → `customer.subscription.deleted` → `Subscription.status=EXPIRED`, `Broker.subscriptionTier=FREE`, `responseCredits=0`, **`bonusCredits=0`**. _Cancel + H5 wipe-on-cancel._

## 7. Payment failure + recovery (the H2 path)

- [ ] **Do:** Set the broker's default card to `4000 0000 0000 0341`, advance the clock to a renewal so the charge **fails**.
- [ ] **Expect:** `invoice.payment_failed` → `status=PAST_DUE`, `responseCredits=0`; the broker **can't open new conversations or message**; they get the payment-failed email/notice once. `bonusCredits` unchanged.
- [ ] **Recover:** update the card to `4242…` and let Stripe retry (or `stripe trigger`/pay the invoice). `invoice.paid` → back to ACTIVE, credits restored (tierGrant + bonus).
- [ ] **Stale-failure guard:** after recovery, in the Dashboard **resend** the old `invoice.payment_failed` event (Developers → Events → resend). It must be a **no-op** — the broker stays ACTIVE with credits. _H2._

## 8. Duplicate-subscription guard (B1/H1)

- [ ] **Do:** Put the broker in PAST_DUE (step 7, don't recover). On `/broker/billing`, try to pick a **different** plan.
- [ ] **Expect:** **409 / "update your payment method"** message — **no** second subscription is created. Confirm in Stripe the customer still has exactly **one** subscription. _B1._
- [ ] **Self-heal:** (harder to stage) if a second sub ever does get created and its checkout completes, the older one is auto-canceled — verify no customer ends with two live subs after any flow. _H1._

## 9. Admin bonus credits (H5)

- [ ] **Do:** As admin, grant a BASIC/PRO broker **+50** credits (`/api/admin/credits`).
- [ ] **Expect:** balance jumps by 50 now; `bonusCredits=50`. Advance a renewal (step 3) → credits = `tierGrant + 50`, **not** bare tierGrant. _H5._
- [ ] **PREMIUM guard:** try granting credits to a **PREMIUM** broker → **400 `UNLIMITED_PLAN`** (rejected). _H5 follow-up._

## 10. Chargeback (dispute) — newly handled

- [ ] **Do:** Subscribe a broker paying with `4000 0000 0000 0259` (the charge succeeds, then auto-disputes). Do **not** use `stripe trigger charge.dispute.created` — its synthetic charge has no customer/invoice, so the handler no-ops. The dispute can also race checkout; re-deliver it later with `replay:event` + `stripe events resend` to test cleanly.
- [ ] **Expect:** `charge.dispute.created` → handler maps `charge.customer → broker` → broker goes **PAST_DUE**, `responseCredits=0` (bonus intact), messaging blocked. _Dispute handler (2026 `charge.customer` mapping)._ (A `charge.refunded` does **not** auto-revoke — by design.)

## 11. Webhook robustness

- [ ] **Idempotency:** resend any processed event (Dashboard → resend) → handler returns `200 {duplicate:true}`, no double effect (no double credits, no double charge).
- [ ] **Signature:** `curl -XPOST .../api/webhooks/stripe -d '{}'` with a bad/no `stripe-signature` → **400** (and is not processed).
- [ ] **No retry storms:** watch the `stripe listen` / Dashboard delivery log across all of the above — every event should end at **200** (a stuck event retrying every few minutes = a bug; check logs).

---

## Pass criteria

✅ Every event in the delivery log ends at 200; DB `Subscription`/`Broker` state always matches what Stripe shows; no customer ever holds two live subscriptions; a paying broker is never stuck at 0 credits after a renewal; a recovered broker is never demoted by a stale failure; a chargeback revokes access. If all hold in test mode, you're cleared to switch on live keys.

> Reminder: switching to live mode means `STRIPE_SECRET_KEY=sk_live_…` + **live** price IDs + a **live-mode** webhook endpoint (new `whsec_…`) subscribed to the same events incl. `charge.dispute.created`. The boot validator enforces the `sk_live_`/`price_` prefixes in production.
