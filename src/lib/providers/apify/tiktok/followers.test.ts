import { beforeEach, describe, expect, it, vi } from "vitest";

import { CHAIN_DEADLINE_MS } from "@/lib/cache/cold-budget";

const { runApifyActor } = vi.hoisted(() => ({ runApifyActor: vi.fn() }));

vi.mock("../client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../client")>()),
  runApifyActor,
}));

// The cache is not under test here; a miss always runs the actor.
vi.mock("@/lib/cache/data-cache", () => ({
  withDataCache: async (_key: string, fn: () => Promise<unknown>) => fn(),
}));

import { fetchApifyTikTokMembers } from "./followers";

describe("fetchApifyTikTokMembers", () => {
  beforeEach(() => {
    runApifyActor.mockReset();
    runApifyActor.mockResolvedValue([]);
  });

  it("bounds its one run's wait to the route budget, under the 60 s actor timeout", async () => {
    await fetchApifyTikTokMembers("someone", "followers", 200);

    expect(runApifyActor).toHaveBeenCalledTimes(1);
    expect(runApifyActor.mock.calls[0][2]).toEqual({ timeoutMs: CHAIN_DEADLINE_MS });
  });
});
