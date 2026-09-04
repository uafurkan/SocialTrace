# Billing

Spec §31's plan model, with **real limit enforcement and no real payment
processing** — an explicit choice (the user asked for plan/limit infra
without Stripe when accounts were added). There is nothing to be honest
about hiding here: the account page says outright that upgrading is
"coming soon" and no payment form exists anywhere in the product.

## What's implemented

- **`users.plan`** (`free` | `pro`, default `free`) — `src/lib/db/schema.ts`.
- **`PLAN_LIMITS`** (`src/lib/billing/plans.ts`):
  ```ts
  free: { maxTrackedProfiles: 10, maxSavedSearches: 10 }
  pro:  { maxTrackedProfiles: Infinity, maxSavedSearches: Infinity }
  ```
- **Real enforcement**, not cosmetic: `trackProfile`
  (`src/lib/tracking/watchlist.ts`) and `createSavedSearch`
  (`src/lib/tracking/saved-searches.ts`) both accept an optional `plan`
  argument. When present (i.e. the caller is a logged-in account, not an
  anonymous visitor — see `docs/AUTH.md`'s identity resolution), the
  current count for that scope is checked against the plan's limit
  before inserting; over the limit throws `PlanLimitError`, which the
  API routes turn into a `403` with a message naming the plan, the
  limit, and what to do (untrack something, or upgrade). Verified live:
  tracked 11 profiles as a fresh `free`-plan account — the first 10
  succeeded, the 11th returned `403` with the expected message; `/account`
  correctly showed `10 / 10`.
- **Anonymous visitors are never limited.** There's no plan to enforce
  against someone who hasn't made an account — limiting them would be an
  arbitrary product restriction with no billing story behind it, not a
  real plan boundary. This matches the homepage's own claim: "No account
  required for basic public exploration."
- **`/account`** shows the plan badge, current usage vs. limit for both
  resources, and a disabled "Upgrade — coming soon" button with a title
  attribute explaining why, rather than a fake checkout flow.

## Why a duplicate re-track/re-save doesn't false-positive at the limit

Naively checking "count >= limit" before every insert would incorrectly
block a no-op — e.g. clicking Track again on a profile you're already
tracking while at exactly 10/10. Both `trackProfile` and
`createSavedSearch` check whether the specific row already exists first
(`isProfileTracked`, an equivalent lookup for saved searches) and skip
the limit check entirely when it does, since the subsequent
`onConflictDoNothing` insert won't actually add a new row.

## What's NOT implemented

- **No payment processing at all.** No Stripe, no other processor, no
  checkout page, no webhook handling, no invoices. This was explicit —
  "plan/limit infra only, no payment" was the option chosen when asked.
- **No way to actually become a `pro` user.** `users.plan` can only be
  set directly in the database right now (e.g. for manual testing) —
  there's no UI or API path that changes it, on purpose, since building
  one without real payment behind it would mean either a fake "upgrade"
  that grants Pro for free (misleading) or a partially-built payment
  flow that doesn't charge anyone (worse than not having it).
- **No usage overage handling** beyond a hard block — no grace period,
  no soft-limit warning banner before the limit is hit.
- **No annual/monthly distinction, no trial period, no invoicing** — the
  plan model is binary (`free`/`pro`) because that's what a limits-only
  system needs; the richer plan/pricing shape from spec §31 assumes real
  billing.

## When this needs to change

Real billing needs a payment processor (Stripe was the one discussed) —
that's a separate, explicit decision involving real API keys and real
money, not something to wire up speculatively. When it's added: a
webhook handler updates `users.plan` on subscription events, an
upgrade/downgrade UI replaces the disabled button on `/account`, and the
limit-enforcement code in `src/lib/billing/plans.ts` doesn't need to
change at all — it already reads `users.plan` as the source of truth.
