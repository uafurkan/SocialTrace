import type Stripe from "stripe";

/**
 * Pure mapping, kept separate from the webhook route so it's unit
 * testable without a real Stripe event or database (see
 * webhook-handlers.test.ts). Only "active" and "trialing" count as Pro —
 * every other Stripe subscription status (past_due, unpaid, canceled,
 * incomplete, incomplete_expired, paused) reverts the account to free
 * rather than leaving it Pro on a subscription that isn't actually being
 * paid for.
 */
export function planForSubscriptionStatus(status: Stripe.Subscription.Status): "free" | "pro" {
  return status === "active" || status === "trialing" ? "pro" : "free";
}
