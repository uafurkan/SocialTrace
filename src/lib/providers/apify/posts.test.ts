import { describe, expect, it, vi } from "vitest";

const { withDataCache } = vi.hoisted(() => ({ withDataCache: vi.fn() }));

vi.mock("@/lib/cache/data-cache", () => ({ withDataCache }));
vi.mock("./client", () => ({ runApifyActor: vi.fn(async () => []) }));

import { fetchApifyPosts } from "./posts";

describe("fetchApifyPosts cache key", () => {
  it("caches the list under the posts:v2 namespace, never the pre-fix posts: prefix", async () => {
    withDataCache.mockImplementation(async (_key: string, fn: () => Promise<unknown>) => fn());

    await fetchApifyPosts("nike", "profile_nike");

    expect(withDataCache).toHaveBeenCalledWith("posts:v2:profile_nike", expect.any(Function));
    expect(withDataCache.mock.calls[0][0]).not.toMatch(/^posts:(?!v2:)/);
  });
});
