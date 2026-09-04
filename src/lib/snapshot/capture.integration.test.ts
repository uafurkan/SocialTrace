import { afterAll, describe, expect, it } from "vitest";

import { isDbConfigured } from "@/lib/db";
import { captureSnapshot, listSnapshots } from "@/lib/snapshot/capture";
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
    // add a second snapshot row without erroring on the diff/upsert path.
    const second = await captureSnapshot(username);
    expect(second.id).not.toBe(first.id);
    expect(await listSnapshots(username)).toHaveLength(2);
  });

  it("throws ProfileNotFoundError for the mock provider's known-missing usernames", async () => {
    await expect(captureSnapshot("doesnotexist")).rejects.toBeInstanceOf(ProfileNotFoundError);
  });
});
