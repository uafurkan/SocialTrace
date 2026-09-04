import { afterAll, describe, expect, it } from "vitest";

import { isDbConfigured } from "@/lib/db";
import { runScheduledCapture } from "@/lib/snapshot/scheduled-capture";
import { trackProfile } from "@/lib/tracking/watchlist";
import { createSavedSearch } from "@/lib/tracking/saved-searches";
import { listSnapshots } from "@/lib/snapshot/capture";
import { deleteTestProfiles, uniqueUsername } from "@/lib/db/test-helpers";

/**
 * Regression coverage for the real drizzle-orm bug found and fixed in
 * this same slice (docs/DECISIONS.md): `saved_searches inner join
 * profiles` silently returned zero rows through the query builder while
 * `watchlist_entries inner join profiles` (identical shape) did not.
 * `listProfilesNeedingCapture` now reads both via raw `db.execute(sql\`...\`)`
 * — this test would have caught that bug (the saved-search-only profile
 * simply wouldn't appear in `attempted`).
 */
describe.skipIf(!isDbConfigured())("runScheduledCapture (integration)", () => {
  const usernames: string[] = [];

  afterAll(async () => {
    await deleteTestProfiles(usernames);
  });

  it("captures both a tracked-only profile and a saved-search-only profile", async () => {
    const visitorId = uniqueUsername("scheduler-visitor");
    const trackedUsername = uniqueUsername("sched-tracked");
    const searchedUsername = uniqueUsername("sched-searched");
    usernames.push(trackedUsername, searchedUsername);

    await trackProfile(trackedUsername, visitorId);
    await createSavedSearch(searchedUsername, "follower", "a", visitorId);

    const result = await runScheduledCapture(50);

    expect(result.attempted).toEqual(expect.arrayContaining([trackedUsername, searchedUsername]));
    expect(result.succeeded).toEqual(expect.arrayContaining([trackedUsername, searchedUsername]));
    expect(result.failed).toEqual([]);

    expect(await listSnapshots(trackedUsername)).toHaveLength(1);
    expect(await listSnapshots(searchedUsername)).toHaveLength(1);
  });

  it("does not duplicate a profile that is both tracked and saved-searched", async () => {
    const visitorId = uniqueUsername("scheduler-visitor-dup");
    const username = uniqueUsername("sched-both");
    usernames.push(username);

    await trackProfile(username, visitorId);
    await createSavedSearch(username, "follower", "a", visitorId);

    const result = await runScheduledCapture(50);
    expect(result.attempted.filter((u) => u === username)).toHaveLength(1);
  });
});
