# Mortly Design System — Master Reference

> Privacy-first mortgage marketplace. Borrowers post anonymously, brokers compete with offers.
> Must feel: **trustworthy, secure, premium**. Must NOT feel: flashy, crypto, aggressive.

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

**Project:** Mortly
**Updated:** 2026-04-02

---

## 1. Visual Direction

### Style: Trust-Focused Minimal
- **Swiss Modernism 2.0** meets **Trust & Authority** — clean grid layouts, mathematical spacing, high contrast, trust signals prominent
- Generous whitespace, professional restraint, subtle depth (soft shadows, not gradients)
- Rounded but not bubbly (rounded-xl, not rounded-full for containers)
- Glass-morphism only for floating cards — keep backgrounds solid

### What Makes It Feel Premium & Safe
- Large, confident typography with serif headings (authority)
- High contrast ratios (7:1+ for primary text)
- Subtle grain texture overlay (already implemented — keep)
- Consistent 8px spacing grid
- Muted, desaturated accent colors (not neon)
- Deliberate negative space around CTAs
- Verified/trust badges near decision points

### What to AVOID
- Crypto gradients (neon purple-to-blue, rainbow)
- Dark mode as default (mortgage = serious business in daylight)
- Aggressive countdown timers or urgency tactics
- Parallax / scroll-jacking / heavy scroll animations
- Glassmorphism on dark backgrounds
- Emojis as icons — use SVG icons (Lucide or Heroicons)
- Scale transforms on hover that shift layout
- Decorative illustrations that don't serve a purpose

---

## 2. Color System

### Core Palette (Midnight & Gold) — KEEP EXISTING

Validated against Banking/Traditional Finance best practices (#0F172A + #CA8A04 — "Trust navy + premium gold").

```
Token             Tailwind Class      Hex         Usage
─────────────────────────────────────────────────────────────
forest-800        bg-forest-800       #0f1729     Primary dark / buttons / nav
forest-700        bg-forest-700       #1f2d52     Hover states / secondary dark
forest-600        bg-forest-600       #2e3d68     Focus rings / active states
forest-500        bg-forest-500       #3d4f82     Disabled dark text
forest-200        bg-forest-200       #b8c0d9     Selection background
forest-50         bg-forest-50        #f0f2f7     Light tinted backgrounds

cream-100         bg-cream-100        #f8f7f4     Page background (body)
cream-200         bg-cream-200        #f0eeea     Section alternation
cream-300         bg-cream-300        #e5e2dc     Borders / dividers
cream-50          bg-cream-50         #fefefe     Card backgrounds

amber-500         bg-amber-500        #c49a3a     Primary CTA / gold accent
amber-400         bg-amber-400        #d4a853     CTA hover
amber-600         bg-amber-600        #a8812e     CTA pressed / text links
amber-300         bg-amber-300        #e6c96e     Highlight / hero accent text

sage-400          bg-sage-400         #7681a1     Placeholder text
sage-500          bg-sage-500         #576285     Secondary text / labels
sage-600          bg-sage-600         #454e6b     Tertiary buttons / muted UI
```

### Semantic Tokens — ADD THESE

```
Token             Tailwind Class      Hex         Usage
─────────────────────────────────────────────────────────────
success-50        bg-success-50       #f0fdf4     Success background
success-500       bg-success-500      #22c55e     Success icon / badge
success-700       text-success-700    #15803d     Success text

error-50          bg-error-50         #fef2f2     Error background
error-500         bg-error-500        #ef4444     Error icon / border
error-700         text-error-700      #b91c1c     Error text

warning-50        bg-warning-50       #fffbeb     Warning background
warning-500       bg-warning-500      #f59e0b     Warning icon
warning-700       text-warning-700    #b45309     Warning text

info-50           bg-info-50          #eff6ff     Info background
info-500          bg-info-500         #3b82f6     Info icon / link
info-700          text-info-700       #1d4ed8     Info text
```

### Contrast Requirements
- Body text on cream-100: forest-800 (#0f1729) = 15.3:1 AAA
- Muted text on cream-100: forest-700/80 (#1f2d52cc) >= 7:1 AAA
- Amber-500 on forest-800: 5.8:1 AA (large text / buttons)
- All text must meet WCAG AA minimum (4.5:1 normal, 3:1 large)

---

## 3. Typography Scale

### Font Stack — KEEP EXISTING
- **Display (headings):** DM Serif Display — serif authority, professional weight
- **Body:** Outfit — geometric sans-serif, modern readability
- **Korean override:** Pretendard — already configured per-locale

### Type Scale (Desktop / Mobile)

```
Token          Desktop              Mobile               Line Height    Usage
────────────────────────────────────────────────────────────────────────────────────
heading-hero   text-6xl (60px)      text-3xl (30px)      leading-[1.05] Hero headlines only
heading-xl     text-5xl (48px)      text-3xl (30px)      leading-tight  Section headlines
heading-lg     text-4xl (36px)      text-2xl (24px)      leading-tight  Page titles
heading-md     text-2xl (24px)      text-xl (20px)       leading-snug   Card titles / subheads
heading-sm     text-xl (20px)       text-lg (18px)       leading-snug   Small section heads
body-lg        text-lg (18px)       text-base (16px)     leading-relaxed Hero subtitles
body           text-base (16px)     text-base (16px)     leading-relaxed Default paragraph
body-sm        text-sm (14px)       text-sm (14px)       leading-relaxed Captions / meta
caption        text-xs (12px)       text-xs (12px)       leading-normal Labels / timestamps
overline       text-xs uppercase    text-xs uppercase    tracking-[0.2em] Section labels
```

### Typography Rules
- Max line length: 65-75 characters (`max-w-prose` or `max-w-xl`)
- Heading color: `text-forest-800` (always)
- Body color: `text-forest-700/80`
- Link color: `text-amber-600 hover:text-amber-700 underline-offset-2`
- Never use font-weight below 400 for body text
- Headings: font-display (DM Serif Display)
- Everything else: font-body (Outfit)

---

## 4. Spacing & Layout System

### 8px Base Grid

```
Token    Value    Tailwind    Usage
─────────────────────────────────────────────────
0        0px      p-0         Reset
1        4px      p-1         Icon padding, tight gaps
2        8px      p-2         Inline element gaps
3        12px     p-3         Form field internal padding
4        16px     p-4         Card internal padding (mobile)
5        20px     p-5         Default component gaps
6        24px     p-6         Card internal padding (desktop)
8        32px     p-8         Section gaps (small)
10       40px     p-10        Component group gaps
12       48px     p-12        Section padding (small)
16       64px     p-16        Section padding (medium)
20       80px     p-20        Section padding (large)
```

### Page Layout

```
Container:     max-w-7xl mx-auto (1280px)
Narrow:        max-w-3xl mx-auto (768px) — for forms, single-column content
Section:       px-4 py-20 sm:px-6 lg:px-8 xl:py-28 (use .section-padding)
Card Grid:     grid md:grid-cols-2 lg:grid-cols-3 gap-6
Dashboard:     grid lg:grid-cols-12 gap-6 (sidebar: col-span-3, main: col-span-9)
```

### Z-Index Scale

```
Layer            z-index    Usage
──────────────────────────────────────
base             0          Default content
card-hover       10         Elevated cards on hover
sticky           20         Sticky headers / subnavs
dropdown         30         Dropdown menus / popovers
nav              40         Main navbar (sticky)
overlay          50         Modal backdrops
modal            60         Modal content
toast            70         Toast notifications
grain            9999       Grain overlay (keep as-is)
```

---

## 5. Component Patterns

### Buttons

```
Primary:      .btn-primary (forest-800 bg, cream text)     — main actions
CTA:          .btn-amber (amber-500 bg, forest-900 text)   — conversion actions
Secondary:    .btn-secondary (forest-800 border, outline)   — secondary actions
Ghost:        .btn-ghost — bg-transparent text-forest-700 hover:bg-cream-200
Destructive:  .btn-destructive — bg-error-500 text-white hover:bg-error-600
```

Sizing:
```
sm:  px-4 py-2 text-xs rounded-lg
md:  px-6 py-3 text-sm rounded-lg     (default)
lg:  px-8 py-4 text-base rounded-lg   (hero CTAs)
```

All buttons: `cursor-pointer`, `transition-all duration-300`, `active:scale-[0.98]`, `disabled:opacity-50 disabled:cursor-not-allowed`

### Cards

```
Default (.card):
  rounded-2xl border border-cream-300 bg-white/80 backdrop-blur-sm
  p-6 shadow-sm transition-all duration-300
  hover:shadow-md hover:border-sage-200

Elevated (.card-elevated):
  rounded-2xl border border-cream-200 bg-white
  p-8 shadow-lg shadow-forest-800/5

Interactive (.card-interactive):
  card + cursor-pointer + hover:-translate-y-1 + ring focus states

Stat Card (.card-stat):
  rounded-xl bg-white p-6 border border-cream-200
  icon + value (heading-lg) + label (text-body-sm) + trend indicator

Selected (.card-selected):
  ring-2 ring-amber-500 border-amber-500 shadow-amber-500/10
```

### Forms

```
Input:     .input-field (rounded-xl, cream-300 border, forest-600 focus ring)
Label:     .label-text (text-sm font-medium text-forest-700)
Error:     text-sm text-error-600 mt-1 + input border-error-500 ring-error-500/10
Help text: text-xs text-sage-500 mt-1
Required:  after:content-['*'] after:ml-0.5 after:text-error-500

Form Group:   space-y-1.5 (label > input > error/help)
Form Row:     grid md:grid-cols-2 gap-4
Form Section: space-y-6 with heading-sm divider
```

Progress Stepper (for request submission):
```
Active step:    forest-800 bg circle + amber-500 connector line
Completed:      forest-800 bg with check icon
Upcoming:       cream-300 border circle, sage-400 text
Connector:      h-0.5 bg-cream-300 (complete: bg-amber-500)
```

### Navigation

```
Navbar (existing):
  sticky top-0 z-40 bg-cream-100/95 backdrop-blur-md border-b border-cream-300
  Height: h-16 (64px)
  Content offset: pt-16 on main content

Dashboard Sidebar:
  w-64 bg-white border-r border-cream-200
  Nav items: px-4 py-2.5 rounded-lg text-sm
  Active: bg-forest-50 text-forest-800 font-medium
  Hover: bg-cream-100 text-forest-700
  Icon + Label + optional badge
```

### Messaging UI

```
Chat Container: h-[calc(100vh-4rem)] flex flex-col
Message List:   flex-1 overflow-y-auto p-4 space-y-4
Sent bubble:    ml-auto max-w-[75%] bg-forest-800 text-cream-100 rounded-2xl rounded-br-sm px-4 py-3
Received bubble: mr-auto max-w-[75%] bg-white border border-cream-300 rounded-2xl rounded-bl-sm px-4 py-3
Timestamp:      text-xs text-sage-400 mt-1
Input Area:     border-t border-cream-200 p-4 flex gap-3
```

### Badges & Tags

```
.badge-success:  bg-success-50 text-success-700  (active, verified)
.badge-warning:  bg-warning-50 text-warning-700  (pending)
.badge-error:    bg-error-50 text-error-700       (rejected)
.badge-info:     bg-info-50 text-info-700         (informational)
.badge-verified: bg-success-50 text-success-700 + shield icon
```

---

## 6. Interaction Patterns

### Hover States
- Buttons:   color shift + shadow-lg (200-300ms ease)
- Cards:     shadow-md + border color change + slight -translate-y-1
- Links:     color shift (amber-600 > amber-700) + underline-offset
- Nav items: bg-cream-100 background fade-in
- Table rows: bg-cream-50 background

### Focus States
- All interactive: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2`
- Inputs: `focus:border-forest-600 focus:ring-2 focus:ring-forest-600/10`

### Transitions
- Micro-interactions: 150-200ms ease (color changes, opacity)
- Layout changes: 300ms ease-out (card hovers, panel slides)
- Page entrance: 400-600ms ease-out (fade-in-up on mount)
- Never exceed 600ms for any single animation

### Loading States
- Button loading: opacity-75 + spinner icon + disabled
- Skeleton: animate-pulse bg-cream-200 rounded-lg
- Page loading: centered spinner with brand color
- Data tables: skeleton rows matching column widths

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 7. Landing Page Flow (Trust + Conversion)

### Ideal Section Order

```
1. HERO — Dark forest-800 bg, serif headline, amber CTA
   Current implementation is good. Keep shield icon visual.

2. LIVE ACTIVITY MARQUEE — Social proof via platform activity. Keep.

3. HOW IT WORKS — 3 numbered steps with connector lines. Keep.

4. TRUST & SECURITY — ADD
   "Your Privacy, Our Priority"
   3-4 trust cards: Privacy, Verified Brokers, No Spam, Data Protection
   Shield/lock Lucide icons

5. SOCIAL PROOF — ADD
   Stats: "X requests posted", "Y brokers", "Z connections"
   2-3 anonymized testimonial cards with star ratings

6. SPLIT VALUE PROP — ADD
   Two columns: Borrower benefits | Broker benefits
   Each with own CTA

7. FAQ ACCORDION — ADD
   5-7 questions addressing privacy and process

8. FINAL CTA — Full-width forest-800 section
   Repeat primary amber CTA
```

---

## 8. Dashboard Layouts

### Borrower Dashboard
```
Sidebar (lg:w-64): Dashboard, My Requests, Offers, Messages, Profile
Main: Welcome header + [New Request] CTA
      Stat cards row (Active, Offers, Messages, Connections)
      Recent Offers (top 3 cards)
      My Requests (status list)
```

### Broker Dashboard
```
Sidebar (lg:w-64): Dashboard, Available Requests, Introductions, Conversations, Billing, Profile
Main: Dashboard header + [Subscription] link
      Stat cards row (Available, Active, Success Rate, Credits)
      New Matching Requests (filtered list)
      Recent Activity
```

---

## 9. Request Submission Flow

### Multi-Step (3 steps + confirmation)

```
Step 1: Basics (3 fields)
  Loan type (radio cards) | Property type (radio cards) | Amount (numeric)

Step 2: Details (3-4 fields)
  Location | Timeline (dropdown) | Credit range (radio cards) | Notes (optional)

Step 3: Review & Submit
  Summary card | Edit links | Privacy reminder | Trust badge

Step 4: Confirmation
  Success animation | "Offers coming soon" | [Dashboard] [Another]
```

Rules: Max 3-4 fields/step, radio cards > dropdowns for <5 options, auto-save, clear Back button, min 44x44 touch targets.

---

## 10. Offer Comparison UI

### Desktop: Side-by-side table
- Columns: Broker name + rating + verified badge
- Rows: Rate, APR, Monthly Payment, Closing Costs, Term, Lock Period
- Highlight "Best" per metric with amber-500 badge
- Sort controls: rate, monthly payment, closing costs, rating
- [Connect] CTA per column

### Mobile: Stacked cards
- One card per offer, vertically stacked
- Best-value badge on top card
- Key metrics: Rate, Monthly, Closing, Term
- [Connect] CTA per card

### Decision Support
- "Best Rate" / "Lowest Closing" badges
- Sort/filter controls
- Broker verification + star ratings prominent
- Optional: "Total cost over 5 years" helper

---

## 11. Conversion Optimization

### CTA Placement
- Hero: btn-amber "Get Started" (lg)
- After How It Works: btn-primary "Post a Request"
- After Trust Section: btn-amber "Get Started"
- After Social Proof: btn-primary "Join Now"
- Sticky mobile bar: btn-amber fixed bottom (mobile only)
- Dashboard empty states: btn-amber centered
- Offer cards: btn-primary [Connect] per card

### Trust Signals — Near Decision Points
- "Your data stays private" → next to form submit
- Verified broker badge → every broker/offer card
- Star ratings → broker cards + comparison
- Shield/lock icon → sensitive form sections
- Aggregate stats → landing hero or trust section
- No-spam guarantee → near email capture

### Cognitive Load Reduction
- Progressive disclosure in forms
- Smart defaults for common options
- Inline validation on blur
- Help tooltips for financial jargon
- Highlight best value per comparison metric
- Default sort by most important metric
- Limit default view to 3-4 key metrics

---

## 12. Tailwind Config Additions

### Colors to add:
```js
success: { 50: '#f0fdf4', 100: '#dcfce7', 500: '#22c55e', 600: '#16a34a', 700: '#15803d' },
error:   { 50: '#fef2f2', 100: '#fee2e2', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c' },
warning: { 50: '#fffbeb', 100: '#fef3c7', 500: '#f59e0b', 600: '#d97706', 700: '#b45309' },
info:    { 50: '#eff6ff', 100: '#dbeafe', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8' },
```

### Shadows to add:
```js
'card': '0 1px 3px rgba(15,23,41,0.04), 0 1px 2px rgba(15,23,41,0.06)',
'card-hover': '0 10px 15px rgba(15,23,41,0.06), 0 4px 6px rgba(15,23,41,0.04)',
'elevated': '0 20px 25px rgba(15,23,41,0.08), 0 8px 10px rgba(15,23,41,0.04)',
'amber-glow': '0 4px 14px rgba(196,154,58,0.25)',
```

---

## 13. Component File Structure

```
components/
├── ui/           Button, Card, Badge, Input, Stepper, Modal, Tooltip, Skeleton, Toast
├── layout/       Layout, DashboardLayout, AdminLayout, Navbar, Footer, Sidebar
├── features/     RequestForm, OfferCard, OfferComparison, BrokerCard, ChatBubble, TrustSection
└── shared/       LiveActivityMarquee, Pagination, StatusBadge
```

---

## 14. Implementation Priority

### Phase 1 — Foundation
1. Add semantic colors to tailwind.config.ts
2. Add new component classes to globals.css
3. Add skip-link + prefers-reduced-motion

### Phase 2 — Landing Page
4. Add Trust & Security section
5. Add Social Proof section
6. Add split value prop + FAQ
7. Add sticky mobile CTA

### Phase 3 — Core Flows
8. Multi-step request form stepper
9. Offer comparison component
10. Dashboard layout standardization
11. Messaging UI improvements

### Phase 4 — Polish
12. Skeleton loading states
13. Toast notifications
14. Financial term tooltips
15. Full accessibility audit

---

## Pre-Delivery Checklist

- [ ] No emojis as icons (use Lucide SVG)
- [ ] All interactive elements have cursor-pointer
- [ ] Hover: smooth transitions (150-300ms), no layout shift
- [ ] Focus: visible ring on all interactive elements
- [ ] Contrast: 4.5:1 minimum for all text
- [ ] Forms: proper labels, error states, aria attributes
- [ ] prefers-reduced-motion respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No horizontal scroll
- [ ] Skip link for keyboard navigation
- [ ] All images have alt text
- [ ] Loading states for async operations
