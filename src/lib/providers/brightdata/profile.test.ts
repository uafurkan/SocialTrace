import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  after: vi.fn(),
  trigger: vi.fn(),
  poll: vi.fn(),
  write: vi.fn(),
}));

vi.mock("next/server", () => ({ after: hoisted.after }));
vi.mock("./client", () => ({
  BrightDataError: class extends Error {},
  pollBrightDataSnapshot: hoisted.poll,
  triggerBrightDataDataset: hoisted.trigger,
}));
vi.mock("@/lib/cache/profile-cache", () => ({ writeCachedProfile: hoisted.write }));

import { warmBrightDataFacebookProfile, warmBrightDataInstagramProfile } from "./profile";

const FLAGS = ["BRIGHTDATA_WARM_INSTAGRAM", "BRIGHTDATA_WARM_FACEBOOK"] as const;

describe("Bright Data warm gating", () => {
  beforeEach(() => {
    hoisted.after.mockReset();
    for (const flag of FLAGS) delete process.env[flag];
  });

  afterEach(() => {
    for (const flag of FLAGS) delete process.env[flag];
  });

  it("does nothing for Instagram unless BRIGHTDATA_WARM_INSTAGRAM is set (default off)", () => {
    expect(warmBrightDataInstagramProfile("gated_ig_user")).toBeNull();
    expect(hoisted.after).not.toHaveBeenCalled();
  });

  it("does nothing for Facebook unless BRIGHTDATA_WARM_FACEBOOK is set (default off)", () => {
    expect(warmBrightDataFacebookProfile("gated_fb_page")).toBeNull();
    expect(hoisted.after).not.toHaveBeenCalled();
  });

  it("schedules an Instagram warm when the flag is 1", () => {
    process.env.BRIGHTDATA_WARM_INSTAGRAM = "1";
    expect(warmBrightDataInstagramProfile("enabled_ig_user")).toBeNull();
    expect(hoisted.after).toHaveBeenCalledTimes(1);
  });

  it("schedules a Facebook warm when the flag is true", () => {
    process.env.BRIGHTDATA_WARM_FACEBOOK = "true";
    expect(warmBrightDataFacebookProfile("enabled_fb_page")).toBeNull();
    expect(hoisted.after).toHaveBeenCalledTimes(1);
  });

  it("keeps the in-flight dedupe: a second warm for the same user while one is pending schedules nothing", () => {
    process.env.BRIGHTDATA_WARM_INSTAGRAM = "1";
    warmBrightDataInstagramProfile("dedupe_ig_user");
    warmBrightDataInstagramProfile("dedupe_ig_user");
    expect(hoisted.after).toHaveBeenCalledTimes(1);
  });
});
