# Billing

Spec §31's plan model, now with **real Stripe payment processing** behind
it (Phase 6 of `SOCIALTRACE_MASTER_BUILD_SPEC.md`'s release phases —
previously this was limit-enforcement-only, see git history for that
slice).

## What's implemented

- **`users.plan`** (`free` | `pro`, default `free`) plus
  `stripeCustomerId`/`stripeSubscriptionId` (both nullable, set lazily on
  first checkout) — `src/lib/db/schema.ts`.
- **`PLAN_LIMITS`** (`src/lib/billing/plans.ts`, unchanged from before):
  ```ts
  free: { maxTrackedProfiles: 10, maxSavedSearches: 10 }
  pro:  { maxTrackedProfiles: Infinity, maxSavedSearches: Infinity }
  ```
  Real enforcement in `trackProfile`/`createSavedSearch`, exactly as
  before — see the "Why a duplicate re-track/re-save doesn't
  false-positive" note below, unchanged.
- **Checkout** (`/api/v1/billing/checkout`, `POST`) — requires a
  logged-in account. Creates (or reuses) a Stripe customer for that
  user, then a Stripe-hosted Checkout Session (`mode: "subscription"`,
  the one `STRIPE_PRO_PRICE_ID` price) and returns its URL. The account
  page's "Upgrade to Pro" button just redirects the browser there — no
  Stripe.js/Elements anywhere in this app, so the CSP (`src/proxy.ts`)
  needed zero changes for this.
- **Billing portal** (`/api/v1/billing/portal`, `POST`) — for an account
  that already has a Stripe customer, opens Stripe's hosted Billing
  Portal (cancel, change card, view invoices). Requires the portal to be
  configured once in the Stripe dashboard (see setup steps below).
- **Webhook** (`/api/v1/billing/webhook`, `POST`) — the *only* path that
  ever sets `users.plan` to `"pro"`. Verifies the Stripe signature
  (`STRIPE_WEBHOOK_SECRET`) against the raw request body before trusting
  anything in it — a client-side "I paid" callback is never trusted on
  its own. Handles:
  - `checkout.session.completed` → sets the account (matched by
    `client_reference_id`, but written by Stripe customer id) to `pro`
    and records the new `stripeSubscriptionId`.
  - `customer.subscription.updated`/`.created` → re-derives the plan from
    the subscription's current `status` via
    `planForSubscriptionStatus()` (`src/lib/billing/webhook-handlers.ts`,
    unit tested) — only `active`/`trialing` count as Pro; `past_due`,
    `unpaid`, `incomplete`, `incomplete_expired`, and `paused` all revert
    to `free` rather than leaving an unpaid account on Pro.
  - `customer.subscription.deleted` → sets `free`, clears
    `stripeSubscriptionId`.
- **`/account`** shows the plan badge, usage vs. limit for both
  resources, and — when `STRIPE_SECRET_KEY` is set — a real "Upgrade to
  Pro" button (free plan) or "Manage billing" button (Pro plan);
  otherwise the same disabled "coming soon" button as before, so nothing
  breaks in an environment that hasn't configured Stripe.

## Setup (Stripe dashboard + env)

1. **Create the Product/Price.** Stripe dashboard → Products → add a
   recurring price for Pro (monthly or annual, your call) → copy its
   price id (`price_...`) into `STRIPE_PRO_PRICE_ID`.
2. **Set `STRIPE_SECRET_KEY`** from Developers → API keys (test mode
   first — `sk_test_...`).
3. **Create the webhook endpoint.** Developers → Webhooks → add endpoint
   pointing at `https://<your-domain>/api/v1/billing/webhook`, subscribe
   it to `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`.
   Copy its signing secret into `STRIPE_WEBHOOK_SECRET` — without this,
   checkout completes on Stripe's side but this app never finds out and
   the account stays on `free`.
4. **Enable the Billing Portal** once, in test mode too: Settings →
   Billing → Customer portal → Activate (Stripe requires at least one
   manual activation before the API can create portal sessions).
5. Only once all of the above is live in production should you switch
   from `sk_test_...`/test-mode price/webhook to the live-mode
   equivalents.

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
  the binary `free`/`pro` plan model. Multiple prices/tiers would need a
  plan-selection UI and a richer `PLAN_LIMITS` shape.
- **No usage overage handling** beyond a hard block — no grace period, no
  soft-limit warning banner before the limit is hit, no proration
  handling beyond what Stripe Checkout/Portal do automatically.
- **No invoices UI in this app** — invoices/receipts are viewed entirely
  in Stripe's hosted Billing Portal, not mirrored into `/account`.
- **No test coverage for the webhook route itself** (signature
  verification, DB writes) — only the pure `planForSubscriptionStatus()`
  mapping is unit tested; the route needs a real Stripe webhook secret
  and a live database to test end-to-end (verified manually against
  Stripe CLI's `stripe trigger`/`stripe listen` instead — see Stripe's
  own webhook-testing docs).
