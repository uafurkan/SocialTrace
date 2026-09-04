import { describe, expect, it } from "vitest";

import { extractUsername } from "./profile-link";

describe("extractUsername", () => {
  it("accepts a bare username", () => {
    expect(extractUsername("nike")).toBe("nike");
  });

  it("strips a leading @", () => {
    expect(extractUsername("@nike")).toBe("nike");
  });

  it("trims surrounding whitespace", () => {
    expect(extractUsername("  nike  ")).toBe("nike");
  });

  it("accepts a full https profile URL with trailing slash", () => {
    expect(extractUsername("https://www.instagram.com/smallcreator/")).toBe("smallcreator");
  });

  it("accepts a bare domain without a protocol", () => {
    expect(extractUsername("instagram.com/tinytest")).toBe("tinytest");
  });

  it("accepts a URL without the www subdomain", () => {
    expect(extractUsername("https://instagram.com/nike")).toBe("nike");
  });

  it("rejects non-profile Instagram paths", () => {
    expect(extractUsername("instagram.com/p/abc123")).toBeNull();
    expect(extractUsername("instagram.com/reel/xyz")).toBeNull();
    expect(extractUsername("instagram.com/explore/tags/travel")).toBeNull();
  });

  it("rejects links to a different host", () => {
    expect(extractUsername("https://twitter.com/nike")).toBeNull();
  });

  it("rejects empty or invalid input", () => {
    expect(extractUsername("")).toBeNull();
    expect(extractUsername("   ")).toBeNull();
    expect(extractUsername("this has spaces")).toBeNull();
  });

  it("rejects a username that is too long", () => {
    expect(extractUsername("a".repeat(31))).toBeNull();
  });
});
