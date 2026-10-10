"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import type { Post } from "@/lib/domain/types";
import {
  bandRange,
  buildPostingTimes,
  findBusiestCell,
  getVisitorTimeZone,
  groupHoursIntoBands,
  heatOpacity,
  WEEKDAY_NAMES,
  WEEKDAY_SHORT,
} from "@/lib/posts/posting-time";

const MIN_DATED = 12;
const BAND_HOURS = 3;
const LEGEND_OPACITIES = [0.25, 0.5, 0.75, 1];

type ZoneMode = "local" | "utc";

// The browser's zone is unknown while the server renders. useSyncExternalStore reads
// the server snapshot (null, which means UTC) during hydration, so the server HTML
// matches the first client render. The real zone is read right after hydration.
const subscribeToNothing = () => () => {};
const noZoneOnServer = (): string | null => null;

/**
 * When this creator posts, from the loaded posts with a known date. It is the
 * creator's posting time only, not audience activity, and says so on the page.
 */
export function PostingTimePanel({ posts }: { posts: Post[] }) {
  const [mode, setMode] = useState<ZoneMode>("local");
  const visitorZone = useSyncExternalStore(subscribeToNothing, getVisitorTimeZone, noZoneOnServer);
  const showingLocal = mode === "local" && visitorZone !== null;
  const zone = showingLocal ? visitorZone : "UTC";
  const timing = useMemo(() => buildPostingTimes(posts, zone), [posts, zone]);

  if (timing.datedCount < MIN_DATED) {
    return (
      <p className="text-sm text-muted">
        Posting times need at least {MIN_DATED} posts with a known date. This page has {timing.datedCount}.
      </p>
    );
  }

  const bands = groupHoursIntoBands(timing.grid, BAND_HOURS);
  const busiest = findBusiestCell(bands);
  const maxCount = busiest?.count ?? 0;
  const caption = showingLocal ? `Times in your local zone (${zone})` : "Times in UTC";
  const busiestText = busiest
    ? `Busiest slot: ${WEEKDAY_NAMES[busiest.row]}, ${bandRange(busiest.column, BAND_HOURS).long}, with ${busiest.count} ${busiest.count === 1 ? "post" : "posts"}${busiest.tied > 1 ? ` (tied with ${busiest.tied - 1} other ${busiest.tied - 1 === 1 ? "slot" : "slots"})` : ""}.`
    : "No posts fall in any time band.";

  return (
    <section className="mb-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-primary">When this creator posts</h3>
        <div role="group" aria-label="Time zone" className="flex gap-1">
          <Button
            variant={mode === "local" ? "secondary" : "tertiary"}
            size="sm"
            aria-pressed={mode === "local"}
            onClick={() => setMode("local")}
          >
            Local
          </Button>
          <Button
            variant={mode === "utc" ? "secondary" : "tertiary"}
            size="sm"
            aria-pressed={mode === "utc"}
            onClick={() => setMode("utc")}
          >
            UTC
          </Button>
        </div>
      </div>

      <p className="mb-2 text-xs text-muted">
        {caption}. Posts are grouped into {BAND_HOURS}-hour bands.
      </p>

      <table className="w-full table-fixed border-separate border-spacing-0.5 text-xs">
        <caption className="sr-only">
          Posts by weekday and {BAND_HOURS}-hour band. {caption}.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="w-10">
              <span className="sr-only">Weekday</span>
            </th>
            {bands[0].map((_, column) => (
              <th key={column} scope="col" className="pb-1 text-center text-[11px] font-normal text-muted">
                {bandRange(column, BAND_HOURS).short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {WEEKDAY_SHORT.map((day, row) => (
            <tr key={day}>
              <th scope="row" className="pr-1 text-right font-normal text-muted">
                {day}
              </th>
              {bands[row].map((count, column) => {
                const label = `${WEEKDAY_NAMES[row]} ${bandRange(column, BAND_HOURS).long}: ${count} ${count === 1 ? "post" : "posts"}`;
                return (
                  <td key={column} title={label} className="relative h-9 rounded-sm bg-surface-subtle">
                    {count > 0 ? (
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 rounded-sm bg-brand"
                        style={{ opacity: heatOpacity(count, maxCount) }}
                      />
                    ) : null}
                    <span className="sr-only">{label}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>Fewer</span>
        {LEGEND_OPACITIES.map((opacity) => (
          <span key={opacity} aria-hidden="true" className="size-3 rounded-sm bg-brand" style={{ opacity }} />
        ))}
        <span>More, scaled to the busiest slot</span>
      </div>

      <p className="mt-2 text-sm text-secondary">{busiestText}</p>
      <p className="mt-2 text-xs text-muted">
        Based on {timing.datedCount} dated posts; {timing.skippedNoDate} skipped because the date is unknown. These are the
        creator&apos;s own posting times. They say nothing about when the audience is online.
      </p>
    </section>
  );
}
