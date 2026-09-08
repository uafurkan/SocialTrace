import type { CoverageStatus } from "@/lib/domain/types";

/**
 * Upper bound on how many followers/following any integration will pull for
 * one profile. Coverage is computed against this cap rather than a live count
 * — see docs/PROVIDER_CONTRACT.md for why calling a follower-scraper actor on
 * every profile view is too expensive to do eagerly.
 */
export const MEMBER_FETCH_CAP = 200;

/**
 * Spec §1.2's data-honesty rule in one function: never present an indexed
 * subset as if it were the whole dataset. Lives here, outside any one
 * provider, so sources that produce the same `Profile` compute it identically
 * — a profile fetched from the free public endpoint and the same profile
 * fetched from Apify must be indistinguishable downstream.
 */
export function coverageFor(indexed: number, total: number): CoverageStatus {
  const raw = total === 0 ? 0 : (indexed / total) * 100;
  const coveragePercent = raw === 0 ? 0 : raw < 1 ? Math.round(raw * 100) / 100 : Math.round(raw * 10) / 10;
  return {
    status: coveragePercent >= 99.5 ? "available" : indexed > 0 ? "partial" : "unavailable",
    coveragePercent,
    indexedCount: indexed,
    totalCount: total,
    lastCheckedAt: new Date().toISOString(),
  };
}
