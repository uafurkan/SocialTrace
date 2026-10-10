import { afterEach, describe, expect, it, vi } from "vitest";

import type { CursorPage } from "@/lib/domain/types";

import { collectPages } from "./collect";

function page(items: number[], nextCursor: string | null = null): CursorPage<number> {
  return { items, nextCursor, totalCount: items.length };
}

/** Fake provider method: serves one fixed page per cursor and fails on any cursor the test did not define. */
function fakeProvider(pages: Map<string | undefined, CursorPage<number>>) {
  return vi.fn(async (cursor: string | undefined) => {
    const next = pages.get(cursor);
    if (!next) throw new Error(`unexpected cursor: ${cursor ?? "<first>"}`);
    return next;
  });
}

/** Cursors passed to the fake, in call order. */
function requestedCursors(fetchPage: { mock: { calls: unknown[][] } }): (string | undefined)[] {
  return fetchPage.mock.calls.map((call) => call[0] as string | undefined);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("collectPages", () => {
  it("follows cursors in order until the provider reports no next page", async () => {
    const fetchPage = fakeProvider(
      new Map([
        [undefined, page([1, 2], "b")],
        ["b", page([3, 4], "c")],
        ["c", page([5])],
      ]),
    );

    expect(await collectPages(fetchPage, 100)).toEqual([1, 2, 3, 4, 5]);
    expect(requestedCursors(fetchPage)).toEqual([undefined, "b", "c"]);
  });

  it("stops once the limit is reached and trims the result to it", async () => {
    const fetchPage = fakeProvider(
      new Map([
        [undefined, page([1, 2], "b")],
        ["b", page([3, 4], "c")],
        ["c", page([5])],
      ]),
    );

    expect(await collectPages(fetchPage, 3)).toEqual([1, 2, 3]);
    expect(requestedCursors(fetchPage)).toEqual([undefined, "b"]);
  });

  it("stops on an empty page even when it carries a next cursor", async () => {
    const fetchPage = fakeProvider(
      new Map([
        [undefined, page([1, 2], "b")],
        ["b", page([], "c")],
        ["c", page([9])],
      ]),
    );

    expect(await collectPages(fetchPage, 100)).toEqual([1, 2]);
    expect(requestedCursors(fetchPage)).toEqual([undefined, "b"]);
  });

  it("returns an empty list when the first page is empty", async () => {
    const fetchPage = fakeProvider(new Map([[undefined, page([], "b")]]));

    expect(await collectPages(fetchPage, 100)).toEqual([]);
    expect(requestedCursors(fetchPage)).toEqual([undefined]);
  });

  it("stops when the provider returns a cursor it already used", async () => {
    const fetchPage = fakeProvider(
      new Map([
        [undefined, page([1], "b")],
        ["b", page([2], "b")],
      ]),
    );

    expect(await collectPages(fetchPage, 100)).toEqual([1, 2]);
    expect(requestedCursors(fetchPage)).toEqual([undefined, "b"]);
  });

  it("stops when a longer cycle of cursors comes back to an earlier one", async () => {
    const fetchPage = fakeProvider(
      new Map([
        [undefined, page([1], "b")],
        ["b", page([2], "c")],
        ["c", page([3], "b")],
      ]),
    );

    expect(await collectPages(fetchPage, 100)).toEqual([1, 2, 3]);
    expect(requestedCursors(fetchPage)).toEqual([undefined, "b", "c"]);
  });

  it("stops at the 50-page cap and logs a warning when more pages are available", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let calls = 0;
    const fetchPage = vi.fn(async () => {
      calls += 1;
      return page([calls], `cursor-${calls}`);
    });

    const result = await collectPages(fetchPage, 1000);

    expect(fetchPage).toHaveBeenCalledTimes(50);
    expect(result).toHaveLength(50);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("does not warn when the 50th page is the last one", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let calls = 0;
    const fetchPage = vi.fn(async () => {
      calls += 1;
      return page([calls], calls < 50 ? `cursor-${calls}` : null);
    });

    const result = await collectPages(fetchPage, 1000);

    expect(fetchPage).toHaveBeenCalledTimes(50);
    expect(result).toHaveLength(50);
    expect(warn).not.toHaveBeenCalled();
  });
});
