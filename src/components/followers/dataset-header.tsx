import type { CoverageStatus } from "@/lib/domain/types";
import { CoverageBadge } from "@/components/profile/coverage-badge";
import { copy } from "@/lib/copy";

export function DatasetHeader({ title, coverage }: { title: string; coverage: CoverageStatus }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-primary">{title}</h2>
      <div className="mt-1">
        <CoverageBadge coverage={coverage} />
      </div>
      {coverage.status === "partial" ? (
        <div className="mt-4 rounded-card border border-warning-soft bg-warning-soft px-4 py-3">
          <p className="text-sm font-medium text-primary">{copy.partialData.title}</p>
          <p className="mt-1 text-sm text-secondary">{copy.partialData.body(coverage.coveragePercent)}</p>
        </div>
      ) : null}
    </div>
  );
}
