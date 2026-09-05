# Authentication

Spec §31's `users` table, implemented as email + password only — no
OAuth, no magic links (the user chose email + password when asked which
method to build). An account is **optional**: every feature that worked
without one (exploring profiles, tracking, saved searches, exports)
still works without one — an account only upgrades tracking/saved
searches from "this browser" to "this account" (see the Identity
section below).

## What's implemented

- **`users`** (`src/lib/db/schema.ts`): `email`, `normalizedEmail`
  (unique-indexed, lowercased/trimmed — case-insensitive login),
  `passwordHash`, `plan` (`free` | `pro`, defaults to `free`).
- **`sessions`**: `userId`, `tokenHash`, `expiresAt`. The session token
  set in the `st_session` cookie is never written to the database — only
  its SHA-256 hash (`src/lib/auth/session.ts`'s `hashSessionToken`) is,
  the same reasoning as hashing a password: a leaked database row alone
  shouldn't be enough to impersonate a session. Tokens are 32 random
  bytes (`crypto.randomBytes`), sessions last 30 days
  (`src/lib/auth/session-cookie.ts`).
- **Password hashing**: bcryptjs, 10 salt rounds
  (`src/lib/auth/password.ts`). Chosen over the native `bcrypt` package
  specifically to avoid native bindings in a serverless/edge-adjacent
  deployment target.
- **Routes**: `POST /api/v1/auth/signup`, `POST /api/v1/auth/login`,
  `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`. Signup and login are
  rate-limited (5/10min and 10/10min per IP respectively, via
  `src/lib/rate-limit.ts`) as basic brute-force/abuse protection — same
  in-process caveat as every other rate-limited route in this build (not
  safe across multiple serverless instances, see
  `docs/PRODUCTION_HARDENING.md`).
- **UI**: `/login`, `/signup` (`src/components/auth/auth-form.tsx`,
  shared between both), and an `AccountMenu` header island
  (`src/components/layout/account-menu.tsx`) showing "Sign in / Sign up"
  or the account's email + "Sign out".
- **`/account`**: email, plan badge, tracked-profile and saved-search
  usage vs. plan limits, and a disabled "Upgrade" button — see
  `docs/BILLING.md`.

## Why the header fetches auth state client-side

`AccountMenu` calls `GET /api/v1/auth/me` from a `useEffect` rather than
`SiteHeader` reading the session cookie server-side. `SiteHeader` is
rendered on every page, including the static SEO content pages built
earlier (`/changelog`, `/help`, the tool landing pages — see
`docs/SEO.md`/`docs/SEARCH.md`). Reading `cookies()` anywhere in a
shared layout forces Next.js to bail out of static generation for every
page under it — confirmed while building this: `next build` initially
turned every one of those pages from `○` (static) to `ƒ` (dynamic) the
moment `SiteHeader` became an async Server Component reading the
session. Moving the read into one client-side island keeps the rest of
the app statically prerendered, at the cost of one extra request and a
brief loading state in that one header slot.

## Bot protection (Cloudflare Turnstile)

`src/lib/auth/turnstile.ts` + `src/components/auth/turnstile-widget.tsx`.
Opt-in, same pattern as every other real integration in this app: with
`TURNSTILE_SECRET_KEY` unset, `verifyTurnstileToken` always returns
`true` and the widget renders nothing — login/signup behave exactly as
before Turnstile existed. Configured (both `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
and `TURNSTILE_SECRET_KEY` set), `AuthForm` renders the challenge widget,
disables submit until it's solved, and both `/api/v1/auth/signup` and
`/api/v1/auth/login` verify the token server-side against Cloudflare's
`siteverify` endpoint before doing any password hashing/DB work — a
missing or invalid token gets a `403`. Sits alongside, not instead of,
the existing per-IP rate limiting above. `src/middleware.ts`'s CSP adds
`challenges.cloudflare.com` to `frame-src`/`connect-src` only when the
site key is set.

Get the site key + secret key from the Cloudflare dashboard (Turnstile →
Add site) — free, no other Cloudflare product required.

## Identity resolution (`src/lib/auth/identity.ts`)

`resolveIdentity` (Route Handlers) / `resolveIdentityReadOnly` (Server
Components) is the one place that decides, per request: is this a
logged-in account, or an anonymous visitor? If logged in, the "scope
id" used everywhere tracking/saved-searches key by visitor
(`watchlist_entries.visitor_id`, `saved_searches.visitor_id`) becomes
`account:<userId>` instead of the `st_visitor` cookie value — this is
exactly the upgrade path both `docs/TRACKING.md` and
`docs/SAVED_SEARCHES.md` called out when they were built ("swap the
cookie value for a `users.id` once accounts exist"), done with **zero
schema migration**, since both tables already store a plain string.

An anonymous visitor's behavior is completely unchanged from before
accounts existed.

## Verified live

Full signup → `/api/v1/auth/me` (confirms logged in) → logout →
`/api/v1/auth/me` (confirms logged out) → login again cycle against the
real Neon database via `curl` with a cookie jar. Confirmed a duplicate
signup returns `409`, a wrong password returns `401`, a short password
and an invalid email both return `400` with the expected messages.
Confirmed `AccountMenu` correctly flips from "Sign in / Sign up" to the
account email + "Sign out" after logging in (this needed a fix — see
"Why the header fetches auth state client-side" above's sibling issue:
the header persists across client-side navigation, so it re-checks auth
state on every pathname change rather than only once on mount).
Screenshotted `/login` and the post-login `/account` page. Test account
and its data deleted from the live database afterward.

## What's NOT implemented

- **No OAuth, no magic links.** Only method built was email + password,
  per explicit choice.
- **No password reset / email verification.** Would need a real email
  delivery service (Resend, SendGrid, ...), which this build doesn't
  have — same missing piece as tracking's notification channel
  (`docs/TRACKING.md`).
- **No account deletion, no email change.**
- **No CSRF token.** The session cookie is `sameSite: lax`, which blocks
  cross-site POST form submission from top-level navigation, but a
  dedicated CSRF token would be the more complete answer for a
  production deployment.
- **No account-level rate limiting** beyond the per-IP signup/login
  limits — a determined attacker with many IPs could still brute-force
  a specific account's password at a low rate. Acceptable for this
  build's threat model, not for production.
- **Turnstile is off by default.** With no Cloudflare account configured
  (`TURNSTILE_SECRET_KEY` unset), auth has no bot-specific protection
  beyond the per-IP rate limits above.

## When this needs to change

Password reset needs an email provider before it can exist honestly (no
fake "check your email" flow that doesn't send anything). OAuth would
need real client credentials from each provider. Both are real
integrations, not something to fake — see `docs/DECISIONS.md`'s running
theme of "real-but-scoped, not simulated."
