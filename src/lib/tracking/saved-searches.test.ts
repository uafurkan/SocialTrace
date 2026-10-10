import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SocialUser } from "@/lib/domain/types";
import { compareSnapshots } from "@/lib/diff/compare";
import { savedSearches } from "@/lib/db/schema";
import { listSavedSearches, matches } from "./saved-searches";

/**
 * In-memory stand-in for the saved-search query listSavedSearches runs. Rows
 * are seeded already shaped like the joined select (username included), and
 * the WHERE clause is ignored: each test seeds only the rows it needs. Every
 * table passed to from() is recorded, so a test can assert which tables a
 * listing read.
 */
const fake = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  readTables: [] as unknown[],
}));

vi.mock("@/lib/db", async () => {
  const schema = await import("@/lib/db/schema");

  /** Awaitable like a drizzle select: join, filter and ordering calls pass the query through. */
  const selectQuery = (rows: Array<Record<string, unknown>>) => {
    const query = {
      innerJoin: () => query,
      where: () => query,
      orderBy: () => query,
      then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(rows).then(onFulfilled, onRejected),
    };
    return query;
  };

  return {
    schema,
    getDb: () => ({
      select: () => ({
        from: (table: unknown) => {
          fake.readTables.push(table);
          return selectQuery(fake.rows);
        },
      }),
    }),
  };
});

// A member-level comparison must never be attempted, so any call here is a regression.
vi.mock("@/lib/diff/compare", () => ({ compareSnapshots: vi.fn() }));

const UNAVAILABLE_REASON = "Member-level changes are not recorded any more.";

function user(username: string, displayName: string): SocialUser {
  return { id: username, platform: "instagram", username, displayName, avatarUrl: "", isVerified: false };
}

describe("matches", () => {
  it("matches a substring of the username, case-insensitively", () => {
    expect(matches(user("BrandOfficial", "Brand"), "brand")).toBe(true);
    expect(matches(user("brandofficial", "Something Else"), "OFFICIAL")).toBe(true);
  });

  it("matches a substring of the display name", () => {
    expect(matches(user("alex_92", "Alexandra Smith"), "alexandra")).toBe(true);
  });

  it("returns false when neither field contains the query", () => {
    expect(matches(user("nike", "Nike"), "adidas")).toBe(false);
  });
});

describe("listSavedSearches", () => {
  beforeEach(() => {
    fake.rows = [];
    fake.readTables = [];
    vi.mocked(compareSnapshots).mockClear();
  });

  it("reports every saved search as unavailable with the fixed reason and no matches", async () => {
    fake.rows = [
      { id: "s1", profileId: "p1", username: "nike", kind: "follower", query: "run" },
      { id: "s2", profileId: "p2", username: "adidas", kind: "following", query: "pro" },
    ];

    await expect(listSavedSearches("visitor-1")).resolves.toEqual([
      {
        id: "s1",
        profileId: "p1",
        username: "nike",
        kind: "follower",
        query: "run",
        available: false,
        reason: UNAVAILABLE_REASON,
        newMatches: [],
        removedMatches: [],
      },
      {
        id: "s2",
        profileId: "p2",
        username: "adidas",
        kind: "following",
        query: "pro",
        available: false,
        reason: UNAVAILABLE_REASON,
        newMatches: [],
        removedMatches: [],
      },
    ]);
  });

  it("does not attempt a member-level comparison or read snapshot rows", async () => {
    fake.rows = [{ id: "s1", profileId: "p1", username: "nike", kind: "follower", query: "run" }];

    await listSavedSearches("visitor-1");

    expect(compareSnapshots).not.toHaveBeenCalled();
    expect(fake.readTables).toHaveLength(1);
    expect(fake.readTables[0]).toBe(savedSearches);
  });

  it("returns an empty list when nothing is saved", async () => {
    await expect(listSavedSearches("visitor-1")).resolves.toEqual([]);
  });
});
