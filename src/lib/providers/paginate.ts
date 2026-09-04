import type { CursorPage } from "@/lib/domain/types";

/** Offset-encoded cursor pagination over an in-memory array, shared by every provider. */
export function paginate<T>(items: T[], cursor: string | undefined, limit: number): CursorPage<T> {
  const offset = cursor ? Number.parseInt(cursor, 10) || 0 : 0;
  const page = items.slice(offset, offset + limit);
  const nextOffset = offset + limit;
  return {
    items: page,
    nextCursor: nextOffset < items.length ? String(nextOffset) : null,
    totalCount: items.length,
  };
}
