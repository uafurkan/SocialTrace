import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { getDb, isDbConfigured, schema } from "@/lib/db";
import { captureSnapshot, listSnapshots, normalizeUsername } from "@/lib/snapshot/capture";
import { ProfileNotFoundError } from "@/lib/providers";
import { deleteTestProfiles, uniqueUsername } from "@/lib/db/test-helpers";

describe.skipIf(!isDbConfigured())("captureSnapshot (integration)", () => {
  const usernames: string[] = [];

  afterAll(async () => {
    await deleteTestProfiles(usernames);
  });

  it("captures a real snapshot against the mock provider and persists it", async () => {
    const username = uniqueUsername("capture");
    usernames.push(username);

    const first = await captureSnapshot(username);
    expect(first.followerCount).toBeGreaterThan(0);

    const snapshots = await listSnapshots(username);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].id).toBe(first.id);

    // A second capture of the same (deterministic, mock) profile should
    // add a second snapshot row without erroring on the upsert path.
    const second = await captureSnapshot(username);
    expect(second.id).not.toBe(first.id);
    expect(await listSnapshots(username)).toHaveLength(2);
  });

  it("stores no follower or following membership for the captured profile", async () => {
    const username = uniqueUsername("capture-members");
    usernames.push(username);

    const captured = await captureSnapshot(username);
    expect(captured.indexedFollowerCount).toBe(0);
    expect(captured.indexedFollowingCount).toBe(0);

    const [profileRow] = await getDb()
      .select({ id: schema.profiles.id })
      .from(schema.profiles)
      .where(eq(schema.profiles.normalizedUsername, normalizeUsername(username)))
      .limit(1);
    const memberships = await getDb()
      .select()
      .from(schema.memberships)
      .where(eq(schema.memberships.profileId, profileRow.id));
    expect(memberships).toHaveLength(0);
  });

  it("throws ProfileNotFoundError for the mock provider's known-missing usernames", async () => {
    await expect(captureSnapshot("doesnotexist")).rejects.toBeInstanceOf(ProfileNotFoundError);
  });
});
