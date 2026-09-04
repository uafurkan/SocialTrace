import { afterAll, describe, expect, it } from "vitest";

import { isDbConfigured } from "@/lib/db";
import { isProfileTracked, listTrackedProfiles, trackProfile, untrackProfile } from "@/lib/tracking/watchlist";
import { createSavedSearch, deleteSavedSearch, listSavedSearches } from "@/lib/tracking/saved-searches";
import { PlanLimitError } from "@/lib/billing/plans";
import { deleteTestProfiles, uniqueUsername } from "@/lib/db/test-helpers";

describe.skipIf(!isDbConfigured())("tracking (integration)", () => {
  const visitorId = uniqueUsername("visitor");
  const usernames: string[] = [];

  afterAll(async () => {
    await deleteTestProfiles(usernames);
  });

  it("tracks a real (mock-provider) profile end to end", async () => {
    const username = uniqueUsername("track");
    usernames.push(username);

    expect(await isProfileTracked(username, visitorId)).toBe(false);

    await trackProfile(username, visitorId);
    expect(await isProfileTracked(username, visitorId)).toBe(true);

    const tracked = await listTrackedProfiles(visitorId);
    expect(tracked.some((p) => p.username === username)).toBe(true);

    await untrackProfile(username, visitorId);
    expect(await isProfileTracked(username, visitorId)).toBe(false);
  });

  it("re-tracking an already-tracked profile at the plan limit doesn't throw (no-op insert)", async () => {
    const username = uniqueUsername("retrack");
    usernames.push(username);

    await trackProfile(username, visitorId, "free");
    // Already tracked, so this must skip the limit check entirely rather
    // than counting this row against itself — see docs/BILLING.md.
    await expect(trackProfile(username, visitorId, "free")).resolves.toBeUndefined();
  });

  it("enforces the free plan's tracked-profile limit for a new profile", async () => {
    const limitVisitor = uniqueUsername("limit-visitor");
    const atLimitUsernames: string[] = [];
    for (let i = 0; i < 10; i++) {
      const username = uniqueUsername(`limit${i}`);
      atLimitUsernames.push(username);
      usernames.push(username);
      await trackProfile(username, limitVisitor, "free");
    }

    const overLimitUsername = uniqueUsername("over-limit");
    usernames.push(overLimitUsername);
    await expect(trackProfile(overLimitUsername, limitVisitor, "free")).rejects.toBeInstanceOf(PlanLimitError);
  });

  it("saves a search and lists it as unavailable before two snapshots exist", async () => {
    const username = uniqueUsername("savedsearch");
    usernames.push(username);

    await createSavedSearch(username, "follower", "a", visitorId);
    const searches = await listSavedSearches(visitorId);
    const saved = searches.find((s) => s.username === username);
    expect(saved).toBeDefined();
    expect(saved?.available).toBe(false);

    if (saved) {
      await deleteSavedSearch(saved.id, visitorId);
    }
    const afterDelete = await listSavedSearches(visitorId);
    expect(afterDelete.some((s) => s.username === username)).toBe(false);
  });
});
