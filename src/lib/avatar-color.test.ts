import { describe, expect, it } from "vitest";

import { avatarInitials, avatarPaletteIndex } from "./avatar-color";

describe("avatarPaletteIndex", () => {
  it("is deterministic for the same input", () => {
    expect(avatarPaletteIndex("nike")).toBe(avatarPaletteIndex("nike"));
  });

  it("stays within the 1-6 palette range", () => {
    const usernames = ["nike", "smallcreator", "tinytest", "a", "zzzzzzzzzzzzzzzzzz", ""];
    for (const username of usernames) {
      const index = avatarPaletteIndex(username);
      expect(index).toBeGreaterThanOrEqual(1);
      expect(index).toBeLessThanOrEqual(6);
    }
  });

  it("distinguishes at least some different usernames", () => {
    const indices = new Set(["nike", "smallcreator", "tinytest", "ahmet", "mehmet", "ayse"].map(avatarPaletteIndex));
    expect(indices.size).toBeGreaterThan(1);
  });
});

describe("avatarInitials", () => {
  it("uses the first two characters of a single-word username", () => {
    expect(avatarInitials("nike")).toBe("NI");
  });

  it("prefers the first letter of each word in a multi-word display name", () => {
    expect(avatarInitials("smallcreator", "Small Creator")).toBe("SC");
  });

  it("falls back to the username when display name is empty", () => {
    expect(avatarInitials("tinytest", "")).toBe("TI");
  });
});
