export const meta = {
  name: 'mortly-security-audit',
  description: 'Pre-launch pentest review of Mortly: 18 security dimensions, adversarial verification, completeness critic',
  phases: [
    { title: 'Audit', detail: 'one finder agent per security dimension, reads real code' },
    { title: 'Verify', detail: 'independent skeptic re-reads code paths to confirm/refute each finding' },
    { title: 'Critic', detail: 'completeness critic looks for missed areas + regression check' },
  ],
}

// ────────────────────────────────────────────────────────────────────────
// Shared architecture context — gathered inline before this workflow ran.
// Embedded so finders don't each re-discover the whole tree. Finders MUST
// still open and read the real files and cite exact line numbers.
// ────────────────────────────────────────────────────────────────────────
const CONTEXT = `
MORTLY — mortgage marketplace for Korean-speaking Canadians. Borrowers submit sensitive
financial inquiries; brokers/lenders respond. PRIMARY TRUST BOUNDARY: borrower request
data must never reach unauthorized brokers, other borrowers, or unauthenticated callers.

STACK: Next.js 16 (Pages Router) on Vercel · React 19 · Prisma 5.22 + PostgreSQL ·
NextAuth 4.24 (JWT strategy) · Supabase Realtime (chat) · Stripe (broker subscriptions/credits) ·
Resend (email) · expo-server-sdk (push) · Vercel KV (rate limiting) · PostHog (analytics) ·
i18n ko/en. TypeScript throughout.

AUTH MODEL (lib/auth.ts):
- NextAuth JWT sessions. Credentials (bcrypt), Google, Apple providers.
- Server-side revocation: User.tokenVersion embedded in JWT, re-checked every session
  read against a 5s per-lambda DB cache (sessionDbCache). revokeUserSessions() bumps it.
- session callback returns null when tokenVersion mismatches OR status != ACTIVE.
- Cookies: __Secure- prefix in prod, httpOnly, sameSite=lax, secure in prod.
- Roles: BORROWER, BROKER, ADMIN (Role enum).

AUTH WRAPPERS (the enforcement layer — audit every route for correct usage):
- lib/withAuth.ts — withAuth(handler, {roles?, rateLimit?, skipCsrf?}). 401 if no session,
  403 if role not allowed, CSRF origin gate on mutating methods (bypassed by x-mortly-mobile:1
  header), per-user KV rate limit. ValidationError->400, generic 500 catch.
- lib/admin/withAdmin.ts — withAdmin(handler, {rateLimitGet?}). 401/403, CSRF + 30/min mutate
  rate limit; GET unlimited unless rateLimitGet opts into 600/min.
- lib/origin.ts — isAllowedOrigin() CSRF check; getSafeRedirectOrigin() for Stripe URLs.
- lib/rate-limit.ts — KV-backed checkRateLimit (FAILS OPEN on KV error), in-memory dev fallback,
  legacy authLimiter/verifyCodeLimiter, getClientIp (uses x-real-ip / last XFF entry).
- lib/validate.ts — assertString/Int/Enum/HttpsUrl/Phone/BoundedJson primitives.

API ROUTES (pages/api/):
  auth/[...nextauth].ts, auth/signup.ts, auth/verify-email.ts, auth/resend-code.ts,
  auth/forgot-password.ts, auth/reset-password.ts, auth/select-role.ts, auth/mobile-oauth.ts
  borrowers/profile.ts · brokers/profile.ts · brokers/mark-requests-seen.ts ·
  brokers/requests/[id]/mark-seen.ts
  requests/index.ts · requests/[id].ts
  conversations/index.ts · conversations/[id].ts
  messages/index.ts · messages/unread.ts
  reports.ts · notices.ts · preferences.ts · notifications/register-device.ts
  users/me.ts · users/blocked.ts · users/[publicId]/block.ts
  stripe/create-checkout.ts · stripe/create-portal.ts · stripe/invoices.ts ·
  webhooks/stripe.ts
  cron/auto-close-conversations.ts · cron/expire-requests.ts · maintenance.ts
  admin/* (actions, brokers/[id], brokers/index, conversations/[id], conversations/index,
    credits, queue, reports/[id], reports/index, reports/summary, requests/[id], requests/index,
    settings, stats, trends, users/[id], users/bulk, users/create, users/index)

DATA MODELS (prisma/schema.prisma): User (passwordHash, googleId, appleId, role, status,
  tokenVersion, verificationCode, resetToken, preferences Json), Broker (stripeCustomerId,
  subscriptionTier, responseCredits, verificationStatus), BorrowerRequest (details Json holds
  financials: loan amount, province/city, income tables, corporate income), Conversation
  (borrowerId, brokerId, msg counters, lastReadAt), Message (body VarChar 5000, isSystem),
  Subscription, ProcessedStripeEvent (webhook idempotency), Report, AdminAction, AdminNotice,
  SystemSetting, DeviceToken, UserBlock. NOTE: no SIN/SSN column exists in schema — sensitive
  data is financial details JSON, not government IDs (verify this claim).

SENSITIVE PII: borrower financial details (loan amount, income, location, timeline) in
  BorrowerRequest.details (Json) and notes; email; passwordHash; verificationCode; resetToken;
  Stripe customer/subscription IDs; device push tokens. Korean names/text throughout.

KNOWN HARDENING (check for regressions): commit bc3e811 "Security hardening";
  migrations 20260501000000_security_hardening_phase_2, 20260501010000_engineering_audit_phase_1.
  Origin helper notes Stripe success_url/cancel_url was "a confirmed open-redirect path before
  this helper existed". getClientIp notes leftmost XFF was spoofable.

ALREADY OBSERVED inline (verify, don't assume): secrets are env-based, .env/.env.local are
  gitignored & not in git history; only raw SQL is in prisma/seed.ts ($executeRawUnsafe, static
  strings) and admin/trends.ts ($queryRaw tagged template); only one dangerouslySetInnerHTML
  (components/SEO.tsx JSON-LD). CSP keeps 'unsafe-inline' + 'unsafe-eval' in script-src.

RULES FOR THIS AUDIT:
- READ-ONLY. Never Edit/Write/modify any file. Use Read, Grep, Glob, Bash (read-only) only.
- Cite REAL file paths and REAL line numbers you actually saw. Quote exact code snippets.
- Never invent vulnerabilities. If code is safe, say so and why. If inconclusive, flag what
  more is needed. Ignore pure style. Mortgage/borrower-data context in every attack scenario.
`

const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['dimension', 'summary', 'findings', 'safe_notes', 'inconclusive'],
  properties: {
    dimension: { type: 'string' },
    summary: { type: 'string', description: '2-4 sentence overview of what this dimension found' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'severity', 'file', 'lines', 'snippet', 'why_exploitable', 'attack_scenario', 'recommended_fix', 'confidence'],
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['Critical', 'High', 'Medium', 'Low', 'Info'] },
          file: { type: 'string', description: 'real path, e.g. pages/api/requests/[id].ts' },
          lines: { type: 'string', description: 'real line numbers, e.g. 42-51' },
          snippet: { type: 'string', description: 'exact code quoted from the file' },
          why_exploitable: { type: 'string' },
          attack_scenario: { type: 'string', description: 'concrete Mortly-specific exploit walkthrough' },
          recommended_fix: { type: 'string', description: 'exact change to make' },
          confidence: { type: 'string', enum: ['confirmed', 'needs-manual-verification'] },
        },
      },
    },
    safe_notes: {
      type: 'array',
      description: 'Things explicitly checked and confirmed safe, with the reason why',
      items: { type: 'string' },
    },
    inconclusive: {
      type: 'array',
      description: 'Areas that could not be concluded and what extra context is needed',
      items: { type: 'string' },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'corrected_severity', 'reasoning'],
  properties: {
    verdict: {
      type: 'string',
      enum: ['confirmed', 'needs-manual-verification', 'false-positive'],
      description: 'confirmed = you read the code and the vuln is real & exploitable; false-positive = a guard/check the finder missed makes it safe; needs-manual-verification = real concern but depends on runtime/config you cannot see',
    },
    corrected_severity: { type: 'string', enum: ['Critical', 'High', 'Medium', 'Low', 'Info'] },
    reasoning: { type: 'string', description: 'what you read (cite file:line) and why you reached this verdict' },
    missed_guard: { type: 'string', description: 'if false-positive, the exact guard/line the finder overlooked' },
  },
}

const CRITIC_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['missed_areas', 'additional_findings', 'regression_check', 'coverage_assessment'],
  properties: {
    missed_areas: { type: 'array', items: { type: 'string' } },
    additional_findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'severity', 'file', 'lines', 'why', 'recommended_fix'],
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['Critical', 'High', 'Medium', 'Low', 'Info'] },
          file: { type: 'string' },
          lines: { type: 'string' },
          why: { type: 'string' },
          recommended_fix: { type: 'string' },
        },
      },
    },
    regression_check: { type: 'string', description: 'findings re: whether previously-hardened issues regressed' },
    coverage_assessment: { type: 'string' },
  },
}

// ────────────────────────────────────────────────────────────────────────
// The 18 audit dimensions. Each gets a focused finder.
// ────────────────────────────────────────────────────────────────────────
const DIMENSIONS = [
  {
    key: 'authz-idor-borrower',
    title: 'Authorization & IDOR — borrower data isolation (HIGHEST PRIORITY)',
    focus: `THE core trust boundary. For EVERY route that reads/writes BorrowerRequest, Conversation,
Message, Report, borrower/broker profile, blocks, device tokens: verify it checks that the
authenticated user OWNS the resource (borrowerId===session.user.id, or is the broker party to
the conversation, etc.) BEFORE returning or mutating data. Look for:
- requests/[id].ts, conversations/[id].ts, conversations/index.ts, messages/index.ts,
  messages/unread.ts, brokers/requests/[id]/mark-seen.ts, borrowers/profile.ts, brokers/profile.ts,
  reports.ts, users/[publicId]/block.ts, users/blocked.ts, preferences.ts,
  notifications/register-device.ts, stripe/invoices.ts.
- Can a broker read a borrower request they were never connected to? Which request fields are
  exposed to brokers in the marketplace browse vs. a connected conversation? Is borrower contact
  info / full financials leaked to brokers who haven't been engaged?
- Can borrower A read borrower B's request/conversation/messages by guessing/enumerating the id
  or publicId? Are cuid ids or sequential? Is the conversation participant check correct for BOTH
  borrower and broker sides?
- Can a user POST a message into a conversation they aren't part of? Mark someone else's request seen?
- Mass-assignment: can the borrowerId/brokerId/ownerId be set from the request body?`,
    files: ['pages/api/requests/[id].ts', 'pages/api/requests/index.ts', 'pages/api/conversations/[id].ts', 'pages/api/conversations/index.ts', 'pages/api/messages/index.ts', 'pages/api/messages/unread.ts', 'pages/api/reports.ts', 'pages/api/borrowers/profile.ts', 'pages/api/brokers/profile.ts', 'pages/api/brokers/requests/[id]/mark-seen.ts', 'pages/api/brokers/mark-requests-seen.ts', 'pages/api/users/[publicId]/block.ts', 'pages/api/users/blocked.ts', 'pages/api/preferences.ts', 'pages/api/stripe/invoices.ts'],
  },
  {
    key: 'authn-session',
    title: 'Authentication & session handling',
    focus: `lib/auth.ts, [...nextauth].ts, signup, verify-email, resend-code, forgot-password,
reset-password, select-role, mobile-oauth. Check: password hashing (bcrypt cost), credential
authorize flow, the tokenVersion revocation logic (does the 5s cache create a usable revocation
gap? cross-lambda?), JWT secret handling, session maxAge, OAuth account-linking (can you take over
an account by signing in with Google for an email that exists with a password? see signIn callback
existingByEmail branch), Apple/Google token verification in mobile-oauth.ts (is the id_token
signature + audience actually verified, or trusted blindly?), reset-token generation/entropy/expiry/
single-use, verification-code generation (predictable? brute-forceable? attempt cap?), select-role
(can a user escalate to ADMIN via select-role?).`,
    files: ['lib/auth.ts', 'pages/api/auth/[...nextauth].ts', 'pages/api/auth/signup.ts', 'pages/api/auth/verify-email.ts', 'pages/api/auth/resend-code.ts', 'pages/api/auth/forgot-password.ts', 'pages/api/auth/reset-password.ts', 'pages/api/auth/select-role.ts', 'pages/api/auth/mobile-oauth.ts'],
  },
  {
    key: 'authz-admin',
    title: 'Admin authorization, role separation & privilege escalation',
    focus: `Every pages/api/admin/* route + lib/admin/*. Verify withAdmin wraps ALL of them (grep for
any admin route NOT using withAdmin). Check admin/users/create.ts and admin/users/[id].ts: can an
admin create another ADMIN? can role be escalated? Is there any path for a non-admin to reach admin
data (e.g. an admin handler accidentally exported without the wrapper, or a shared SSR data fn)?
Check lib/admin/ssrAuth.ts and lib/admin/withAdmin.ts page-level guards. Check admin/users/bulk.ts
for dangerous bulk operations. select-role and preferences for role tampering. Is responseCredits /
subscriptionTier mutable by the broker themselves via any non-admin endpoint?`,
    files: ['lib/admin/withAdmin.ts', 'lib/admin/ssrAuth.ts', 'lib/admin/withAdmin.ts', 'pages/api/admin/users/create.ts', 'pages/api/admin/users/[id].ts', 'pages/api/admin/users/bulk.ts', 'pages/api/admin/actions.ts', 'pages/api/admin/credits.ts', 'pages/api/admin/settings.ts', 'pages/api/auth/select-role.ts'],
  },
  {
    key: 'input-validation-massassignment',
    title: 'Input validation, mass assignment & output over-exposure',
    focus: `For every mutating endpoint: is the request body validated (lib/validate.ts) before hitting
Prisma? Look for Prisma create/update calls that spread req.body or pass unvalidated objects (mass
assignment — e.g. allowing a borrower to set status, borrowerId, role, responseCredits, tokenVersion,
emailVerified). Look for OUTPUT over-exposure: Prisma queries that return the full User (passwordHash,
verificationCode, resetToken, tokenVersion, googleId) to the client — check select/include usage in
users/me.ts, profile endpoints, conversations, admin endpoints. Does any borrower-facing response leak
another user's email/PII? Check JSON details bound size + structure on requests/index.ts.`,
    files: ['pages/api/users/me.ts', 'pages/api/requests/index.ts', 'pages/api/borrowers/profile.ts', 'pages/api/brokers/profile.ts', 'pages/api/preferences.ts', 'pages/api/notifications/register-device.ts', 'lib/validate.ts'],
  },
  {
    key: 'db-queries',
    title: 'Database queries — raw SQL, ORM misuse, injection',
    focus: `prisma/seed.ts ($executeRawUnsafe), pages/api/admin/trends.ts ($queryRaw tagged templates).
Verify the trends.ts tagged templates interpolate no user input unsafely (tagged template = param'd,
but check any string concat). Grep the whole repo for $queryRawUnsafe/$executeRawUnsafe/$queryRaw/
$executeRaw and check each. Check Prisma orderBy/where built from user-controlled keys (sort/filter
params on admin list endpoints and marketplace browse — can a user inject an arbitrary column or
relation to exfiltrate?). Check lib/admin/query.ts. Check for skip/take pagination DoS (unbounded take).`,
    files: ['prisma/seed.ts', 'pages/api/admin/trends.ts', 'lib/admin/query.ts', 'pages/api/admin/requests/index.ts', 'pages/api/admin/users/index.ts', 'pages/api/requests/index.ts'],
  },
  {
    key: 'secrets-env',
    title: 'Secrets & environment variables',
    focus: `Grep the entire repo (excluding node_modules/.next/.git) for hardcoded secrets: API keys,
private keys, bearer tokens, password literals, Stripe sk_, Resend re_, Google client secrets, JWT
secrets, DB URLs. Check that NEXT_PUBLIC_* vars contain ONLY publishable/anon values (anon supabase
key, stripe publishable, posthog token are OK; flag any secret accidentally NEXT_PUBLIC_). Check
seed.ts for hardcoded passwords (commit "seed update password"). Check that APPLE_PRIVATE_KEY and
service keys are read from env not committed. Confirm .env not tracked (already observed). Look at
.mcp.json, vercel.json, app.json, instrumentation-client.ts, posthog config for leaked tokens.`,
    files: ['prisma/seed.ts', 'lib/stripe.ts', 'lib/supabase.ts', 'lib/email.ts', 'lib/posthog-server.ts', 'instrumentation-client.ts', '.mcp.json', 'vercel.json'],
  },
  {
    key: 'cors-csrf-cookies-headers-redirects',
    title: 'CORS, CSRF, cookies, headers & open redirect',
    focus: `lib/origin.ts CSRF gate quality: is Origin/Referer matching robust (can the allowlist be
bypassed with a crafted Origin like https://mortly.ca.evil.com or null origin)? The x-mortly-mobile:1
header BYPASSES CSRF entirely (withAuth) — is that exploitable from a browser (it's a custom header so
CORS-preflight-protected, but confirm)? Check Stripe success_url/cancel_url/return_url in
create-checkout.ts & create-portal.ts use getSafeRedirectOrigin() not req.headers.origin (regression
of the noted open-redirect). Check next.config.mjs CSP: 'unsafe-inline'+'unsafe-eval' in script-src
weakens XSS defense — assess. Cookie flags. Any res.redirect() built from user input. CORS headers
set anywhere (Access-Control-Allow-Origin: *)?`,
    files: ['lib/origin.ts', 'lib/withAuth.ts', 'lib/admin/withAdmin.ts', 'pages/api/stripe/create-checkout.ts', 'pages/api/stripe/create-portal.ts', 'next.config.mjs'],
  },
  {
    key: 'korean-utf8',
    title: 'Korean / UTF-8 input handling',
    focus: `lib/normalizeEmail.ts (does it break on unicode/IDN/homoglyph emails? can two different
emails normalize to the same account?), validation length checks (are they counting code units vs
grapheme clusters — Korean text + emoji length DoS?), DB collation for Korean (VarChar 5000 message
cap — is it bytes or chars? Korean is 3 bytes UTF-8, could a 5000-char Korean message exceed DB limits
or get truncated mid-character?). Check assertString trims/normalizes — any unicode normalization
(NFC/NFKC) that could be abused for homograph attacks in names/email. Search params encoding.`,
    files: ['lib/normalizeEmail.ts', 'lib/validate.ts', 'pages/api/messages/index.ts', 'pages/api/auth/signup.ts'],
  },
  {
    key: 'webhook-payment',
    title: 'Webhook signature verification & payment logic',
    focus: `pages/api/webhooks/stripe.ts: is the Stripe signature verified with constructEvent using
the raw body (Next.js parses body by default — is bodyParser disabled? if the raw body is wrong the
sig check is meaningless)? Is STRIPE_WEBHOOK_SECRET required (fail closed)? Idempotency via
ProcessedStripeEvent — race conditions (two concurrent identical events)? Does the handler grant
responseCredits / change subscriptionTier based on webhook data that could be spoofed if sig check is
weak? create-checkout.ts: can a broker manipulate price/tier/quantity/metadata to get a cheaper plan
or more credits? Is the customer/broker binding validated (can broker A check out as broker B)? Can a
borrower hit broker billing endpoints? Are credits ever granted client-side or on checkout creation
(should be webhook-only)?`,
    files: ['pages/api/webhooks/stripe.ts', 'pages/api/stripe/create-checkout.ts', 'pages/api/stripe/create-portal.ts', 'pages/api/stripe/invoices.ts', 'lib/stripe.ts'],
  },
  {
    key: 'email-enumeration-tokens',
    title: 'Email/notification — enumeration, token leakage, spoofing',
    focus: `forgot-password.ts: does it reveal whether an email exists (different response/timing for
known vs unknown)? Is the reset link/token emailed safely (not logged, not in URL query that leaks via
Referer, single-use, expiring, high-entropy)? signup.ts & verify-email & resend-code: account
enumeration via signup ("email already exists") and verification-code brute force (attempt cap?
verificationAttempts field — enforced?). lib/email.ts & lib/push.ts: are tokens/codes/financial
details logged or included in push payloads (push.ts comment mentions financial detail leakage risk)?
Email header injection via user-controlled name/subject. notices.ts admin notice spoofing.`,
    files: ['pages/api/auth/forgot-password.ts', 'pages/api/auth/reset-password.ts', 'pages/api/auth/signup.ts', 'pages/api/auth/verify-email.ts', 'pages/api/auth/resend-code.ts', 'lib/email.ts', 'lib/push.ts', 'pages/api/notices.ts'],
  },
  {
    key: 'xss-frontend',
    title: 'Frontend XSS — stored, reflected, DOM',
    focus: `components/SEO.tsx dangerouslySetInnerHTML (JSON-LD) — is any user-controlled data
interpolated into the JSON-LD (broker name, request title) without escaping, enabling </script>
breakout? Grep all components/pages for dangerouslySetInnerHTML, innerHTML, document.write, eval,
new Function. Check how borrower request notes/details, broker bio/brokerageName, user names, and
MESSAGE BODIES (Korean free text) are rendered — React escapes by default, but check for any href=
{userInput} (javascript: URLs), profilePhoto/areasServed rendered as raw HTML or img src, markdown
rendering, or i18n interpolation that allows HTML. Check admin views rendering borrower data.`,
    files: ['components/SEO.tsx', 'components/broker/RequestDetailBlocks.tsx', 'components/admin/RequestDetails.tsx', 'pages/borrower/messages.tsx', 'pages/broker/messages.tsx', 'components/broker/RequestContextPanel.tsx'],
  },
  {
    key: 'logging-pii',
    title: 'Logging of sensitive data',
    focus: `Grep all console.log/error/warn/info and any logger/PostHog capture in pages/api & lib for
logging of: passwords/passwordHash, verificationCode, resetToken, JWT/session tokens, Stripe secrets,
full borrower financial details, email bodies, SIN-like data. Check lib/push.ts, lib/email.ts,
lib/posthog-server.ts, the withAuth/withAdmin error logging (does the generic 500 log dump request
bodies with PII?). Check PostHog event properties for PII. Check that auth errors don't log credentials.`,
    files: ['lib/push.ts', 'lib/email.ts', 'lib/posthog-server.ts', 'lib/withAuth.ts', 'lib/admin/withAdmin.ts', 'lib/admin/audit.ts'],
  },
  {
    key: 'rate-limit-abuse',
    title: 'Rate limiting & abuse protection',
    focus: `Which endpoints have rate limits and which don't? CRITICAL gaps: login (NextAuth
credentials — is there brute-force protection? authLimiter used?), signup, forgot-password (email
bombing), verify-email/resend-code (code brute force + email/SMS bombing), contact form, message
sending, request creation. Note rate-limit.ts FAILS OPEN on KV error and falls back to per-lambda
in-memory (multiplies limit by warm instance count) — assess prod impact. Is the login endpoint
([...nextauth]) rate limited at all (NextAuth doesn't do it by default)? getClientIp spoofing.
contact.tsx endpoint — where does it post, is it protected?`,
    files: ['lib/rate-limit.ts', 'pages/api/auth/[...nextauth].ts', 'pages/api/auth/signup.ts', 'pages/api/auth/forgot-password.ts', 'pages/api/auth/resend-code.ts', 'pages/api/auth/verify-email.ts', 'pages/api/messages/index.ts', 'pages/api/reports.ts', 'pages/contact.tsx'],
  },
  {
    key: 'error-info-leak',
    title: 'Error handling & information leakage',
    focus: `Do API responses leak stack traces, Prisma error details, internal IDs, or env in error
bodies? Check the withAuth/withAdmin generic 500 (good) but also handlers that catch and return
err.message directly. Prisma unique-constraint errors leaking which field. 404 vs 403 distinction
that enables resource enumeration (does requesting someone else's request return 403 (exists) vs 404
(consistent)?). Stack traces in production. Source maps exposed. Verbose GraphQL/debug endpoints.
maintenance.ts what does it expose.`,
    files: ['lib/withAuth.ts', 'lib/admin/withAdmin.ts', 'pages/api/maintenance.ts', 'pages/api/requests/[id].ts', 'pages/api/conversations/[id].ts', 'pages/500.tsx'],
  },
  {
    key: 'deps-cve',
    title: 'Dependency risks — known CVEs',
    focus: `Review package.json + package-lock.json versions for known-vulnerable packages. Run
\`npm audit --omit=dev --json\` if possible and summarize. Key ones: next ^16.2.1, next-auth ^4.24.13
(check for known NextAuth advisories), bcryptjs ^3, @prisma/client 5.22, stripe ^20, resend, jsdom
(dev). Flag any package with a published high/critical CVE relevant to this app's usage. Note pinned
vs caret ranges and lockfile integrity.`,
    files: ['package.json', 'package-lock.json'],
  },
  {
    key: 'deployment-prod-config',
    title: 'Deployment & production configuration',
    focus: `next.config.mjs (security headers — assess CSP unsafe-inline/unsafe-eval, are all headers
present, HSTS preload, productionBrowserSourceMaps?), vercel.json, app.json, .github/ workflows
(secrets in CI? deploy config), cron endpoints (cron/auto-close-conversations.ts, cron/expire-requests.ts,
maintenance.ts): ARE THEY AUTHENTICATED? A public cron endpoint that mutates data (auto-close, expire,
maintenance) is a serious issue — check for CRON_SECRET / Authorization header / Vercel cron signature
verification. Check reactStrictMode, debug flags, NODE_ENV gating, exposed .next, instrumentation.
Check next-sitemap and posthog rewrites (/ingest proxy) for SSRF/abuse.`,
    files: ['next.config.mjs', 'vercel.json', 'app.json', 'pages/api/cron/auto-close-conversations.ts', 'pages/api/cron/expire-requests.ts', 'pages/api/maintenance.ts', 'lib/cron.ts'],
  },
  {
    key: 'privacy-pipeda',
    title: 'Canadian privacy (PIPEDA) & data handling',
    focus: `PIPEDA-relevant: data minimization (is more PII collected than needed?), consent
(lib/legal.ts CURRENT_LEGAL_VERSION acceptance flow — is it enforced at signup AND OAuth?), retention
& deletion (is there an account-deletion path that actually purges borrower financial data, or just
soft-deletes? cron/expire-requests — does expired request data get purged or linger?), access
(can a borrower export/see their own data), cross-border data transfer (Vercel/Supabase/Stripe US
hosting of Canadian PII — note as a compliance consideration), broker visibility scope (least
privilege over borrower PII). This is advisory/compliance, mark severity accordingly.`,
    files: ['lib/legal.ts', 'pages/privacy.tsx', 'pages/api/auth/signup.ts', 'pages/api/cron/expire-requests.ts', 'pages/api/users/me.ts'],
  },
]

// ────────────────────────────────────────────────────────────────────────
// PHASE: Audit -> Verify (pipeline; each dimension verifies as soon as its
// finder completes, no barrier between finding and verification)
// ────────────────────────────────────────────────────────────────────────
function finderPrompt(d) {
  return `You are a senior application security engineer doing a PRE-LAUNCH PENETRATION REVIEW of Mortly.

${CONTEXT}

YOUR DIMENSION: ${d.title}

WHAT TO HUNT FOR:
${d.focus}

START by reading these files (then follow the code — read whatever else you need: callers, helpers, the Prisma queries, the React render path):
${d.files.map((f) => '  - ' + f).join('\n')}

METHOD:
1. Actually open and READ the files (Read tool). Follow imports and data flow. Use Grep to find all
   call sites and similar patterns across pages/api, lib, components. Do not guess.
2. For each real vulnerability: give the exact file + line numbers you saw, quote the exact code,
   explain precisely why it is exploitable, and write a concrete Mortly-specific attack scenario
   (e.g. "a malicious broker with a free account calls GET /api/requests/<cuid> and receives borrower
   X's loan amount and contact info"). Provide the exact fix.
3. Mark confidence: "confirmed" only if you traced the full exploit path in the code; otherwise
   "needs-manual-verification" and say what runtime/config fact is unknown.
4. In safe_notes, record what you specifically checked and found SAFE, with the reason (the user
   explicitly wants safe areas stated, not silently skipped).
5. In inconclusive, list anything you could not determine and what extra context is needed.

Be thorough and skeptical but do NOT invent issues or report style nits. READ-ONLY — never modify files.
Return ONLY the structured object.`
}

function verifyPrompt(f, d) {
  return `You are an ADVERSARIAL VERIFIER on Mortly's pre-launch security review. Another engineer
reported the finding below. Your job is to REFUTE it. Open the actual code and prove it real or false.
Default to skepticism: many "findings" are false positives because the reporter missed an upstream
guard (a withAuth role check, an ownership filter in the Prisma where-clause, a validate.ts assert,
the CSRF gate, the session callback's revocation, etc.).

${CONTEXT}

DIMENSION: ${d.title}

REPORTED FINDING:
  Title: ${f.title}
  Severity: ${f.severity}
  File: ${f.file}  Lines: ${f.lines}
  Snippet: ${f.snippet}
  Why exploitable (claimed): ${f.why_exploitable}
  Attack scenario (claimed): ${f.attack_scenario}
  Proposed fix: ${f.recommended_fix}

DO THIS:
1. Read ${f.file} around those lines AND every guard in the request path: the withAuth/withAdmin
   wrapper used, the Prisma where-clause (does it already scope by session.user.id / ownership?),
   any validate.ts calls, the session/role checks. Grep for how the route is registered and wrapped.
2. Decide:
   - "confirmed": you traced the full path and the exploit genuinely works as described (or is even worse).
   - "false-positive": an existing guard the reporter missed makes it safe — name the exact file:line
     of that guard in missed_guard.
   - "needs-manual-verification": plausibly real but depends on env/config/runtime you cannot see from code.
3. Set corrected_severity (downgrade hype, upgrade if underrated). Give reasoning citing file:line you read.

READ-ONLY. Return ONLY the structured verdict.`
}

phase('Audit')
const dimensionResults = await pipeline(
  DIMENSIONS,
  (d) => agent(finderPrompt(d), { label: `audit:${d.key}`, phase: 'Audit', schema: FINDINGS_SCHEMA })
    .then((r) => ({ ...(r || {}), _key: d.key, _title: d.title })),
  (review, d) => {
    if (!review || !Array.isArray(review.findings) || review.findings.length === 0) {
      return {
        key: d.key,
        title: d.title,
        summary: review?.summary || '(finder returned nothing)',
        findings: [],
        safe_notes: review?.safe_notes || [],
        inconclusive: review?.inconclusive || [],
      }
    }
    return parallel(
      review.findings.map((f) => () =>
        agent(verifyPrompt(f, d), {
          label: `verify:${d.key}:${String(f.file || '').split('/').pop()}`,
          phase: 'Verify',
          schema: VERDICT_SCHEMA,
        }).then((v) => ({ ...f, verdict: v })).catch(() => ({ ...f, verdict: null })),
      ),
    ).then((verified) => ({
      key: d.key,
      title: d.title,
      summary: review.summary,
      findings: verified.filter(Boolean),
      safe_notes: review.safe_notes || [],
      inconclusive: review.inconclusive || [],
    }))
  },
)

// ────────────────────────────────────────────────────────────────────────
// PHASE: Critic — completeness + regression sweep over the aggregate
// ────────────────────────────────────────────────────────────────────────
phase('Critic')

const findingDigest = dimensionResults
  .map((r) => {
    const fs = (r.findings || [])
      .map((f) => {
        const v = f.verdict ? `${f.verdict.verdict}/${f.verdict.corrected_severity}` : 'unverified'
        return `    - [${f.severity}->${v}] ${f.title} (${f.file}:${f.lines})`
      })
      .join('\n')
    return `  ${r.key}: ${r.findings.length} finding(s)\n${fs}`
  })
  .join('\n')

const criticPrompt = `You are the COMPLETENESS CRITIC and REGRESSION AUDITOR closing out Mortly's
pre-launch security review. Below is the aggregate of what 18 dimension finders + verifiers produced.

${CONTEXT}

AGGREGATE FINDINGS SO FAR:
${findingDigest}

YOUR JOB:
1. MISSED AREAS: What did the dimensions NOT cover or cover thinly? Think about: SSRF (the /ingest
   PostHog proxy rewrite, any server-side fetch of user URLs like profilePhoto), Supabase Realtime
   authorization (chat is over Supabase — is row-level security / channel auth enforced, or can any
   client subscribe to any conversation channel? read lib/supabase.ts and the messages pages),
   race conditions / TOCTOU (credit spend, double-message, conversation creation uniqueness),
   business-logic abuse (a broker engaging unlimited borrowers without credits; a borrower spamming
   requests), JWT/NEXTAUTH_SECRET strength assumptions, the x-mortly-mobile CSRF bypass blast radius,
   admin SSR pages leaking via getServerSideProps, test/seed endpoints reachable in prod, npm audit.
2. ADDITIONAL FINDINGS: concrete new issues you can identify (read files to confirm; cite file:line).
   Especially probe Supabase Realtime channel authorization for chat — that is the most likely gap a
   route-by-route audit misses. Read lib/supabase.ts, components and pages that use supabase realtime.
3. REGRESSION CHECK: commit bc3e811 "Security hardening" and migrations security_hardening_phase_2 /
   engineering_audit_phase_1 fixed things (open-redirect via Stripe URLs, XFF spoofing, message length
   DB cap, isSystem spoofing, etc.). Use \`git log\`, \`git show\` to see what was fixed, then verify
   none regressed in current code.
4. COVERAGE ASSESSMENT: is this review thorough enough to launch behind? What is the residual risk?

Use Read/Grep/Bash(git, npm audit) freely. READ-ONLY. Return ONLY the structured object.`

const critic = await agent(criticPrompt, { label: 'completeness-critic', phase: 'Critic', schema: CRITIC_SCHEMA })

return { dimensionResults, critic }
