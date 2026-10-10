import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Platform, Profile } from "@/lib/domain/types";
import { ProfileNotFoundError } from "@/lib/providers/types";

import { NOT_FOUND_TTL_MS, PROFILE_CACHE_TTL_MS, getCachedProfile } from "./profile-cache";

/**
 * In-memory stand-in for the `profile_cache` table and the provider registry,
 * so the real getCachedProfile runs against them. Only the calls that
 * profile-cache.ts makes are implemented.
 */
const state = vi.hoisted(() => {
  interface Row {
    platform: string;
    normalizedUsername: string;
    data: unknown;
    fetchedAt: Date;
  }
  return {
    rows: [] as Row[],
    configured: true,
    failWrites: false,
    providers: {} as Record<string, { getProfile: ReturnType<typeof vi.fn> }>,
  };
});

vi.mock("drizzle-orm", () => ({
  eq: (column: unknown, value: unknown) => ({ column, value }),
}));

vi.mock("@/lib/db", () => {
  const db = {
    select: () => ({
      from: () => ({
        where: async (condition: { value: string }) =>
          state.rows.filter((row) => row.normalizedUsername === condition.value).map((row) => ({ ...row })),
      }),
    }),
    insert: () => ({
      values: (values: { platform: string; normalizedUsername: string; data: unknown; fetchedAt: Date }) => ({
        onConflictDoUpdate: async ({ set }: { set: { data: unknown; fetchedAt: Date } }) => {
          if (state.failWrites) throw new Error("database unavailable");
          const existing = state.rows.find(
            (row) => row.platform === values.platform && row.normalizedUsername === values.normalizedUsername,
          );
          if (existing) {
            existing.data = set.data;
            existing.fetchedAt = set.fetchedAt;
          } else {
            state.rows.push({ ...values });
          }
        },
      }),
    }),
  };
  return {
    isDbConfigured: () => state.configured,
    getDb: () => db,
    schema: {
      profileCache: { platform: "platform", normalizedUsername: "normalizedUsername" },
    },
  };
});

vi.mock("@/lib/providers", () => ({
  getProvider: (platform: Platform) => state.providers[platform],
}));

function profileFor(username: string): Profile {
  return {
    id: `id_${username}`,
    externalId: null,
    platform: "instagram",
    username,
    displayName: username,
    bio: "",
    avatarUrl: "",
    isVerified: false,
    isPrivate: false,
    followerCount: 10,
    followingCount: 5,
    postCount: 3,
  } as Profile;
}

function notFoundProvider() {
  return vi.fn(async (username: string) => {
    throw new ProfileNotFoundError(username);
  });
}

function rowFor(platform: string, username: string) {
  return state.rows.find((row) => row.platform === platform && row.normalizedUsername === username);
}

beforeEach(() => {
  state.rows.length = 0;
  state.configured = true;
  state.failWrites = false;
  state.providers = {
    instagram: { getProfile: vi.fn(async (username: string) => ({ profile: profileFor(username) })) },
    tiktok: { getProfile: vi.fn(async (username: string) => ({ profile: profileFor(username) })) },
    facebook: { getProfile: vi.fn(async (username: string) => ({ profile: profileFor(username) })) },
  };
});

describe("getCachedProfile negative cache", () => {
  it("stores a not-found marker when the provider says the profile does not exist", async () => {
    state.providers.instagram.getProfile = notFoundProvider();

    await expect(getCachedProfile("ghost_account")).rejects.toBeInstanceOf(ProfileNotFoundError);

    expect(rowFor("instagram", "ghost_account")?.data).toEqual({ notFound: true });
  });

  it("answers the next lookup inside the hour with not-found, without calling the provider", async () => {
    const getProfile = notFoundProvider();
    state.providers.instagram.getProfile = getProfile;

    await expect(getCachedProfile("ghost_account")).rejects.toBeInstanceOf(ProfileNotFoundError);
    await expect(getCachedProfile("ghost_account")).rejects.toBeInstanceOf(ProfileNotFoundError);

    expect(getProfile).toHaveBeenCalledTimes(1);
  });

  it("matches the marker case-insensitively, the same way profiles are keyed", async () => {
    const getProfile = notFoundProvider();
    state.providers.instagram.getProfile = getProfile;

    await expect(getCachedProfile("Ghost_Account")).rejects.toBeInstanceOf(ProfileNotFoundError);
    await expect(getCachedProfile("  ghost_account ")).rejects.toBeInstanceOf(ProfileNotFoundError);

    expect(getProfile).toHaveBeenCalledTimes(1);
  });

  it("asks the provider again once the marker is older than one hour", async () => {
    const getProfile = vi.fn(async (username: string) => ({ profile: profileFor(username) }));
    state.providers.instagram.getProfile = getProfile;
    state.rows.push({
      platform: "instagram",
      normalizedUsername: "new_account",
      data: { notFound: true },
      fetchedAt: new Date(Date.now() - NOT_FOUND_TTL_MS - 1_000),
    });

    const { profile } = await getCachedProfile("new_account");

    expect(profile.username).toBe("new_account");
    expect(getProfile).toHaveBeenCalledTimes(1);
    expect(rowFor("instagram", "new_account")?.data).toEqual(profileFor("new_account"));
  });

  it("does not return an expired marker as stale data when the provider now fails transiently", async () => {
    state.providers.instagram.getProfile = vi.fn(async () => {
      throw new Error("upstream timeout");
    });
    state.rows.push({
      platform: "instagram",
      normalizedUsername: "new_account",
      data: { notFound: true },
      fetchedAt: new Date(Date.now() - NOT_FOUND_TTL_MS - 1_000),
    });

    await expect(getCachedProfile("new_account")).rejects.toThrow("upstream timeout");
  });

  it("stores nothing for a transient error", async () => {
    state.providers.instagram.getProfile = vi.fn(async () => {
      throw new Error("upstream timeout");
    });

    await expect(getCachedProfile("some_account")).rejects.toThrow("upstream timeout");

    expect(state.rows).toHaveLength(0);
  });

  it("keeps the marker per platform, so a missing TikTok handle does not hide the Instagram one", async () => {
    state.providers.tiktok.getProfile = notFoundProvider();

    await expect(getCachedProfile("shared_name", "tiktok")).rejects.toBeInstanceOf(ProfileNotFoundError);

    expect(rowFor("tiktok", "shared_name")?.data).toEqual({ notFound: true });
    const { profile } = await getCachedProfile("shared_name", "instagram");
    expect(profile.username).toBe("shared_name");
    expect(state.providers.instagram.getProfile).toHaveBeenCalledTimes(1);
  });

  it("stores markers for every platform, not only Instagram", async () => {
    state.providers.facebook.getProfile = notFoundProvider();

    await expect(getCachedProfile("gone_page", "facebook")).rejects.toBeInstanceOf(ProfileNotFoundError);
    await expect(getCachedProfile("gone_page", "facebook")).rejects.toBeInstanceOf(ProfileNotFoundError);

    expect(rowFor("facebook", "gone_page")?.data).toEqual({ notFound: true });
    expect(state.providers.facebook.getProfile).toHaveBeenCalledTimes(1);
  });

  it("still throws not-found when the marker write itself fails", async () => {
    state.providers.instagram.getProfile = notFoundProvider();
    state.failWrites = true;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(getCachedProfile("ghost_account")).rejects.toBeInstanceOf(ProfileNotFoundError);

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("does not mistake a stored profile for a marker, and serves it inside the profile TTL", async () => {
    state.rows.push({
      platform: "instagram",
      normalizedUsername: "real_account",
      data: profileFor("real_account"),
      fetchedAt: new Date(Date.now() - PROFILE_CACHE_TTL_MS + 60_000),
    });

    const { profile } = await getCachedProfile("real_account");

    expect(profile.username).toBe("real_account");
    expect(state.providers.instagram.getProfile).not.toHaveBeenCalled();
  });

  it("without a database calls the provider every time and stores no marker", async () => {
    state.configured = false;
    const getProfile = notFoundProvider();
    state.providers.instagram.getProfile = getProfile;

    await expect(getCachedProfile("ghost_account")).rejects.toBeInstanceOf(ProfileNotFoundError);
    await expect(getCachedProfile("ghost_account")).rejects.toBeInstanceOf(ProfileNotFoundError);

    expect(getProfile).toHaveBeenCalledTimes(2);
    expect(state.rows).toHaveLength(0);
  });
});
