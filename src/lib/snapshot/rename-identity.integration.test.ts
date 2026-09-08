import { afterAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";

import type { CoverageStatus, Profile } from "@/lib/domain/types";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { fetchExistingProfileRow, normalizeUsername, upsertProfileRow } from "@/lib/snapshot/capture";
import { deleteTestProfiles, uniqueUsername } from "@/lib/db/test-helpers";

const ZERO_COVERAGE: CoverageStatus = {
  status: "unavailable",
  coveragePercent: 0,
  indexedCount: 0,
  totalCount: 0,
  lastCheckedAt: new Date().toISOString(),
};

function testProfile(overrides: Partial<Profile>): Profile {
  return {
    id: "profile_test",
    externalId: null,
    platform: "instagram",
    username: "test",
    displayName: "Test",
    bio: "",
    avatarUrl: "",
    isVerified: false,
    isPrivate: false,
    followerCount: 0,
    followingCount: 0,
    postCount: 0,
    followerCoverage: ZERO_COVERAGE,
    followingCoverage: ZERO_COVERAGE,
    ...overrides,
  };
}

/**
 * Phase 4 (tool-expansion plan): a rename must be detected as a change to
 * an existing profile row, not mistaken for a brand-new profile — see
 * docs/DECISIONS.md for why externalId exists and why the lookup order is
 * externalId-first with a username fallback.
 */
describe.skipIf(!isDbConfigured())("stable profile identity (externalId)", () => {
  const usernames: string[] = [];

  afterAll(async () => {
    await deleteTestProfiles(usernames);
  });

  it("updates the same row in place when externalId matches but username changed", async () => {
    const db = getDb();
    const oldUsername = uniqueUsername("rename_old");
    const newUsername = uniqueUsername("rename_new");
    usernames.push(oldUsername, newUsername);
    const externalId = `ext_${oldUsername}`;

    const [inserted] = await db
      .insert(schema.profiles)
      .values({
        platform: "instagram",
        username: oldUsername,
        normalizedUsername: normalizeUsername(oldUsername),
        externalId,
        displayName: "Alice",
        bio: "",
        avatarUrl: "",
      })
      .returning();

    const found = await fetchExistingProfileRow(db, "instagram", normalizeUsername(newUsername), externalId);
    expect(found?.id).toBe(inserted.id);

    const updated = await upsertProfileRow(
      db,
      testProfile({ externalId, username: newUsername, displayName: "Bob" }),
      found?.id,
    );
    expect(updated.id).toBe(inserted.id);
    expect(updated.username).toBe(newUsername);

    const rows = await db
      .select()
      .from(schema.profiles)
      .where(and(eq(schema.profiles.platform, "instagram"), eq(schema.profiles.externalId, externalId)));
    expect(rows).toHaveLength(1);
    expect(rows[0].username).toBe(newUsername);
  });

  it("falls back to the username match for pre-migration rows with a null externalId", async () => {
    const db = getDb();
    const username = uniqueUsername("legacy_row");
    usernames.push(username);

    const [inserted] = await db
      .insert(schema.profiles)
      .values({
        platform: "instagram",
        username,
        normalizedUsername: normalizeUsername(username),
        externalId: null,
        displayName: "Legacy",
        bio: "",
        avatarUrl: "",
      })
      .returning();

    const newExternalId = `ext_${username}`;
    const found = await fetchExistingProfileRow(db, "instagram", normalizeUsername(username), newExternalId);
    expect(found?.id).toBe(inserted.id);

    const updated = await upsertProfileRow(
      db,
      testProfile({ externalId: newExternalId, username, displayName: "Legacy" }),
      found?.id,
    );
    expect(updated.id).toBe(inserted.id);
    expect(updated.externalId).toBe(newExternalId);

    const rows = await db.select().from(schema.profiles).where(eq(schema.profiles.normalizedUsername, normalizeUsername(username)));
    expect(rows).toHaveLength(1);
  });
});
