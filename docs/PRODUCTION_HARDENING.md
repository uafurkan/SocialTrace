# Production Hardening (Milestone 10)

Spec §110/§228 Milestone 10 is "Production hardening + SEO launch" — a
large bucket (rate limiting, error handling, security headers, health
checks, structured data, monitoring, moderation, backups, and more, per
spec §190-§219). This covers the parts that are real and don't need
infrastructure this build doesn't have, or — for rate limiting and
monitoring — the parts that are real *once opted into* via a real
account's credentials, same as `SOCIAL_PROVIDER=apify`
(`docs/PROVIDER_CONTRACT.md`). SEO structured data and content pages are
deliberately not part of it — see "Not in this slice" below.

## What's implemented

- **Error boundaries.** `src/app/error.tsx` catches an unhandled
  exception anywhere in the app (e.g. a provider throwing something
  other than `ProfileNotFoundError`, or a DB call failing) and shows a
  real page with a "Try again" action, instead of Next.js's default dev
  overlay / blank production crash. `src/app/global-error.tsx` covers
  the one case `error.tsx` can't — an error thrown by the root layout
  itself — and has to render its own bare `<html>/<body>` since it
  replaces that layout. Both also call `Sentry.captureException` (see
  Observability below).
- **Baseline security headers** (`next.config.mjs`'s `headers()`):
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`, and a
  `Permissions-Policy` disabling camera/microphone/geolocation (none of
  which this app uses).
- **A real Content Security Policy** (`src/middleware.ts`), no longer
  deferred — see "Content Security Policy" below.
- **`GET /api/health`** — for production uptime/readiness monitoring.
  Always reachable; separately reports whether a configured database
  actually answers a query (`database.ok`), not just whether
  `DATABASE_URL` is set (`database.configured`) — a misconfigured
  connection string shouldn't look identical to "no database at all."
  Returns 503 when a database is configured but unreachable, 200
  otherwise. Force-dynamic (`export const dynamic = "force-dynamic"`) so
  it isn't statically cached at build time.
- **Rate limiting** (`src/lib/rate-limit.ts`) on the routes that do real,
  costly work per request — snapshot capture (10/10min per IP), export
  (10/10min per IP), track/untrack (30/10min per IP), and auth
  signup/login (5/10min, 10/10min). Exceeding the limit returns `429`
  with a `Retry-After` header. Real distributed limiting when
  `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are configured
  (see "Distributed rate limiting" below); an in-process fallback
  otherwise, unchanged from before.
- **Observability** (Sentry), opt-in via `SENTRY_DSN`/
  `NEXT_PUBLIC_SENTRY_DSN` — see "Observability" below.

## Content Security Policy

`src/middleware.ts` sets a real, non-trivial CSP on every HTML response
(matcher excludes `/api/*`, `_next/static`, `_next/image`, favicon —
non-HTML responses a script/style CSP doesn't apply to):

- `script-src 'self' 'nonce-<random>' 'strict-dynamic'` — a fresh nonce
  every request, following [Next.js's documented CSP pattern](https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy).

**Found live, much later, from a real user report of the homepage search
box silently doing nothing on Enter: this had never actually worked.**
The claim this doc previously made here — that Next.js auto-applies the
middleware's nonce to its own script tags with no `headers()` read
needed — was wrong, and had apparently never been checked against a real
browser. Confirmed by running the production build (`next build` +
`next start`) behind Playwright and reading actual console output: every
single script tag Next.js rendered had no `nonce` attribute at all, so
`'strict-dynamic'` (which disables the `'self'` host-based fallback once
present) blocked 100% of them — the framework chunks, the page chunks,
and the inline RSC-hydration payload scripts. This meant **zero
client-side JavaScript ever ran on any page, in production, since this
CSP shipped** — every button, form, and client component was inert; the
homepage search form's `onSubmit` handler (`preventDefault` +
`router.push`) never attached, so pressing Enter fell through to the
browser's native HTML form submission (a plain GET to `/`), which is
exactly the "nothing happens" the user saw.

The actual mechanism (verified against Next.js 14.2.35): Next.js does
not parse its own `Content-Security-Policy` response header to discover
the nonce. It only threads a nonce into the script tags it renders when
some Server Component in the render tree calls `headers()` during that
request — that's the signal that opts the request into per-request
(dynamic) rendering and gives Next a request-scoped place to read
`x-nonce` from. `src/app/layout.tsx` had never done this, so the nonce
middleware generated was completely unused. Fixed by calling `headers()`
unconditionally in `RootLayout`. Re-verified the same way: the CSP
header's nonce now matches every script tag's `nonce` attribute, zero
CSP violations in the console, and the homepage search form correctly
navigates to `/profile/<username>` on Enter.

This does cost the static generation this project had otherwise
protected carefully (`docs/AUTH.md`'s `AccountMenu` client-island
workaround) — `headers()` in the root layout forces every page under it
to render per-request rather than being prerendered at build time (the
`next build` output changed from mostly `○` to mostly `ƒ`). That's an
accepted, deliberate trade: a static page that ships zero working
JavaScript isn't a working page.
- `style-src 'self' 'unsafe-inline'` — the one deliberate loosening.
  Framer Motion (the homepage hero chart) sets inline `style` attributes
  directly for its transforms; nonce'ing every one of those isn't
  practical, and style-src is a much lower-severity XSS vector than
  script-src, which stays nonce-only.
- `img-src 'self' https: data:` — broader than `'self'` because a real
  provider's avatar URLs are Instagram's CDN on numerous rotating
  subdomains that can't be enumerated (`docs/PROVIDER_CONTRACT.md`); the
  mock provider emits no `avatarUrl` at all, so this only matters once
  `SOCIAL_PROVIDER=apify`.
- Everything else (`connect-src`, `font-src`, `object-src 'none'`,
  `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`) is
  `'self'`-only or fully closed — this app makes zero third-party
  network requests, loads zero third-party scripts, and has zero
  iframes, confirmed by search before writing this policy.

**Must live at `src/middleware.ts`, not project-root `middleware.ts`** —
this project uses a `src/` directory, and Next.js silently no-ops a
root-level `middleware.ts` in that layout (found live: the file
compiled with no errors and no warning, but the CSP header never
appeared on any response, and `next dev`'s output listed no `/middleware`
compilation step at all — moving the identical file into `src/` fixed it
immediately, `✓ Compiled /src/middleware` appeared and the header showed
up).

## Distributed rate limiting

`src/lib/rate-limit.ts`'s `rateLimit(key, limit, windowMs)` interface is
unchanged, but now checks for `UPSTASH_REDIS_REST_URL`/
`UPSTASH_REDIS_REST_TOKEN` first: configured, it uses `@upstash/ratelimit`'s
sliding-window limiter against real Upstash Redis (shared across every
serverless instance, closing the multi-instance bypass documented here
previously); unconfigured, it falls back to the exact same in-process
`Map` as before, real protection for a single long-lived process but
not for multi-instance serverless. Every call site (`snapshots`,
`export`, `track`, `saved-searches`, `auth/login`, `auth/signup`) just
`await`s the same function — no per-route change needed either way.

## Observability

`instrumentation.ts` (server/edge) + `instrumentation-client.ts`
(browser) initialize `@sentry/nextjs`, reading `SENTRY_DSN`
(server/edge) and `NEXT_PUBLIC_SENTRY_DSN` (browser — only
`NEXT_PUBLIC_*` vars reach the client bundle). An unset/empty DSN is
Sentry's own documented way to disable the SDK, so a deployment with no
Sentry account configured behaves exactly as before — confirmed via a
clean `next build` with no `SENTRY_DSN` set. `next.config.mjs` wraps the
config with `withSentryConfig`, but sourcemap upload (the part that
needs a real Sentry org/project/auth token) stays off unless
`SENTRY_AUTH_TOKEN` is set — `sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN }`
— so the wrapper's only job otherwise is wiring up the runtime SDK.
`error.tsx`/`global-error.tsx` call `Sentry.captureException`, and
`instrumentation.ts` exports `onRequestError` for server-rendering
errors those two boundaries don't otherwise see.

## Not in this slice

- **Structured data (JSON-LD) on profile pages.** Spec §206/§210
  describe a profile page schema for SEO. This build's profile pages are
  backed by mock data by default (`docs/DECISIONS.md`), and profile URLs
  are already excluded from `sitemap.ts` for the same reason. Publishing
  `Person`/`ProfilePage` structured data would assert real-looking claims
  (follower counts, verification status) about pages whose content isn't
  real — the same data-honesty principle (spec §1.2) applied to markup
  instead of UI. Worth adding once a real provider is the default.
- **Moderation, abuse reporting, backup strategy, database region
  strategy, queue scaling** (spec §215/§195/§217/§218) — all assume
  production traffic and infrastructure (a real job queue, a support
  process) that doesn't exist yet.
- **Blog/help/changelog SEO content pages** (spec §205, §202-§204) — content
  authoring, not engineering; out of scope for this session regardless.

## When this needs to change

Distributed rate limiting and observability are real integrations now,
not deferred — they just need an Upstash/Sentry account's credentials to
turn on. Structured data, moderation, and backup strategy remain
genuinely deferred until there's a real provider as the default and real
production traffic to inform them.
