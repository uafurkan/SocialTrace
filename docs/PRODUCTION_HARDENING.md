# Production Hardening (Milestone 10, partial)

Spec §110/§228 Milestone 10 is "Production hardening + SEO launch" — a
large bucket (rate limiting, error handling, security headers, health
checks, structured data, monitoring, moderation, backups, and more, per
spec §190-§219). This slice covers the parts that are real, self-contained,
and don't need infrastructure this build doesn't have. SEO structured
data and content pages are deliberately not part of it — see "Not in this
slice" below.

## What's implemented

- **Error boundaries.** `src/app/error.tsx` catches an unhandled
  exception anywhere in the app (e.g. a provider throwing something
  other than `ProfileNotFoundError`, or a DB call failing) and shows a
  real page with a "Try again" action, instead of Next.js's default dev
  overlay / blank production crash. `src/app/global-error.tsx` covers
  the one case `error.tsx` can't — an error thrown by the root layout
  itself — and has to render its own bare `<html>/<body>` since it
  replaces that layout.
- **Baseline security headers** (`next.config.mjs`'s `headers()`):
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`, and a
  `Permissions-Policy` disabling camera/microphone/geolocation (none of
  which this app uses). No `Content-Security-Policy` yet — see below.
- **`GET /api/health`** — for production uptime/readiness monitoring.
  Always reachable; separately reports whether a configured database
  actually answers a query (`database.ok`), not just whether
  `DATABASE_URL` is set (`database.configured`) — a misconfigured
  connection string shouldn't look identical to "no database at all."
  Returns 503 when a database is configured but unreachable, 200
  otherwise. Force-dynamic (`export const dynamic = "force-dynamic"`) so
  it isn't statically cached at build time.
- **Basic rate limiting** (`src/lib/rate-limit.ts`) on the three routes
  that do real, costly work per request — snapshot capture (10/10min per
  IP), export (10/10min per IP), and track/untrack (30/10min per IP,
  since it's cheaper but still writes to the DB and, for a new profile,
  calls the provider). Exceeding the limit returns `429` with a
  `Retry-After` header.

## The rate limiter's real limitation

`src/lib/rate-limit.ts` is a fixed-window counter held in a plain
in-process `Map` — it has no shared backing store. That makes it real
protection for a single long-lived process (this sandbox, or a
self-hosted deployment run with `next start`), but **not** for a
multi-instance serverless deployment: on Vercel, each function
invocation can land on a different instance with its own empty map, so a
caller who fans out requests can bypass it entirely. This was a known
trade-off going in, not a bug found later — replacing the `Map` with a
shared store (Upstash Redis is the common choice for this exact
Next.js-on-Vercel shape) is a drop-in change behind the same
`rateLimit(key, limit, windowMs)` interface, once that infrastructure
exists. Documented here rather than silently shipping a rate limiter
that looks complete but only works by accident in production.

## Not in this slice

- **Content Security Policy.** Writing a real CSP means enumerating every
  script/style/connect source the app actually needs; this app has no
  third-party scripts or inline event handlers today, so a CSP written
  now would either be trivial (and provide little protection ahead of
  future additions) or need rewriting the moment analytics/a font CDN/etc.
  is added. Deferred until there's something concrete to allowlist.
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

Real user traffic (or a public production launch) is what would justify
the CSP, moderation, and distributed rate limiting above — all deferred
specifically because building them without real usage patterns to
inform them risks getting the specifics wrong (e.g. a CSP that either
blocks something real or protects against nothing).
