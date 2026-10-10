import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import type { Post } from "@/lib/domain/types";

import { buildArchive, collectPostMedia, extensionForMime } from "./archive";

function post(overrides: Partial<Post> & Pick<Post, "id">): Post {
  return {
    profileId: "p1",
    mediaType: "image",
    thumbnailUrl: "",
    mediaUrl: `https://cdn.example/${overrides.id}.jpg`,
    permalink: "",
    caption: "",
    likeCount: 0,
    commentCount: 0,
    viewCount: null,
    postedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function fakeBlob(bytes: number[], type: string): Blob {
  return new Blob([new Uint8Array(bytes)], { type });
}

describe("extensionForMime", () => {
  it("maps known image and video types", () => {
    expect(extensionForMime("video/mp4")).toBe("mp4");
    expect(extensionForMime("image/png")).toBe("png");
    expect(extensionForMime("image/webp")).toBe("webp");
    expect(extensionForMime("image/gif")).toBe("gif");
  });

  it("falls back to jpg for anything else", () => {
    expect(extensionForMime("image/jpeg")).toBe("jpg");
    expect(extensionForMime("")).toBe("jpg");
  });
});

describe("buildArchive", () => {
  it("round-trips entry names and bytes", () => {
    const zip = buildArchive([
      { name: "001-a.jpg", data: new Uint8Array([1, 2, 3]) },
      { name: "002-b.mp4", data: new Uint8Array([9, 8]) },
    ]);
    const files = unzipSync(zip);
    expect(Object.keys(files).sort()).toEqual(["001-a.jpg", "002-b.mp4"]);
    expect(Array.from(files["001-a.jpg"])).toEqual([1, 2, 3]);
    expect(Array.from(files["002-b.mp4"])).toEqual([9, 8]);
  });
});

describe("collectPostMedia", () => {
  it("names entries by display order and skips posts without media", async () => {
    const posts = [post({ id: "first" }), post({ id: "no-media", mediaUrl: "" }), post({ id: "third" })];
    const fetched: string[] = [];
    const result = await collectPostMedia(posts, async (url) => {
      fetched.push(url);
      return fakeBlob([1], "image/jpeg");
    });

    expect(fetched).toEqual(["https://cdn.example/first.jpg", "https://cdn.example/third.jpg"]);
    expect(result.entries.map((entry) => entry.name)).toEqual(["001-first.jpg", "003-third.jpg"]);
    expect(result.skipped).toBe(1);
    expect(result.truncated).toBe(false);
  });

  it("counts a failed fetch as skipped and keeps going", async () => {
    const posts = [post({ id: "ok" }), post({ id: "broken" }), post({ id: "ok2" })];
    const result = await collectPostMedia(posts, async (url) => {
      if (url.includes("broken")) throw new Error("upstream 502");
      return fakeBlob([7], "image/jpeg");
    });
    expect(result.entries.map((entry) => entry.name)).toEqual(["001-ok.jpg", "003-ok2.jpg"]);
    expect(result.skipped).toBe(1);
  });

  it("stops at the size budget and reports truncation", async () => {
    const posts = [post({ id: "a" }), post({ id: "b" }), post({ id: "c" })];
    const result = await collectPostMedia(posts, async () => fakeBlob([1, 2, 3, 4], "video/mp4"), { budgetBytes: 10 });
    expect(result.entries).toHaveLength(2);
    expect(result.truncated).toBe(true);
  });

  it("reports progress for every post, including the final tick", async () => {
    const ticks: Array<[number, number]> = [];
    await collectPostMedia([post({ id: "a" }), post({ id: "b" })], async () => fakeBlob([1], "image/png"), {
      onProgress: (done, total) => ticks.push([done, total]),
    });
    expect(ticks[ticks.length - 1]).toEqual([2, 2]);
  });
});
