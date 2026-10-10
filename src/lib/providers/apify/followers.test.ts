import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { runApifyActor } = vi.hoisted(() => ({ runApifyActor: vi.fn() }));

vi.mock("./client", () => ({ runApifyActor }));

// The cache is not under test here; a miss always runs the chain.
vi.mock("@/lib/cache/data-cache", () => ({
  withDataCache: async (_key: string, fn: () => Promise<unknown>) => fn(),
}));

import { fetchMembers } from "./followers";

const usableItem = [{ userId: "1", username: "alice", fullName: "Alice", profilePicUrl: "", isVerified: false }];

describe("fetchMembers (Instagram chain)", () => {
  beforeEach(() => {
    runApifyActor.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns the first usable actor's list and starts no further actors", async () => {
    runApifyActor.mockResolvedValueOnce(usableItem);

    const members = await fetchMembers("someone", "followers", 60);

    expect(members.map((m) => m.username)).toEqual(["alice"]);
    expect(runApifyActor).toHaveBeenCalledTimes(1);
  });

  it("returns an empty list when every actor finishes within the limit", async () => {
    runApifyActor.mockResolvedValue([]);

    await expect(fetchMembers("someone", "followers", 60)).resolves.toEqual([]);
    expect(runApifyActor).toHaveBeenCalledTimes(5);
  });

  it("starts no further actor after 45 s and throws, so an empty guess is not cached", async () => {
    // The first actor answers with nothing usable, but only after 46 s.
    runApifyActor.mockImplementationOnce(async () => {
      vi.setSystemTime(Date.now() + 46_000);
      return [];
    });

    await expect(fetchMembers("someone", "followers", 60)).rejects.toThrow(/45s limit/);
    expect(runApifyActor).toHaveBeenCalledTimes(1);
  });
});
