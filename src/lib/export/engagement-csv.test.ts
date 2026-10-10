import { describe, expect, it } from "vitest";

import { engagementCsvFilename, postKeyFromPermalink } from "./engagement-csv";

describe("postKeyFromPermalink", () => {
  it("returns the Instagram shortcode from a post permalink", () => {
    expect(postKeyFromPermalink("https://www.instagram.com/p/ABC123/")).toBe("ABC123");
  });

  it("returns the shortcode from a reel permalink", () => {
    expect(postKeyFromPermalink("https://www.instagram.com/reel/XYZ_-9/")).toBe("XYZ_-9");
  });

  it("returns the video id from a TikTok permalink", () => {
    expect(postKeyFromPermalink("https://www.tiktok.com/@nike/video/7300000000000000000")).toBe("7300000000000000000");
  });

  it("returns the post id from a Facebook permalink", () => {
    expect(postKeyFromPermalink("https://www.facebook.com/nike/posts/123456")).toBe("123456");
  });

  it("falls back to post for a permalink.php link with no usable segment", () => {
    expect(postKeyFromPermalink("https://www.facebook.com/permalink.php?story_fbid=1&id=2")).toBe("post");
  });

  it("falls back to post when there is no path segment", () => {
    expect(postKeyFromPermalink("https://www.instagram.com/")).toBe("post");
  });

  it("falls back to post when the permalink is not a URL", () => {
    expect(postKeyFromPermalink("not a url")).toBe("post");
  });
});

describe("engagementCsvFilename", () => {
  it("builds platform, post key, and list kind into a csv name", () => {
    expect(engagementCsvFilename("instagram", "https://www.instagram.com/p/ABC123/", "likers")).toBe(
      "socialtrace-instagram-ABC123-likers.csv",
    );
  });

  it("uses the comments kind for the comments list", () => {
    expect(engagementCsvFilename("tiktok", "https://www.tiktok.com/@nike/video/42", "comments")).toBe(
      "socialtrace-tiktok-42-comments.csv",
    );
  });

  it("sanitizes characters outside the safe set", () => {
    expect(engagementCsvFilename("instagram", "https://www.instagram.com/p/a%20b/", "likers")).toBe(
      "socialtrace-instagram-a_20b-likers.csv",
    );
  });
});
