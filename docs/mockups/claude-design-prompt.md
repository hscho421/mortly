# Design brief — Mortly mobile app (paste into Claude Design)

> Tip: attach `docs/mockups/mobile-ui.html` (open it, screenshot the phone screens, or upload the file) as a visual reference alongside this prompt.

---

You are a senior product designer. Design the **native mobile app** (iOS + Android) for **Mortly**, a premium two-sided **mortgage marketplace**. The goal is a polished, intuitive, *native-feeling* app — **not** a website shrunk onto a phone. It must feel professional, premium, elegant, and truly native (iOS-first visual language, Android via the same system).

## Product in one paragraph
Borrowers post a **mortgage consultation request**; an admin approves it; **verified brokers** browse and respond; the two parties **chat in real time**. Brokers pay for tiered credits/entitlements. Admins moderate the marketplace. It's **bilingual, Korean-default / English-secondary** — design with **Korean** as the primary content language. One app, three role-based experiences: **Borrower · Broker · Admin**.

## Aesthetic direction (the most important part)
- **Native chrome, always.** iOS status bar, Dynamic Island, home indicator, safe-area insets. Large-title navigation bars that collapse to compact blurred headers on scroll. Blurred (translucent) bottom tab bars and headers. Inset/grouped lists. iOS-style segmented controls. iMessage-style chat bubbles with a docked composer.
- **Sharp corners are the brand signature.** Use small radii (~4–5px) on cards, buttons, inputs — a deliberate, editorial, high-end-fintech feel. Avoid big pill/rounded shapes except where iOS demands (tab pills, chat bubbles, avatars).
- **Gold, used sparingly.** Amber/gold is the single accent — active states, primary CTAs, verified badges, emphasis. Never flood with it.
- **Editorial micro-labels.** Use an uppercase **monospace** micro-label style (letter-spacing, small size) for section eyebrows, badges, timestamps, tab labels — it's a distinctive part of the brand.
- **Depth via restraint.** Hairline borders + soft, low shadows. Deep-navy gradient hero cards for emphasis. Generous whitespace and a clear type hierarchy. Calm, premium, trustworthy — this is a financial product.

## Brand & design tokens (use these exact values)

**Colors — "Midnight & Gold"**
- Forest (deep navy — primary text, dark surfaces, primary buttons): `#080c18 · #0f1729 · #1f2d52 · #2e3d68 · #3d4f82 · #5d6da3 · #8a96be · #b8c0d9 · #dde1ed · #f0f2f7`
- Cream (surfaces/backgrounds): `#fefefe · #f8f7f4 · #f0eeea · #e5e2dc · #d5d0c7 · #c0b9ad`
- Amber/Gold (accent): `#fdf9ef · #f9f0d5 · #f2dfa8 · #e6c96e · #d4a853 · #c49a3a · #a8812e · #8a6825`
- Sage (muted text/glyphs): `#e2e5ed · #c5cad9 · #9ea6bd · #7681a1 · #576285 · #454e6b`
- Semantic: success `#16a34a` · error `#dc2626` · warning `#d97706` · info `#2563eb`
- **Roles:** app background = cream-100 `#f8f7f4`; cards = cream-50 `#fefefe`; primary text = forest-800 `#0f1729`; muted text = sage-400/500; primary button = forest-800; accent/CTA = amber-500 `#c49a3a`; borders = cream-300 `#e5e2dc` (hairline).

**Typography**
- Display & body: **Outfit** (300–700). Korean: **Noto Sans KR**. Micro-labels/badges/timestamps: **IBM Plex Mono**.
- Ramp: large title ~30px/700 tracking-tight; screen title 17px/600; H2 19px/600; body 15–16px; caption 12–13px; mono micro-label 10–11px uppercase with ~0.12–0.16em tracking.

**Shape & spacing**
- Radius: 4–5px (cards/buttons/inputs), avatars circular, chat bubbles ~16px. Touch targets ≥ 44px. 8pt spacing rhythm. Shadows: `0 1px 3px rgba(15,23,41,.04)` for cards; slightly deeper for elevated CTAs.

**Iconography:** thin line icons (~1.6–1.7 stroke), consistent 20–22px in nav/tabs. No emoji as icons.

## Component system to design
Nav bars (large-title + compact blurred), **bottom tab bar** (blurred, mono uppercase labels, amber active underline + count badges), inset list rows (title/subtitle/leading icon or avatar/trailing chevron or value), cards (flat + gradient-hero variants), buttons (primary forest / gold accent / light-outline / ghost / destructive; sizes; loading & disabled), inputs (text, ₩ amount, select, segmented control, toggle, textarea; focus = amber ring; error state), chips & badges (neutral, gold, success, warning, forest, "verified" with a gold seal), avatars (initials on forest/gold gradients), chat bubbles (them = cream card, me = forest), and the four state components: **loading (skeletons), empty, error, success**.

## Screens to design (Korean content)
**Auth & onboarding:** Welcome/Sign-in (dark forest-gradient hero + Apple/Google/email), Sign-up, 6-digit email verification, role select, broker multi-step onboarding (profile + license + avatar), borrower first-run.
**Borrower:** Home/dashboard (active-request hero card + responding brokers + "새 상담 요청" CTA), Create-request long-form (segmented purpose, ₩ amount, region, property type, income, memo, step progress), My requests list, Request detail (status lifecycle + broker responses to compare), Browse brokers, Broker public profile, Messages list, Chat.
**Broker:** Home/dashboard (KPIs + verification status + read-only plan/credits chip), Browse requests (incl. the **PREMIUM early-access embargo** as a blurred/locked "opens in 12h" card, and credit-cost chips), Request detail → respond, Chat, Profile edit + avatar, **Subscription (read-only).**
**Admin (moderation-first):** Moderation inbox (pending broker verifications → approve/reject with reason; open reports → resolve), read-only context views, plus users/activity as secondary.
For each screen include its **loading / empty / error** state.

## Hard constraints
1. **No in-app purchase / billing.** The broker Subscription screen is **read-only** — show current tier (FREE/BASIC/PRO/PREMIUM), monthly credits + usage, renewal date, and a PAST_DUE banner, with a single neutral **"웹에서 플랜 관리 / Manage on the web"** action that hands off to the browser. **No prices-to-buy, no checkout, no payment-method entry, no upgrade/downgrade UI in the app.** (Avoids App/Play Store commission + anti-steering issues.)
2. **Admin v1 = moderation-first** (approve/reject verifications, resolve reports, read-only context). Heavy management (credit edits, system settings, analytics maps) stays out of the app.
3. **Korean-default, bilingual.** Design with natural Korean copy; ensure the layout also holds for English. No in-app language switcher.
4. **Sharp-corner brand identity** and **gold-sparingly** discipline as above.
5. Handle **safe areas, thumb-reachability, keyboard avoidance** (numeric pads for the amount/income fields), and **large touch targets**.

## Deliverables
- High-fidelity frames for each screen above, iOS device frames, **light mode** primary (note a dark-mode direction if you explore it).
- A component sheet (buttons, inputs, chips, list rows, tab bar, nav bars, chat, states) using the tokens.
- Consistent spacing/typographic system across all frames.
- Keep it **calm, premium, trustworthy, and unmistakably native** — a mortgage app people trust with a major financial decision.
