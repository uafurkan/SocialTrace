import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CoverageStatus, Profile, SocialUser } from "@/lib/domain/types";

import { coverageFor } from "@/lib/providers/coverage";

import { captureSnapshot, normalizeUsername } from "./capture";

/**
 * In-memory stand-in for the provider and the tables captureSnapshot touches.
 * The fake records every write as "<op>:<table name>" so a test can assert the
 * exact set of tables a capture wrote to (no social_users, no memberships).
 * Reads ignore their WHERE clause: each test seeds only the rows it needs.
 */
const fake = vi.hoisted(() => ({
  getProfile: vi.fn(),
  getFollowers: vi.fn(),
  getFollowing: vi.fn(),
  profileRows: [] as Array<Record<string, unknown>>,
  snapshotRows: [] as Array<Record<string, unknown>>,
  writes: [] as Array<{ op: "insert" | "update"; table: string; values: Array<Record<string, unknown>> }>,
}));

vi.mock("@/lib/providers", () => ({
  provider: { getProfile: fake.getProfile, getFollowers: fake.getFollowers, getFollowing: fake.getFollowing },
}));

vi.mock("@/lib/db", async () => {
  const schema = await import("@/lib/db/schema");

  const nameOf = (table: unknown): string =>
    Object.keys(schema).find((key) => (schema as Record<string, unknown>)[key] === table) ?? "unknown";

  const rowsFor = (table: unknown): Array<Record<string, unknown>> => {
    if (table === schema.profiles) return fake.profileRows;
    if (table === schema.profileSnapshots) return fake.snapshotRows;
    return [];
  };

  /** Awaitable like a drizzle insert, and also chainable into onConflictDoUpdate / returning. */
  const writeResult = (rows: Array<Record<string, unknown>>) =>
    Object.assign(Promise.resolve(rows), {
      returning: () => Promise.resolve(rows),
      onConflictDoUpdate: () => Object.assign(Promise.resolve(rows), { returning: () => Promise.resolve(rows) }),
    });

  const db = {
    select: () => ({
      from: (table: unknown) => {
        const rows = rowsFor(table);
        const query = {
          where: () => query,
          orderBy: () => query,
          limit: () => Promise.resolve(rows.slice(0, 1)),
        };
        return query;
      },
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown> | Array<Record<string, unknown>>) => {
        const list = Array.isArray(values) ? values : [values];
        fake.writes.push({ op: "insert", table: nameOf(table), values: list });
        return writeResult(list.map((row, index) => ({ id: `${nameOf(table)}-${index}`, capturedAt: new Date(), ...row })));
      },
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          fake.writes.push({ op: "update", table: nameOf(table), values: [values] });
          return { returning: () => Promise.resolve([{ ...rowsFor(table)[0], ...values }]) };
        },
      }),
    }),
  };

  return { schema, getDb: () => db, isDbConfigured: () => true };
});

const COVERAGE: CoverageStatus = {
  status: "unavailable",
  coveragePercent: 0,
  indexedCount: 0,
  totalCount: 0,
  lastCheckedAt: "2026-10-10T00:00:00.000Z",
};

const member: SocialUser = {
  id: "member-1",
  platform: "instagram",
  username: "alice",
  displayName: "Alice",
  avatarUrl: "",
  isVerified: false,
};

function profileFor(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "profile_creator",
    externalId: null,
    platform: "instagram",
    username: "creator",
    displayName: "Creator",
    bio: "",
    avatarUrl: "",
    isVerified: false,
    isPrivate: false,
    followerCount: 1200,
    followingCount: 340,
    postCount: 12,
    followerCoverage: COVERAGE,
    followingCoverage: COVERAGE,
    ...overrides,
  };
}

/** A stored profile row matching profileFor() by default, so only the fields a test changes show up as differences. */
function storedProfileRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "profile-1",
    platform: "instagram",
    username: "creator",
    normalizedUsername: "creator",
    externalId: null,
    displayName: "Creator",
    bio: "",
    avatarUrl: "",
    isVerified: false,
    isPrivate: false,
    followerCount: 1000,
    followingCount: 300,
    postCount: 10,
    ...overrides,
  };
}

function storedSnapshotRow(): Record<string, unknown> {
  return {
    id: "snapshot-0",
    profileId: "profile-1",
    followerCount: 1000,
    followingCount: 300,
    postCount: 10,
    indexedFollowerCount: 0,
    indexedFollowingCount: 0,
    followerCoveragePercent: "0",
    followingCoveragePercent: "0",
    capturedAt: new Date("2026-10-09T00:00:00.000Z"),
  };
}

function writesOf(table: string) {
  return fake.writes.filter((write) => write.table === table);
}

describe("normalizeUsername", () => {
  it("trims whitespace and lowercases", () => {
    expect(normalizeUsername("  Nike ")).toBe("nike");
  });

  it("is idempotent", () => {
    expect(normalizeUsername(normalizeUsername("SmallCreator"))).toBe("smallcreator");
  });
});

/**
 * Spec §1.2's coverage rounding, asserted through coverageFor (the function
 * that produces every coverage badge). These assertions used to test a copy
 * in this module, which was removed with the membership capture. They stay
 * here because coverage.ts has no test file of its own.
 */
describe("coverageFor rounding (spec §1.2)", () => {
  it("returns 0 when total is zero or negative", () => {
    expect(coverageFor(0, 0).coveragePercent).toBe(0);
    expect(coverageFor(5, 0).coveragePercent).toBe(0);
  });

  it("returns 100 for a fully indexed profile", () => {
    expect(coverageFor(180, 180).coveragePercent).toBe(100);
  });

  it("rounds to one decimal place at or above 1%", () => {
    expect(coverageFor(50, 200).coveragePercent).toBe(25);
    expect(coverageFor(1, 3).coveragePercent).toBe(33.3);
  });

  it("keeps two decimal places of precision below 1% so tiny coverage never rounds to a literal 0", () => {
    // A huge account with a tiny indexed sample must still show a non-zero percentage.
    const result = coverageFor(79_842, 312_482_913).coveragePercent;
    expect(result).toBeGreaterThan(0);
    expect(result).toBeCloseTo(0.03, 2);
  });
});

describe("captureSnapshot (no third-party identities)", () => {
  beforeEach(() => {
    fake.profileRows.length = 0;
    fake.snapshotRows.length = 0;
    fake.writes.length = 0;
    fake.getProfile.mockReset();
    fake.getFollowers.mockReset();
    fake.getFollowing.mockReset();
    fake.getProfile.mockResolvedValue({ profile: profileFor() });
    // A real member on each list, so any code path that stores member lists would write rows the assertions catch.
    fake.getFollowers.mockResolvedValue({ items: [member], nextCursor: null });
    fake.getFollowing.mockResolvedValue({ items: [member], nextCursor: null });
  });

  it("stores only the profile row and one snapshot row, and never requests a member list", async () => {
    const summary = await captureSnapshot("creator");

    expect(fake.getFollowers).not.toHaveBeenCalled();
    expect(fake.getFollowing).not.toHaveBeenCalled();
    expect(fake.writes.map((write) => `${write.op}:${write.table}`)).toEqual([
      "insert:profiles",
      "insert:profileSnapshots",
    ]);

    const [snapshot] = writesOf("profileSnapshots")[0].values;
    expect(snapshot).toMatchObject({
      followerCount: 1200,
      followingCount: 340,
      postCount: 12,
      indexedFollowerCount: 0,
      indexedFollowingCount: 0,
      followerCoveragePercent: "0",
      followingCoveragePercent: "0",
    });
    expect(summary).toMatchObject({ followerCount: 1200, indexedFollowerCount: 0, followerCoveragePercent: 0 });
  });

  it("records only profile-field change_events against the previous snapshot", async () => {
    fake.profileRows.push(storedProfileRow({ bio: "old bio" }));
    fake.snapshotRows.push(storedSnapshotRow());
    fake.getProfile.mockResolvedValue({ profile: profileFor({ bio: "new bio" }) });

    await captureSnapshot("creator");

    expect(fake.getFollowers).not.toHaveBeenCalled();
    expect(fake.writes.map((write) => `${write.op}:${write.table}`)).toEqual([
      "update:profiles",
      "insert:profileSnapshots",
      "insert:changeEvents",
    ]);

    const [change] = writesOf("changeEvents")[0].values;
    expect(change).toMatchObject({
      profileId: "profile-1",
      fromSnapshotId: "snapshot-0",
      field: "bio",
      oldValue: "old bio",
      newValue: "new bio",
    });
    expect(change).not.toHaveProperty("socialUserId");
    expect(change).not.toHaveProperty("membershipEvent");
    expect(change).not.toHaveProperty("membershipKind");
  });

  it("writes no change_events when no profile field changed, even though counts moved", async () => {
    fake.profileRows.push(storedProfileRow());
    fake.snapshotRows.push(storedSnapshotRow());

    await captureSnapshot("creator");

    expect(fake.writes.map((write) => `${write.op}:${write.table}`)).toEqual([
      "update:profiles",
      "insert:profileSnapshots",
    ]);
  });
});
