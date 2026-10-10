import { CHAIN_DEADLINE_MS, DeadlineExceededError, withDeadline } from "@/lib/cache/cold-budget";
import type { Platform } from "@/lib/domain/types";
import { calculateEngagement, EngagementError, type EngagementErrorReason, type EngagementResult } from "@/lib/engagement/calculate";

export const STATUS_BY_REASON: Record<EngagementErrorReason, number> = {
  profile_not_found: 404,
  private_account: 403,
  no_posts: 422,
  // 503, not 502: the profile is fine, our data source is temporarily out.
  source_unavailable: 503,
};

export interface SideResult {
  result?: EngagementResult;
  error?: { reason: string; message: string };
}

/** One side of a comparison. A side that fails never throws: it comes back as its own error. */
export async function resolveSide(platform: Platform, username: string): Promise<SideResult> {
  try {
    const result = await withDeadline(calculateEngagement(platform, username), CHAIN_DEADLINE_MS);
    return { result };
  } catch (error) {
    if (error instanceof DeadlineExceededError) {
      return { error: { reason: "timeout", message: "This profile took too long to analyze. Try again in a moment." } };
    }
    if (error instanceof EngagementError) {
      return { error: { reason: error.reason, message: error.message } };
    }
    console.error("[competitor-analyzer] failed:", error);
    return { error: { reason: "engagement_failed", message: "Could not calculate engagement for this profile." } };
  }
}
