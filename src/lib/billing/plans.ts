export type Plan = "free" | "pro";

export type LimitedResource = "tracked profiles" | "saved searches" | "transcriptions per day";

export interface PlanLimits {
  maxTrackedProfiles: number;
  maxSavedSearches: number;
  /** Video transcriber (docs/TRANSCRIBER.md) — counted via transcriptionUsage rows since UTC midnight, not a stored row count like the other two. */
  maxTranscriptionsPerDay: number;
}

const RESOURCE_LIMIT_KEY: Record<LimitedResource, keyof PlanLimits> = {
  "tracked profiles": "maxTrackedProfiles",
  "saved searches": "maxSavedSearches",
  "transcriptions per day": "maxTranscriptionsPerDay",
};

/**
 * Spec §31's plan model, without any payment processing behind it (see
 * docs/BILLING.md) — this is real limit *enforcement*, just no real
 * upgrade path to Pro yet (the account page's upgrade button is
 * disabled). Anonymous visitors (no account) are never subject to these
 * limits at all — there's no plan to bill them against, so limiting them
 * would just be an arbitrary product restriction with nothing behind it.
 * (The transcriber is the one exception: anonymous visitors get their own
 * separate, smaller daily cap — see src/lib/transcription/quota.ts —
 * because unlike tracked-profile/saved-search rows, an uncapped anonymous
 * transcriber is a real, unbounded Apify/Groq bill.)
 */
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: { maxTrackedProfiles: 10, maxSavedSearches: 10, maxTranscriptionsPerDay: 5 },
  pro: { maxTrackedProfiles: Infinity, maxSavedSearches: Infinity, maxTranscriptionsPerDay: 50 },
};

export class PlanLimitError extends Error {
  constructor(
    public readonly plan: Plan,
    public readonly limit: number,
    resource: LimitedResource,
  ) {
    super(
      `The ${plan} plan is limited to ${limit} ${resource}. ${
        resource === "transcriptions per day"
          ? "Try again tomorrow, or upgrade to Pro for a higher daily limit."
          : `Untrack something else first, or upgrade to Pro for unlimited ${resource}.`
      }`,
    );
    this.name = "PlanLimitError";
  }
}

export function assertWithinLimit(plan: Plan, resource: LimitedResource, currentCount: number): void {
  const limit = PLAN_LIMITS[plan][RESOURCE_LIMIT_KEY[resource]];
  if (currentCount >= limit) {
    throw new PlanLimitError(plan, limit, resource);
  }
}
