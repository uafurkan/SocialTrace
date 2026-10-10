import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * In-memory stand-in for the tables listChanges reads. Reads ignore their
 * WHERE clause, so the change rows seeded here include a membership row
 * left by an earlier capture. listChanges must drop it, and must never read
 * social_users to name anyone.
 */
const fake = vi.hoisted(() => ({
  profiles: [] as Array<Record<string, unknown>>,
  changeEvents: [] as Array<Record<string, unknown>>,
  reads: [] as string[],
}));

vi.mock("@/lib/db", async () => {
  const schema = await import("@/lib/db/schema");

  const nameOf = (table: unknown): string =>
    Object.keys(schema).find((key) => (schema as Record<string, unknown>)[key] === table) ?? "unknown";

  const rowsFor = (table: unknown): Array<Record<string, unknown>> => {
    if (table === schema.profiles) return fake.profiles;
    if (table === schema.changeEvents) return fake.changeEvents;
    return [];
  };

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

import { listChanges, toFieldChangeEvent } from "./changes";

const DETECTED = new Date("2026-02-01T12:00:00Z");

describe("toFieldChangeEvent", () => {
  it("maps a profile-field row to a change with no membership or user fields", () => {
    expect(
      toFieldChangeEvent({ id: "e1", detectedAt: DETECTED, field: "bio", oldValue: "a", newValue: "b" }),
    ).toEqual({
      id: "e1",
      detectedAt: DETECTED.toISOString(),
      membershipEvent: null,
      membershipKind: null,
      user: null,
      field: "bio",
      oldValue: "a",
      newValue: "b",
    });
  });

  it("returns null for a row with no field, which is a membership row", () => {
    expect(toFieldChangeEvent({ id: "e2", detectedAt: DETECTED, field: null, oldValue: null, newValue: null })).toBeNull();
  });
});

describe("listChanges", () => {
  beforeEach(() => {
    fake.reads.length = 0;
    fake.profiles = [{ id: "p1", platform: "instagram", normalizedUsername: "nike" }];
    fake.changeEvents = [
      { id: "e1", detectedAt: DETECTED, field: "displayName", oldValue: "Nike", newValue: "Nike Inc", socialUserId: null },
      {
        id: "e2",
        detectedAt: DETECTED,
        field: null,
        oldValue: null,
        newValue: null,
        membershipEvent: "removed",
        membershipKind: "follower",
        socialUserId: "u1",
      },
    ];
  });

  it("returns only profile-field changes, with no member identity", async () => {
    const changes = await listChanges("Nike");

    expect(changes).toEqual([
      {
        id: "e1",
        detectedAt: DETECTED.toISOString(),
        membershipEvent: null,
        membershipKind: null,
        user: null,
        field: "displayName",
        oldValue: "Nike",
        newValue: "Nike Inc",
      },
    ]);
  });

  it("never reads the social_users table", async () => {
    await listChanges("nike");
    expect(fake.reads).not.toContain("socialUsers");
    expect(fake.reads).not.toContain("memberships");
  });

  it("returns an empty list for an unknown profile", async () => {
    fake.profiles = [];
    expect(await listChanges("nobody")).toEqual([]);
  });
});
