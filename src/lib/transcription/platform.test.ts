import { describe, expect, it } from "vitest";

import { detectPlatform, normalizeVideoUrl } from "./platform";

describe("normalizeVideoUrl", () => {
  it("gives two different YouTube videos different cache keys", () => {
    // Regression test: normalizeVideoUrl used to strip the entire query
    // string, but a YouTube watch URL's video ID lives only in `?v=`, not
    // the path — so every watch?v=... URL collapsed to the same cache key
    // and a second video was served the first video's cached transcript.
    const a = normalizeVideoUrl("https://www.youtube.com/watch?v=jNQXAC9IVRw", "youtube");
    const b = normalizeVideoUrl("https://www.youtube.com/watch?v=O-KDKBCPrwA", "youtube");
    expect(a).not.toBe(b);
  });

  it("gives the same YouTube video the same cache key across tracking-param variants", () => {
    const a = normalizeVideoUrl("https://www.youtube.com/watch?v=jNQXAC9IVRw", "youtube");
    const b = normalizeVideoUrl("https://www.youtube.com/watch?v=jNQXAC9IVRw&si=abc123&t=42", "youtube");
    expect(a).toBe(b);
  });

  it("gives two different Facebook watch?v= links different cache keys", () => {
    const a = normalizeVideoUrl("https://www.facebook.com/watch/?v=111111111", "facebook");
    const b = normalizeVideoUrl("https://www.facebook.com/watch/?v=222222222", "facebook");
    expect(a).not.toBe(b);
  });

  it("preserves case in path-based video IDs (Instagram shortcodes, TikTok/Facebook path IDs are case-sensitive)", () => {
    const upper = normalizeVideoUrl("https://www.instagram.com/reel/C0hQSaMpD97/", "instagram");
    const lower = normalizeVideoUrl("https://www.instagram.com/reel/c0hqsampd97/", "instagram");
    expect(upper).not.toBe(lower);
  });

  it("still normalizes hostname case and trailing slashes", () => {
    const a = normalizeVideoUrl("https://WWW.TikTok.com/@user/video/123/", "tiktok");
    const b = normalizeVideoUrl("https://www.tiktok.com/@user/video/123", "tiktok");
    expect(a).toBe(b);
  });
});

describe("detectPlatform", () => {
  it("recognizes each supported platform", () => {
    expect(detectPlatform("https://www.youtube.com/watch?v=abc")).toBe("youtube");
    expect(detectPlatform("https://youtu.be/abc")).toBe("youtube");
    expect(detectPlatform("https://www.tiktok.com/@user/video/1")).toBe("tiktok");
    expect(detectPlatform("https://www.instagram.com/reel/abc/")).toBe("instagram");
    expect(detectPlatform("https://www.facebook.com/watch/?v=1")).toBe("facebook");
    expect(detectPlatform("https://fb.watch/abc/")).toBe("facebook");
  });

  it("rejects unsupported hosts and garbage input", () => {
    expect(detectPlatform("https://vimeo.com/123")).toBeNull();
    expect(detectPlatform("not a url")).toBeNull();
  });
});
