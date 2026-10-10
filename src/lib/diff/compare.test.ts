import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * In-memory stand-in for the tables compareSnapshots reads. The fake records
 * every table read, so a test can assert which tables a comparison touched.
 * Reads ignore their WHERE clause: each test seeds only the rows it needs.
 * memberships and social_users are seeded with identities in the compare
 * tests, so any read of them would surface in the result or the read log.
 */
const fake = vi.hoisted(() => ({
  profiles: [] as Array<Record<string, unknown>>,
  profileSnapshots: [] as Array<Record<string, unknown>>,
  changeEvents: [] as Array<Record<string, unknown>>,
  memberships: [] as Array<Record<string, unknown>>,
  socialUsers: [] as Array<Record<string, unknown>>,
  reads: [] as string[],
}));

vi.mock("@/lib/db", async () => {
  const schema = await import("@/lib/db/schema");

  const nameOf = (table: unknown): string =>
    Object.keys(schema).find((key) => (schema as Record<string, unknown>)[key] === table) ?? "unknown";

  const rowsFor = (table: unknown): Array<Record<string, unknown>> => {
    if (table === schema.profiles) return fake.profiles;
    if (table === schema.profileSnapshots) return fake.profileSnapshots;
    if (table === schema.changeEvents) return fake.changeEvents;
    if (table === schema.memberships) return fake.memberships;
    if (table === schema.socialUsers) return fake.socialUsers;
    return [];
  };

  /** Awaitable like a drizzle select: where/orderBy return the query, limit caps the rows. */
  const selectQuery = (rows: Array<Record<string, unknown>>) => {
    let take = rows.length;
    const query = {
      innerJoin: () => query,
      leftJoin: () => query,
      where: () => query,
      orderBy: () => query,
      limit: (n: number) => {
        take = n;
        return query;
      },
      then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(rows.slice(0, take)).then(onFulfilled, onRejected),
    };
    return query;
  };

  return {
    getDb: () => ({
      select: () => ({
        from: (table: unknown) => {
          fake.reads.push(nameOf(table));
          return selectQuery(rowsFor(table));
        },
      }),
    }),
    isDbConfigured: () => true,
    schema,
  };
});

import { compareSnapshots, buildFollowerComparison, snapshotIdsInWindow } from "./compare";

const T1 = new Date("2026-01-01T00:00:00Z");
const T2 = new Date("2026-02-01T00:00:00Z");
const T3 = new Date("2026-03-01T00:00:00Z");

function snapshot(id: string, capturedAt: Date, followerCount: number, followingCount: number, postCount: number) {
  return { id, capturedAt, followerCount, followingCount, postCount };
}

describe("buildFollowerComparison", () => {
  const older = snapshot("s1", T1, 100, 10, 5);
  const newer = snapshot("s2", T2, 120, 7, 6);

  it("reports the follower count change when comparing followers", () => {
    const result = buildFollowerComparison("follower", older, newer, []);
    expect(result.kind).toBe("follower");
    expect(result.countChange).toBe(20);
  });

  it("reports the following count change when comparing following", () => {
    const result = buildFollowerComparison("following", older, newer, []);
    expect(result.countChange).toBe(-3);
  });

  it("returns only the count fields of each snapshot", () => {
    const result = buildFollowerComparison("follower", older, newer, []);
    expect(Object.keys(result).sort()).toEqual(["countChange", "fieldChanges", "from", "kind", "to"]);
    expect(Object.keys(result.from).sort()).toEqual(
      ["capturedAt", "followerCount", "followingCount", "id", "postCount"],
    );
    expect(result.from.capturedAt).toBe(T1.toISOString());
  });
});

describe("snapshotIdsInWindow", () => {
  const snapshots = [
    { id: "s1", capturedAt: T1 },
    { id: "s2", capturedAt: T2 },
    { id: "s3", capturedAt: T3 },
  ];

  it("includes captures after the older snapshot up to and including the newer one", () => {
    expect(snapshotIdsInWindow(snapshots, T1, T3)).toEqual(["s2", "s3"]);
  });

  it("is empty when both ends are the same snapshot", () => {
    expect(snapshotIdsInWindow(snapshots, T2, T2)).toEqual([]);
  });
});

describe("compareSnapshots (count-only)", () => {
  beforeEach(() => {
    fake.reads.length = 0;
    fake.profiles = [{ id: "p1", platform: "instagram", normalizedUsername: "nike" }];
    fake.profileSnapshots = [
      snapshot("s1", T1, 100, 10, 5),
      snapshot("s2", T2, 120, 12, 6),
      snapshot("s3", T3, 90, 12, 6),
    ];
    fake.changeEvents = [
      {
        id: "e1",
        profileId: "p1",
        toSnapshotId: "s2",
        field: "bio",
        oldValue: "old bio",
        newValue: "new bio",
        membershipEvent: null,
        membershipKind: null,
        socialUserId: null,
        detectedAt: T2,
      },
    ];
    // Identity rows exist in the database. A count-only compare must never read or return them.
    fake.memberships = [{ profileId: "p1", socialUserId: "u1", kind: "follower", firstSeenAt: T1, removedAt: null }];
    fake.socialUsers = [
      { id: "u1", platform: "instagram", username: "alice", displayName: "Alice", avatarUrl: "", isVerified: false },
    ];
  });

  it("returns counts and profile-field changes with no member identities", async () => {
    const result = await compareSnapshots("Nike", "follower", "s1", "s3");

    expect(result).toEqual({
      kind: "follower",
      from: { id: "s1", capturedAt: T1.toISOString(), followerCount: 100, followingCount: 10, postCount: 5 },
      to: { id: "s3", capturedAt: T3.toISOString(), followerCount: 90, followingCount: 12, postCount: 6 },
      countChange: -10,
      fieldChanges: [
        {
          field: "bio",
          oldValue: "old bio",
          newValue: "new bio",
          detectedAt: T2.toISOString(),
        },
      ],
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("alice");
    expect(serialized).not.toContain("newMembers");
    expect(serialized).not.toContain("removedMembers");
    expect(serialized).not.toContain("netChange");
  });

  it("never reads the memberships or social_users tables", async () => {
    await compareSnapshots("nike", "following", "s1", "s3");
    expect(fake.reads).not.toContain("memberships");
    expect(fake.reads).not.toContain("socialUsers");
  });

  it("computes the following change for the following dataset", async () => {
    const result = await compareSnapshots("nike", "following", "s1", "s3");
    expect(result?.countChange).toBe(2);
  });

  it("orders the snapshots older to newer whichever order they are passed in", async () => {
    const result = await compareSnapshots("nike", "follower", "s3", "s1");
    expect(result?.from.id).toBe("s1");
    expect(result?.to.id).toBe("s3");
    expect(result?.countChange).toBe(-10);
  });

  it("drops a change row that has no field, so no membership row can reach the result", async () => {
    fake.changeEvents.push({
      id: "e2",
      profileId: "p1",
      toSnapshotId: "s2",
      field: null,
      oldValue: null,
      newValue: null,
      membershipEvent: "added",
      membershipKind: "follower",
      socialUserId: "u1",
      detectedAt: T2,
    });

    const result = await compareSnapshots("nike", "follower", "s1", "s3");
    expect(result?.fieldChanges.map((change) => change.field)).toEqual(["bio"]);
  });

  it("returns null when a snapshot id does not belong to the profile", async () => {
    expect(await compareSnapshots("nike", "follower", "s1", "missing")).toBeNull();
  });

  it("returns null when the profile is unknown", async () => {
    fake.profiles = [];
    expect(await compareSnapshots("nobody", "follower", "s1", "s3")).toBeNull();
  });
});
