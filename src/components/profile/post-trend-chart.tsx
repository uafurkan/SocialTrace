import type { Post } from "@/lib/domain/types";
import { buildPostTrend, type TrendBucket, type TrendGranularity } from "@/lib/posts/trend";
import { formatCount } from "@/lib/utils";

const MIN_DATED = 3;
const VIEW_WIDTH = 320;
const VIEW_HEIGHT = 170;
const PLOT = { top: 10, right: 6, bottom: 22, left: 30 };
const PLOT_WIDTH = VIEW_WIDTH - PLOT.left - PLOT.right;
const PLOT_HEIGHT = VIEW_HEIGHT - PLOT.top - PLOT.bottom;
const MAX_BAR_WIDTH = 24;
const BAR_GAP = 2;
const BAR_RADIUS = 4;
const MAX_AXIS_LABELS = 6;
/** Rough glyph width at the 10px axis font, used only to keep edge labels inside the viewBox. */
const AXIS_GLYPH_WIDTH = 5.8;
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A round tick step that gives about four y-axis intervals. Always a whole number of posts. */
function tickStep(max: number): number {
  const raw = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return Math.max(1, Math.round(nice * magnitude));
}

/** A bar with a rounded top and a square baseline. */
function barPath(x: number, top: number, width: number, height: number, radius: number): string {
  const bottom = top + height;
  return [
    `M${x},${bottom}`,
    `V${top + radius}`,
    `Q${x},${top} ${x + radius},${top}`,
    `H${x + width - radius}`,
    `Q${x + width},${top} ${x + width},${top + radius}`,
    `V${bottom}`,
    "Z",
  ].join(" ");
}

/** Short x-axis label: "Jan 5" for weeks (with the year when it changes), "Jan 2026" for months. */
function axisLabel(bucket: TrendBucket, index: number, buckets: TrendBucket[], unit: TrendGranularity): string {
  const [year, month, day] = bucket.start.split("-").map(Number);
  const name = MONTH_NAMES[month - 1];
  if (unit === "month") return `${name} ${year}`;
  const previousYear = index > 0 ? Number(buckets[index - 1].start.slice(0, 4)) : null;
  return previousYear === year ? `${name} ${day}` : `${name} ${day}, ${year}`;
}

function formatAverage(value: number | null): string {
  return value === null ? "—" : formatCount(Math.round(value));
}

/**
 * Post count per week or month, from the loaded posts with a known date. Drawn as
 * an inline SVG that scales to its container. The same numbers are in a table.
 */
export function PostTrendChart({ posts }: { posts: Post[] }) {
  const trend = buildPostTrend(posts);

  if (trend.datedCount < MIN_DATED) {
    return (
      <p className="text-sm text-muted">
        Not enough dated posts to show a trend. At least {MIN_DATED} posts with a known date are needed.
      </p>
    );
  }

  const { buckets } = trend;
  const unit: TrendGranularity = trend.granularity === "month" ? "month" : "week";
  const first = buckets[0];
  const last = buckets[buckets.length - 1];
  const busiest = buckets.reduce((best, bucket) => (bucket.count > best.count ? bucket : best), first);

  const step = tickStep(busiest.count);
  const yMax = Math.ceil(busiest.count / step) * step;
  const ticks = Array.from({ length: yMax / step + 1 }, (_, index) => index * step);
  const yOf = (count: number) => PLOT.top + PLOT_HEIGHT - (count / yMax) * PLOT_HEIGHT;

  const slot = PLOT_WIDTH / buckets.length;
  const barWidth = Math.max(1, Math.min(MAX_BAR_WIDTH, slot - BAR_GAP));
  const labelEvery = Math.max(1, Math.ceil(buckets.length / MAX_AXIS_LABELS));

  const summary = `Posts per ${unit}, from ${first.label} to ${last.label}. Busiest ${unit}: ${busiest.label}, with ${busiest.count} ${busiest.count === 1 ? "post" : "posts"}.`;

  return (
    <section className="mb-4">
      <h3 className="text-sm font-semibold text-primary">Posts per {unit} (UTC)</h3>
      <figure className="mt-2">
        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          role="img"
          aria-label={summary}
          className="block h-auto w-full"
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PLOT.left}
                x2={VIEW_WIDTH - PLOT.right}
                y1={yOf(tick)}
                y2={yOf(tick)}
                strokeWidth={1}
                className="stroke-border"
              />
              <text x={PLOT.left - 6} y={yOf(tick)} dy="0.32em" textAnchor="end" className="fill-muted text-[10px]">
                {formatCount(tick)}
              </text>
            </g>
          ))}

          {buckets.map((bucket, index) => {
            const x = PLOT.left + index * slot;
            const barX = x + (slot - barWidth) / 2;
            const top = yOf(bucket.count);
            const height = PLOT.top + PLOT_HEIGHT - top;
            const tooltip = `${bucket.label}: ${bucket.count} ${bucket.count === 1 ? "post" : "posts"}`;
            return (
              <g key={bucket.start}>
                {bucket.count > 0 ? (
                  <path
                    d={barPath(barX, top, barWidth, height, Math.min(BAR_RADIUS, barWidth / 2, height))}
                    className="fill-brand"
                  />
                ) : null}
                {/* A full-band hit area, so hovering a short or empty bar still shows its values. */}
                <rect x={x} y={PLOT.top} width={slot} height={PLOT_HEIGHT} fill="transparent">
                  <title>{tooltip}</title>
                </rect>
              </g>
            );
          })}

          {buckets.map((bucket, index) => {
            if (index % labelEvery !== 0) return null;
            const text = axisLabel(bucket, index, buckets, unit);
            const half = (text.length * AXIS_GLYPH_WIDTH) / 2;
            const centerX = PLOT.left + index * slot + slot / 2;
            const x = Math.min(Math.max(centerX, half), VIEW_WIDTH - half);
            return (
              <text key={bucket.start} x={x} y={VIEW_HEIGHT - 6} textAnchor="middle" className="fill-muted text-[10px]">
                {text}
              </text>
            );
          })}
        </svg>
        <figcaption className="mt-2 text-xs text-muted">
          Based on {trend.datedCount} dated posts; {trend.skippedNoDate} skipped because the date is unknown.
        </figcaption>
      </figure>

      <details className="mt-2">
        <summary className="cursor-pointer text-xs font-medium text-secondary">View as table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Posts per {unit} in UTC, with average likes and comments</caption>
            <thead>
              <tr className="text-muted">
                <th scope="col" className="py-1 pr-2 font-medium">
                  Period
                </th>
                <th scope="col" className="py-1 pr-2 text-right font-medium">
                  Posts
                </th>
                <th scope="col" className="py-1 pr-2 text-right font-medium">
                  Avg likes
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  Avg comments
                </th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((bucket) => (
                <tr key={bucket.start} className="border-t border-border">
                  <th scope="row" className="py-1 pr-2 font-normal text-secondary">
                    {bucket.label}
                  </th>
                  <td className="py-1 pr-2 text-right tabular-nums">{bucket.count}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{formatAverage(bucket.avgLikes)}</td>
                  <td className="py-1 text-right tabular-nums">{formatAverage(bucket.avgComments)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
