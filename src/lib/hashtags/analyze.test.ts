import { describe, expect, it } from "vitest";

import { countHashtags } from "./analyze";

describe("countHashtags", () => {
  it("counts a tag once per caption even when it repeats inside the caption", () => {
    const result = countHashtags([{ caption: "#fit #fit #Fit #FIT" }]);

    expect(result.tags).toEqual([{ tag: "#fit", count: 1 }]);
    expect(result.postsWithHashtags).toBe(1);
  });

  it("adds one count per caption that contains the tag", () => {
    const result = countHashtags([{ caption: "#fit #gym" }, { caption: "#fit" }, { caption: "#gym #gym" }]);

    expect(result.tags).toEqual([
      { tag: "#fit", count: 2 },
      { tag: "#gym", count: 2 },
    ]);
  });

  it("folds case when matching but keeps the first-seen spelling", () => {
    const result = countHashtags([{ caption: "#Fitness" }, { caption: "#fitness" }, { caption: "#FITNESS" }]);

    expect(result.tags).toEqual([{ tag: "#Fitness", count: 3 }]);
  });

  it("uses whichever spelling appears first in the input order", () => {
    expect(countHashtags([{ caption: "#gym" }, { caption: "#Gym" }]).tags).toEqual([{ tag: "#gym", count: 2 }]);
    expect(countHashtags([{ caption: "#Gym" }, { caption: "#gym" }]).tags).toEqual([{ tag: "#Gym", count: 2 }]);
  });

  it("matches Unicode letters, including non-Latin scripts", () => {
    const result = countHashtags([{ caption: "#güzel #東京" }, { caption: "#GÜZEL" }]);

    expect(result.tags).toEqual([
      { tag: "#güzel", count: 2 },
      { tag: "#東京", count: 1 },
    ]);
  });

  it("treats a decomposed accent as part of the tag", () => {
    // "e" followed by U+0301 (combining acute) must read as "café", not "cafe".
    const result = countHashtags([{ caption: "#café" }, { caption: "#café" }]);

    expect(result.tags).toEqual([{ tag: "#café", count: 2 }]);
  });

  it("ignores a lone # and a # with no letters or digits after it", () => {
    const result = countHashtags([{ caption: "# and #! and #. and #" }]);

    expect(result.tags).toEqual([]);
    expect(result.postsWithHashtags).toBe(0);
  });

  it("keeps underscores inside a tag and ignores underscore-only bodies", () => {
    const result = countHashtags([{ caption: "#gym_life #_ #___ #__1" }]);

    expect(result.tags.map((entry) => entry.tag)).toEqual(["#__1", "#gym_life"]);
  });

  it("ends a tag at punctuation and hyphens", () => {
    const result = countHashtags([{ caption: "#fit! #gym.#yoga #well-being" }]);

    expect(result.tags.map((entry) => entry.tag)).toEqual(["#fit", "#gym", "#well", "#yoga"]);
  });

  it("reads the second # of a double hash as the start of the tag", () => {
    expect(countHashtags([{ caption: "##fit" }]).tags).toEqual([{ tag: "#fit", count: 1 }]);
  });

  it("handles empty and whitespace-only captions without counting them as tagged", () => {
    const result = countHashtags([{ caption: "" }, { caption: "   " }, { caption: "#fit" }]);

    expect(result).toEqual({
      tags: [{ tag: "#fit", count: 1 }],
      postsWithHashtags: 1,
      totalPosts: 3,
    });
  });

  it("returns an empty summary for no posts", () => {
    expect(countHashtags([])).toEqual({ tags: [], postsWithHashtags: 0, totalPosts: 0 });
  });

  it("sorts by count descending, then tag ascending", () => {
    const result = countHashtags([
      { caption: "#beta #zeta #mid" },
      { caption: "#alpha #zeta" },
      { caption: "#beta #alpha" },
      { caption: "#zeta" },
    ]);

    expect(result.tags).toEqual([
      { tag: "#zeta", count: 3 },
      { tag: "#alpha", count: 2 },
      { tag: "#beta", count: 2 },
      { tag: "#mid", count: 1 },
    ]);
  });

  it("breaks count ties by case-insensitive tag order", () => {
    const result = countHashtags([{ caption: "#Zebra #apple" }]);

    expect(result.tags.map((entry) => entry.tag)).toEqual(["#apple", "#Zebra"]);
  });

  it("caps the result at 20 tags by default", () => {
    // Post i (0-based) holds #t1 .. #t(25 - i), so #tN appears in 26 - N posts.
    const posts = Array.from({ length: 25 }, (_, i) => ({
      caption: Array.from({ length: 25 - i }, (_, j) => `#t${j + 1}`).join(" "),
    }));

    const result = countHashtags(posts);

    expect(result.tags).toHaveLength(20);
    expect(result.tags[0]).toEqual({ tag: "#t1", count: 25 });
    expect(result.tags[19]).toEqual({ tag: "#t20", count: 6 });
    expect(result.totalPosts).toBe(25);
    expect(result.postsWithHashtags).toBe(25);
  });

  it("honours an explicit topN without changing the post totals", () => {
    const posts = [{ caption: "#a #b #c #d" }, { caption: "#a #b #c" }, { caption: "#a #b" }, { caption: "no tags" }];

    const result = countHashtags(posts, 2);

    expect(result.tags).toEqual([
      { tag: "#a", count: 3 },
      { tag: "#b", count: 3 },
    ]);
    expect(result.postsWithHashtags).toBe(3);
    expect(result.totalPosts).toBe(4);
  });

  it("returns no tags when topN is zero", () => {
    expect(countHashtags([{ caption: "#fit" }], 0).tags).toEqual([]);
  });
});
