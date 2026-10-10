import type { PostInsights } from "@/lib/posts/insights";
import { formatCount } from "@/lib/utils";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-border bg-surface-subtle px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-primary">{value}</dd>
    </div>
  );
}

/**
 * Stats for the posts already loaded on the page. The footnote says so, since
 * an average over the latest posts is not an average over the whole account.
 */
export function PostInsightsPanel({ insights }: { insights: PostInsights }) {
  const postsPerWeek = insights.daysBetweenPosts && insights.daysBetweenPosts > 0 ? 7 / insights.daysBetweenPosts : null;

  return (
    <section aria-label="Post statistics" className="mb-4">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Avg likes" value={formatCount(Math.round(insights.avgLikes))} />
        <Stat label="Median likes" value={formatCount(Math.round(insights.medianLikes))} />
        <Stat label="Avg comments" value={formatCount(Math.round(insights.avgComments))} />
        {insights.avgViews != null ? <Stat label="Avg views" value={formatCount(Math.round(insights.avgViews))} /> : null}
        {postsPerWeek != null ? <Stat label="Posting frequency" value={`~${postsPerWeek.toFixed(1)} a week`} /> : null}
      </dl>
      <p className="mt-2 text-xs text-muted">
        Based on the {insights.sampleSize} latest {insights.sampleSize === 1 ? "post" : "posts"} loaded on this page, not the whole account.
      </p>
    </section>
  );
}
