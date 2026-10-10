import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { checkAllPlatforms, checkPlatform, isValidHandle } from "./check";

const fetchMock = vi.fn();

function reply(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Instagram and Facebook", () => {
  it("never report a handle as available, and make no outbound request", async () => {
    const instagram = await checkPlatform("instagram", "dinememento");
    const facebook = await checkPlatform("facebook", "someonecool");

    expect(instagram).toMatchObject({ status: "unknown", reason: "no_official_source" });
    expect(facebook).toMatchObject({ status: "unknown", reason: "no_official_source" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("TikTok (oEmbed profile URL)", () => {
  it("reports taken when the profile answers 200", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { type: "rich" }));

    expect(await checkPlatform("tiktok", "scout2015")).toMatchObject({ status: "taken" });
    expect(String(fetchMock.mock.calls[0][0])).toContain("https://www.tiktok.com/oembed?url=");
  });

  it("treats a 400 as inconclusive, never as available", async () => {
    fetchMock.mockResolvedValueOnce(reply(400, { code: 400 }));

    expect(await checkPlatform("tiktok", "zzqxv_no_such_user")).toMatchObject({
      status: "unknown",
      reason: "inconclusive",
    });
  });

  it("treats a network failure as inconclusive", async () => {
    fetchMock.mockRejectedValueOnce(new Error("socket hang up"));

    expect(await checkPlatform("tiktok", "anyhandle")).toMatchObject({ status: "unknown", reason: "inconclusive" });
  });
});

describe("YouTube with a Data API key", () => {
  beforeEach(() => {
    vi.stubEnv("YOUTUBE_API_KEY", "test-key-value");
  });

  it("reports available when channels.list returns no items", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { pageInfo: { totalResults: 0 }, items: [] }));

    expect(await checkPlatform("youtube", "free_handle_123")).toMatchObject({ status: "available" });
  });

  it("reports taken when channels.list returns an item", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { items: [{ id: "UC123" }] }));

    expect(await checkPlatform("youtube", "taken_handle")).toMatchObject({ status: "taken" });
  });

  it("sends the key in a header, never in the URL", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { items: [] }));

    await checkPlatform("youtube", "free_handle_123");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain("test-key-value");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key-value");
  });

  it("treats quota errors and unexpected shapes as inconclusive", async () => {
    fetchMock.mockResolvedValueOnce(reply(403, { error: { message: "quotaExceeded" } }));
    expect(await checkPlatform("youtube", "handle_one")).toMatchObject({ status: "unknown", reason: "inconclusive" });

    fetchMock.mockResolvedValueOnce(reply(200, { kind: "youtube#channelListResponse" }));
    expect(await checkPlatform("youtube", "handle_two")).toMatchObject({ status: "unknown", reason: "inconclusive" });
  });
});

describe("YouTube without a key (page status fallback)", () => {
  it("reports available on 404 and taken on 200", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 404 }));
    expect(await checkPlatform("youtube", "free_handle_123")).toMatchObject({ status: "available" });

    fetchMock.mockResolvedValueOnce(new Response("<html></html>", { status: 200 }));
    expect(await checkPlatform("youtube", "taken_handle")).toMatchObject({ status: "taken" });
  });

  it("sends no API key header", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 404 }));

    await checkPlatform("youtube", "free_handle_123");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBeUndefined();
  });
});

describe("checkAllPlatforms", () => {
  it("returns one result per platform, and a crashed checker becomes inconclusive", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const results = await checkAllPlatforms("handle_xyz");

    expect(results.map((result) => result.platform).sort()).toEqual(["facebook", "instagram", "tiktok", "youtube"]);
    for (const result of results) {
      expect(result.status).not.toBe("available");
    }
  });
});

describe("isValidHandle", () => {
  it("applies each platform's own character rule", () => {
    expect(isValidHandle("instagram", "dine.memento_1")).toBe(true);
    expect(isValidHandle("instagram", "has space")).toBe(false);
    expect(isValidHandle("youtube", "ab")).toBe(false);
  });
});
