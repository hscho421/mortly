# Stripe test-mode smoke checklist

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

- [ ] **Do:** Create a charge with `4000 0000 0000 0259` (or `stripe trigger charge.dispute.created`), then dispute it.
- [ ] **Expect:** `charge.dispute.created` → broker goes **PAST_DUE**, `responseCredits=0` (bonus intact), messaging blocked. _Dispute handler._ (A `charge.refunded` does **not** auto-revoke — by design.)

## 11. Webhook robustness

- [ ] **Idempotency:** resend any processed event (Dashboard → resend) → handler returns `200 {duplicate:true}`, no double effect (no double credits, no double charge).
- [ ] **Signature:** `curl -XPOST .../api/webhooks/stripe -d '{}'` with a bad/no `stripe-signature` → **400** (and is not processed).
- [ ] **No retry storms:** watch the `stripe listen` / Dashboard delivery log across all of the above — every event should end at **200** (a stuck event retrying every few minutes = a bug; check logs).

---

## Pass criteria

✅ Every event in the delivery log ends at 200; DB `Subscription`/`Broker` state always matches what Stripe shows; no customer ever holds two live subscriptions; a paying broker is never stuck at 0 credits after a renewal; a recovered broker is never demoted by a stale failure; a chargeback revokes access. If all hold in test mode, you're cleared to switch on live keys.

> Reminder: switching to live mode means `STRIPE_SECRET_KEY=sk_live_…` + **live** price IDs + a **live-mode** webhook endpoint (new `whsec_…`) subscribed to the same events incl. `charge.dispute.created`. The boot validator enforces the `sk_live_`/`price_` prefixes in production.
