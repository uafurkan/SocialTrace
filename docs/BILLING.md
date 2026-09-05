# Billing

Spec §31's plan model, now with **real Paddle payment processing** behind
it (Phase 6 of `SOCIALTRACE_MASTER_BUILD_SPEC.md`'s release phases).
Paddle was chosen over Stripe specifically because **Stripe does not
support Turkey as an account country** — the account holder could not
actually create a Stripe account at all (see `docs/DECISIONS.md` for the
full story, including the earlier Stripe implementation this replaced).
Paddle is a merchant-of-record processor that does accept Turkey-based
sellers.

## What's implemented

- **`users.plan`** (`free` | `pro`, default `free`) plus
  `paddleCustomerId`/`paddleSubscriptionId` (both nullable, set lazily on
  first checkout) — `src/lib/db/schema.ts`.
- **`PLAN_LIMITS`** (`src/lib/billing/plans.ts`, unchanged since this was
  first added):
  ```ts
  free: { maxTrackedProfiles: 10, maxSavedSearches: 10 }
  pro:  { maxTrackedProfiles: Infinity, maxSavedSearches: Infinity }
  ```
  Real enforcement in `trackProfile`/`createSavedSearch` — see "Why a
  duplicate re-track/re-save doesn't false-positive" below, unchanged.
- **Checkout is JS-based, unlike Stripe's hosted redirect page.** Paddle
  Billing's checkout is an overlay iframe opened by the client-side
  `@paddle/paddle-js` library (`Paddle.Checkout.open({ transactionId })`)
  — there's no pure server-redirect equivalent to `checkout.stripe.com`.
  So `/api/v1/billing/checkout` (`POST`, requires a logged-in account)
  only creates (or reuses) a Paddle customer and a transaction for
  `PADDLE_PRO_PRICE_ID`, then hands the transaction id back;
  `<UpgradeButton>` (`src/components/billing/checkout-button.tsx`) lazily
  loads Paddle.js and opens the overlay for that transaction. This is the
  one place this app's billing needed a client-side vendor library and a
  CSP change (see below) — everything else about the integration follows
  the same server-verified pattern as the previous Stripe version.
- **No single "customer portal" URL like Stripe's.** Paddle's
  self-service links are per-subscription deep links returned on the
  subscription resource itself: `management_urls.update_payment_method`
  and `management_urls.cancel` (confirmed against Paddle's Subscriptions
  API reference). `/api/v1/billing/portal` (`GET`) looks up the account's
  `paddleSubscriptionId`, fetches the subscription, and returns both URLs;
  `<ManageBillingButton>` renders them as two separate links.
- **Webhook** (`/api/v1/billing/webhook`, `POST`) — the *only* path that
  ever sets `users.plan` to `"pro"`. Verifies the `Paddle-Signature`
  header (`ts=<unix>;h1=<hmac>`) against the raw request body before
  trusting anything in it (`verifyPaddleWebhookSignature` in
  `src/lib/billing/paddle.ts`, confirmed against Paddle's own
  webhook-signature docs: HMAC-SHA256 of `${ts}:${rawBody}` with the
  notification destination's signing secret, timing-safe compared, with a
  5-minute replay window). Handles:
  - `transaction.completed` → sets the account (matched by
    `paddleCustomerId`) to `pro`. Only touches `plan`, never
    `paddleSubscriptionId` — this event has no reliable ordering
    guarantee relative to `subscription.created`, so writing a
    subscription id here risked a race that could null out what the
    subscription event just set.
  - `subscription.created`/`.updated` → re-derives the plan from the
    subscription's current `status` via `planForSubscriptionStatus()`
    (`src/lib/billing/webhook-handlers.ts`, unit tested) and records the
    subscription id. Paddle's status enum (confirmed against their API
    reference) is exactly five values: `active`, `trialing` count as Pro;
    `past_due`, `paused`, `canceled` all revert to `free`.
  - `subscription.canceled` → sets `free`, clears `paddleSubscriptionId`.
- **`/account`** shows the plan badge, usage vs. limit for both
  resources, and — when `PADDLE_API_KEY` is set — a real "Upgrade to Pro"
  button (free plan) or "Update payment method"/"Cancel subscription"
  links (Pro plan); otherwise the same disabled "coming soon" button as
  before, so nothing breaks in an environment that hasn't configured
  Paddle.
- **CSP (`src/proxy.ts`)** — `frame-src`/`connect-src` add
  `https://*.paddle.com` when `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` is set,
  covering the checkout overlay iframe (`checkout.paddle.com`/
  `sandbox-checkout.paddle.com`) and Paddle.js's own API calls. Unlike
  Ezoic's ad-exchange allowance, this is a single known vendor, not a
  non-enumerable set, so it gets a scoped `*.paddle.com` allowlist entry
  rather than widening to any `https:` origin — same treatment as
  Turnstile got.

## Setup (Paddle dashboard + env)

1. **Create the Product/Price**, in sandbox first: Catalog → Products →
   add a recurring price for Pro → copy its price id (`pri_...`) into
   `PADDLE_PRO_PRICE_ID`.
2. **Get your API key and client-side token**: Developer tools →
   Authentication → copy the API key into `PADDLE_API_KEY`, and the
   client-side token into `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` (this one is
   meant to be public — it's what Paddle.js uses in the browser).
3. **Create the webhook** (Paddle calls these "notification
   destinations"): Developer tools → Notifications → add a destination
   pointing at `https://<your-domain>/api/v1/billing/webhook`, subscribe
   it to `transaction.completed`, `subscription.created`,
   `subscription.updated`, `subscription.canceled`. Copy its signing
   secret into `PADDLE_WEBHOOK_SECRET` — without this, checkout completes
   on Paddle's side but this app never finds out and the account stays
   on `free`.
4. **Keep `PADDLE_ENVIRONMENT`/`NEXT_PUBLIC_PADDLE_ENVIRONMENT` on
   `sandbox`** until the integration is fully tested — sandbox has its
   own separate products/prices/API key/webhook secret from live, so
   moving to production means repeating steps 1–3 against the live
   dashboard and switching both env vars to `production`.
5. Paddle also requires domain approval before checkout will run on a
   live (non-sandbox) domain — Checkout → Checkout settings → domain
   approval — and business verification before you can take real
   payments at all. Neither is a code change; both are one-time dashboard
   steps to do once the sandbox integration is confirmed working.

## Why a duplicate re-track/re-save doesn't false-positive at the limit

Naively checking "count >= limit" before every insert would incorrectly
block a no-op — e.g. clicking Track again on a profile you're already
tracking while at exactly 10/10. Both `trackProfile` and
`createSavedSearch` check whether the specific row already exists first
(`isProfileTracked`, an equivalent lookup for saved searches) and skip
the limit check entirely when it does, since the subsequent
`onConflictDoNothing` insert won't actually add a new row.

## What's NOT implemented

- **No annual/monthly plan picker** — one price, one Pro tier, matching
  the binary `free`/`pro` plan model.
- **No usage overage handling** beyond a hard block — no grace period, no
  soft-limit warning banner before the limit is hit.
- **No invoices UI in this app** — invoices/receipts are viewed entirely
  through Paddle's own emails/self-service links, not mirrored into
  `/account`.
- **No test coverage for the webhook route or checkout/portal routes
  themselves** (signature verification, DB writes, live Paddle API
  calls) — only the pure `planForSubscriptionStatus()` mapping is unit
  tested; the routes need a real Paddle sandbox account and a live
  database to test end-to-end.
- **Not live yet.** This is a sandbox-mode integration pending Paddle's
  domain approval and business verification steps above — see the setup
  section.
