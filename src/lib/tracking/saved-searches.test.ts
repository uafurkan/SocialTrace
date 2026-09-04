import { describe, expect, it } from "vitest";

import type { SocialUser } from "@/lib/domain/types";
import { matches } from "./saved-searches";

function user(username: string, displayName: string): SocialUser {
  return { id: username, platform: "instagram", username, displayName, avatarUrl: "", isVerified: false };
}

describe("matches", () => {
  it("matches a substring of the username, case-insensitively", () => {
    expect(matches(user("BrandOfficial", "Brand"), "brand")).toBe(true);
    expect(matches(user("brandofficial", "Something Else"), "OFFICIAL")).toBe(true);
  });

  it("matches a substring of the display name", () => {
    expect(matches(user("alex_92", "Alexandra Smith"), "alexandra")).toBe(true);
  });

  it("returns false when neither field contains the query", () => {
    expect(matches(user("nike", "Nike"), "adidas")).toBe(false);
  });
});
