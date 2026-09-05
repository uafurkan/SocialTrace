import Stripe from "stripe";

/**
 * Lazy Stripe client factory, same pattern as src/lib/db/index.ts — throws
 * a clear error if STRIPE_SECRET_KEY is unset rather than the SDK's own
 * less obvious failure, and callers that can run without billing (there
 * aren't many — Stripe is the one thing actually gating "can you pay us")
 * should check isStripeConfigured() first.
 */
let cached: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  if (cached) return cached;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set. See .env.example / docs/BILLING.md.");
  }

  cached = new Stripe(secretKey);
  return cached;
}

/** The one recurring price this app sells — see docs/BILLING.md for setup. */
export function getProPriceId(): string {
  const priceId = process.env.STRIPE_PRO_PRICE_ID;
  if (!priceId) {
    throw new Error("STRIPE_PRO_PRICE_ID is not set. See .env.example / docs/BILLING.md.");
  }
  return priceId;
}
