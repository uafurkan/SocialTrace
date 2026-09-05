/**
 * Pure mapping, kept separate from the webhook route so it's unit
 * testable without a real Paddle event or database (see
 * webhook-handlers.test.ts). Paddle's subscription.status enum has
 * exactly five values (verified against Paddle's API reference) — only
 * "active" and "trialing" count as Pro; "past_due", "paused", and
 * "canceled" all revert the account to free rather than leaving it Pro on
 * a subscription that isn't actually being paid for.
 */
export type PaddleSubscriptionStatus = "active" | "trialing" | "past_due" | "paused" | "canceled";

export function planForSubscriptionStatus(status: PaddleSubscriptionStatus): "free" | "pro" {
  return status === "active" || status === "trialing" ? "pro" : "free";
}
