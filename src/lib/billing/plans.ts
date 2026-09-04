export type Plan = "free" | "pro";

export interface PlanLimits {
  maxTrackedProfiles: number;
  maxSavedSearches: number;
}

/**
 * Spec §31's plan model, without any payment processing behind it (see
 * docs/BILLING.md) — this is real limit *enforcement*, just no real
 * upgrade path to Pro yet (the account page's upgrade button is
 * disabled). Anonymous visitors (no account) are never subject to these
 * limits at all — there's no plan to bill them against, so limiting them
 * would just be an arbitrary product restriction with nothing behind it.
 */
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: { maxTrackedProfiles: 10, maxSavedSearches: 10 },
  pro: { maxTrackedProfiles: Infinity, maxSavedSearches: Infinity },
};

export class PlanLimitError extends Error {
  constructor(
    public readonly plan: Plan,
    public readonly limit: number,
    resource: "tracked profiles" | "saved searches",
  ) {
    super(
      `The ${plan} plan is limited to ${limit} ${resource}. Untrack something else first, or upgrade to Pro for unlimited ${resource}.`,
    );
    this.name = "PlanLimitError";
  }
}

export function assertWithinLimit(
  plan: Plan,
  resource: "tracked profiles" | "saved searches",
  currentCount: number,
): void {
  const limit = resource === "tracked profiles" ? PLAN_LIMITS[plan].maxTrackedProfiles : PLAN_LIMITS[plan].maxSavedSearches;
  if (currentCount >= limit) {
    throw new PlanLimitError(plan, limit, resource);
  }
}
