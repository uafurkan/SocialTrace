import type { CursorPage } from "@/lib/domain/types";

/** Hard cap on provider pages per call, so a provider that keeps returning new cursors cannot run up unbounded requests. */
const MAX_PAGES = 50;

/**
 * Drains a cursor-paginated provider method up to `limit` items, for callers (export, snapshot capture) that need a bounded full list rather than one page at a time.
 * Stops at `limit`, at the last page, on an empty page, on a cursor that was already requested, or at MAX_PAGES (logged as a warning).
 */
export async function collectPages<T>(
  fetchPage: (cursor: string | undefined) => Promise<CursorPage<T>>,
  limit: number,
): Promise<T[]> {
  const items: T[] = [];
  const requestedCursors = new Set<string>();
  let cursor: string | undefined;
  for (let pageNumber = 1; ; pageNumber += 1) {
    const page = await fetchPage(cursor);
    if (page.items.length === 0) break;
    items.push(...page.items);
    const nextCursor = page.nextCursor ?? undefined;
    if (!nextCursor || items.length >= limit) break;
    if (requestedCursors.has(nextCursor)) break;
    if (pageNumber >= MAX_PAGES) {
      console.warn(
        `[collect] stopped at the ${MAX_PAGES}-page cap with more pages available (${items.length} items, limit ${limit})`,
      );
      break;
    }
    requestedCursors.add(nextCursor);
    cursor = nextCursor;
  }
  return items.slice(0, limit);
}
