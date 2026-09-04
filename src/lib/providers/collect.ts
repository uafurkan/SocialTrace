import type { CursorPage } from "@/lib/domain/types";

/** Drains a cursor-paginated provider method up to `limit` items, for callers (export, snapshot capture) that need a bounded full list rather than one page at a time. */
export async function collectPages<T>(
  fetchPage: (cursor: string | undefined) => Promise<CursorPage<T>>,
  limit: number,
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  do {
    const page = await fetchPage(cursor);
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor && items.length < limit);
  return items.slice(0, limit);
}
