import type { CoverageStatus } from "@/lib/domain/types";
import { formatCount, formatRelativeTime } from "@/lib/utils";
import { copy } from "@/lib/copy";

/**
 * The single place coverage/completeness is rendered (spec §1.2).
 * Never display a raw follower count as if it were the indexed dataset
 * size — always show indexed vs total and the coverage percentage.
 */
export function CoverageBadge({ coverage }: { coverage: CoverageStatus }) {
  const isFullCoverage = coverage.status === "available";

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-secondary">
      <span>
        {copy.profile.lastCheckedLabel}{" "}
        <span className="text-primary">{formatRelativeTime(coverage.lastCheckedAt)}</span>
      </span>
      <span>
        {isFullCoverage ? (
          <>
            {copy.followers.indexedLabel}{" "}
            <span className="text-primary">{formatCount(coverage.indexedCount)}</span>
          </>
        ) : (
          <>
            {copy.followers.indexedLabel}{" "}
            <span className="text-primary">{formatCount(coverage.indexedCount)}</span> of{" "}
            {formatCount(coverage.totalCount)}
          </>
        )}
      </span>
      <span
        className={isFullCoverage ? "font-medium text-success" : "font-medium text-warning"}
      >
        {copy.profile.coverageLabel} {coverage.coveragePercent}%
      </span>
    </div>
  );
}
