import { describe, expect, it } from "vitest";

import type { SocialUser } from "@/lib/domain/types";
import { diffActiveMembers, evaluateCoverageGate } from "./compare";

function user(id: string, username: string): SocialUser {
  return { id, platform: "instagram", username, displayName: username, avatarUrl: "", isVerified: false };
}

describe("evaluateCoverageGate", () => {
  it("is available when both sides meet the threshold", () => {
    expect(evaluateCoverageGate("follower", 99.5, 100)).toEqual({ available: true, reason: null });
  });

  it("is unavailable when the older snapshot is below threshold", () => {
    const result = evaluateCoverageGate("follower", 42, 100);
    expect(result.available).toBe(false);
    expect(result.reason).toMatch(/99\.5% follower coverage/);
  });

  it("is unavailable when the newer snapshot is below threshold", () => {
    const result = evaluateCoverageGate("following", 100, 80);
    expect(result.available).toBe(false);
    expect(result.reason).toMatch(/99\.5% following coverage/);
  });

  it("mentions the correct kind in the reason", () => {
    expect(evaluateCoverageGate("following", 10, 10).reason).toContain("following");
  });
});

describe("diffActiveMembers", () => {
  it("finds no changes when both sides are identical", () => {
    const older = new Map([["1", user("1", "alice")]]);
    const newer = new Map([["1", user("1", "alice")]]);
    expect(diffActiveMembers(older, newer)).toEqual({ newMembers: [], removedMembers: [], netChange: 0 });
  });

  it("detects a new member", () => {
    const older = new Map([["1", user("1", "alice")]]);
    const newer = new Map([
      ["1", user("1", "alice")],
      ["2", user("2", "bob")],
    ]);
    const result = diffActiveMembers(older, newer);
    expect(result.newMembers.map((u) => u.username)).toEqual(["bob"]);
    expect(result.removedMembers).toEqual([]);
    expect(result.netChange).toBe(1);
  });

  it("detects a removed member", () => {
    const older = new Map([
      ["1", user("1", "alice")],
      ["2", user("2", "bob")],
    ]);
    const newer = new Map([["1", user("1", "alice")]]);
    const result = diffActiveMembers(older, newer);
    expect(result.removedMembers.map((u) => u.username)).toEqual(["bob"]);
    expect(result.newMembers).toEqual([]);
    expect(result.netChange).toBe(-1);
  });

  it("nets out simultaneous gains and losses", () => {
    const older = new Map([["1", user("1", "alice")]]);
    const newer = new Map([
      ["2", user("2", "bob")],
      ["3", user("3", "carol")],
    ]);
    const result = diffActiveMembers(older, newer);
    expect(result.newMembers.map((u) => u.username).sort()).toEqual(["bob", "carol"]);
    expect(result.removedMembers.map((u) => u.username)).toEqual(["alice"]);
    expect(result.netChange).toBe(1);
  });
});
