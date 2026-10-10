import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { apifyMediaHeaders, isAllowedApifyMediaUrl, isApifyMediaUrl } from "./apify-media";

const RECORD_URL = "https://api.apify.com/v2/key-value-stores/AbCdEf123456GhIjk/records/video.mp4";
const originalToken = process.env.APIFY_API_TOKEN;

describe("apify-media", () => {
  beforeEach(() => {
    process.env.APIFY_API_TOKEN = "test-token";
  });

  afterEach(() => {
    if (originalToken === undefined) delete process.env.APIFY_API_TOKEN;
    else process.env.APIFY_API_TOKEN = originalToken;
  });

  describe("apifyMediaHeaders", () => {
    it("attaches the Bearer token to a key-value-store record URL on api.apify.com", () => {
      expect(apifyMediaHeaders(RECORD_URL)).toEqual({ Authorization: "Bearer test-token" });
    });

    it("attaches nothing when APIFY_API_TOKEN is unset", () => {
      delete process.env.APIFY_API_TOKEN;
      expect(apifyMediaHeaders(RECORD_URL)).toEqual({});
    });

    it("attaches nothing to an api.apify.com API path that is not a record", () => {
      expect(apifyMediaHeaders("https://api.apify.com/v2/users/me")).toEqual({});
    });

    it("attaches nothing to other apify.com hosts, even with the record shape", () => {
      expect(apifyMediaHeaders("https://evil-apify.com/v2/key-value-stores/abc/records/video.mp4")).toEqual({});
      expect(apifyMediaHeaders("https://apify.com.evil.example/v2/key-value-stores/abc/records/video.mp4")).toEqual({});
      expect(apifyMediaHeaders("https://apify.com/v2/key-value-stores/abc/records/video.mp4")).toEqual({});
      expect(apifyMediaHeaders("https://console.apify.com/v2/key-value-stores/abc/records/video.mp4")).toEqual({});
    });

    it("attaches nothing over plain http, to a trailing-dot host, or to an unparseable string", () => {
      expect(apifyMediaHeaders(RECORD_URL.replace("https://", "http://"))).toEqual({});
      expect(apifyMediaHeaders(RECORD_URL.replace("api.apify.com/", "api.apify.com./"))).toEqual({});
      expect(apifyMediaHeaders("not a url")).toEqual({});
    });
  });

  describe("isAllowedApifyMediaUrl", () => {
    it.each([
      RECORD_URL,
      "https://api.apify.com/v2/key-value-stores/abc-DEF_123/records/video.mp4?disableRedirect=true",
      "https://api.apify.com/v2/key-value-stores/AbCdEf123456GhIjk/records/clip-name.mp4",
    ])("accepts %s", (url) => {
      expect(isAllowedApifyMediaUrl(url)).toBe(true);
    });

    it.each([
      "https://api.apify.com/v2/users/me",
      "https://api.apify.com/v2/key-value-stores/AbCdEf123456GhIjk",
      "https://api.apify.com/v2/key-value-stores/AbCdEf123456GhIjk/records/",
      "https://api.apify.com/v2/key-value-stores/AbCdEf123456GhIjk/records/video.mp4/extra",
      "https://api.apify.com/v2/datasets/abc/items",
      "https://api.apify.com/v2/key-value-stores//records/video.mp4",
      "https://api.apify.com/v2/key-value-stores/a%2Fb/records/video.mp4",
      "https://api.apify.com/v2/key-value-stores/AbCdEf123456GhIjk/records/a%2Fb",
      "https://api.apify.com/v2/key-value-stores/AbCdEf123456GhIjk/records/../../users/me",
      "http://api.apify.com/v2/key-value-stores/AbCdEf123456GhIjk/records/video.mp4",
      "https://api.apify.com./v2/key-value-stores/AbCdEf123456GhIjk/records/video.mp4",
      "https://evil-apify.com/v2/key-value-stores/AbCdEf123456GhIjk/records/video.mp4",
      "https://apify.com.evil.example/v2/key-value-stores/AbCdEf123456GhIjk/records/video.mp4",
      "https://apify.com/v2/key-value-stores/AbCdEf123456GhIjk/records/video.mp4",
      "https://example.com/video.mp4",
      "not a url",
      "",
    ])("rejects %s", (url) => {
      expect(isAllowedApifyMediaUrl(url)).toBe(false);
    });
  });

  describe("isApifyMediaUrl", () => {
    // Kept with its original host-level meaning for existing importers.
    it("still reports Apify-hosted at the host level", () => {
      expect(isApifyMediaUrl("https://api.apify.com/v2/users/me")).toBe(true);
      expect(isApifyMediaUrl("https://apify.com/")).toBe(true);
      expect(isApifyMediaUrl("https://evil-apify.com/")).toBe(false);
      expect(isApifyMediaUrl("https://apify.com.evil.example/")).toBe(false);
    });
  });
});
