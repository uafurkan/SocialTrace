import { afterEach, describe, expect, it, vi } from "vitest";

import { toCommentCsv, toLikerCsv } from "@/lib/export/serialize";

import { downloadCsv, engagementCsvFilename, postKeyFromPermalink } from "./engagement-csv";

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

  it("uses the post id for the name when one is given, even if the permalink has no usable segment", () => {
    expect(
      engagementCsvFilename("facebook", "https://www.facebook.com/permalink.php?story_fbid=1&id=2", "likers", "123456789"),
    ).toBe("socialtrace-facebook-123456789-likers.csv");
  });

  it("prefers the post id over the permalink segment", () => {
    expect(engagementCsvFilename("instagram", "https://www.instagram.com/p/ABC123/", "comments", "3000001")).toBe(
      "socialtrace-instagram-3000001-comments.csv",
    );
  });

  it("falls back to the permalink when the post id is absent or blank", () => {
    expect(engagementCsvFilename("instagram", "https://www.instagram.com/p/ABC123/", "likers", undefined)).toBe(
      "socialtrace-instagram-ABC123-likers.csv",
    );
    expect(engagementCsvFilename("instagram", "https://www.instagram.com/p/ABC123/", "likers", "   ")).toBe(
      "socialtrace-instagram-ABC123-likers.csv",
    );
  });

  it("keeps the post fallback for a Facebook permalink.php link with no post id", () => {
    expect(engagementCsvFilename("facebook", "https://www.facebook.com/permalink.php?story_fbid=1&id=2", "comments")).toBe(
      "socialtrace-facebook-post-comments.csv",
    );
  });
});

describe("downloadCsv", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  /** Decodes the file as UTF-8 but keeps a leading byte-order mark, which Blob.text() would strip. */
  async function csvText(blob: Blob): Promise<string> {
    return new TextDecoder("utf-8", { ignoreBOM: true }).decode(await blob.arrayBuffer());
  }

  /** Runs downloadCsv with a stubbed DOM and returns the Blob it handed to the browser. */
  function captureDownload(filename: string, csv: string): Blob {
    const created: Blob[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob: Blob | MediaSource) => {
      created.push(blob as Blob);
      return "blob:socialtrace-test";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const link = { href: "", download: "", click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal("document", { createElement: () => link, body: { appendChild: () => link } });
    vi.stubGlobal("window", { setTimeout: vi.fn() });

    downloadCsv(filename, csv);

    expect(created).toHaveLength(1);
    expect(link.download).toBe(filename);
    expect(link.click).toHaveBeenCalledOnce();
    return created[0];
  }

  it("writes the UTF-8 byte-order mark before the CSV text", async () => {
    const blob = captureDownload("socialtrace-instagram-ABC123-likers.csv", "username,display_name,verified\nnike,Nike,yes");

    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(await csvText(blob)).toBe("\uFEFFusername,display_name,verified\nnike,Nike,yes");
    expect(blob.type).toBe("text/csv;charset=utf-8");
  });

  it("keeps non-ASCII text intact after the mark", async () => {
    const blob = captureDownload("socialtrace-instagram-ABC123-comments.csv", toCommentCsv([{
      id: "c-1",
      authorUsername: "istanbul",
      authorAvatarUrl: "",
      authorIsVerified: false,
      text: "Güzel çalışma 東京",
      likeCount: 1,
      postedAt: null,
    }]));

    expect(await csvText(blob)).toBe("\uFEFFauthor_username,text,like_count,posted_at\nistanbul,Güzel çalışma 東京,1,");
  });

  it("keeps the formula guard on the first data cell after the mark", async () => {
    const blob = captureDownload("socialtrace-instagram-ABC123-likers.csv", toLikerCsv([
      { username: "=HYPERLINK(\"https://evil.example\")", displayName: "Eve", avatarUrl: "", isVerified: false, isPrivate: false },
    ]));

    const lines = (await csvText(blob)).split("\n");
    expect(lines[0]).toBe("\uFEFFusername,display_name,verified");
    expect(lines[1]).toBe("\"'=HYPERLINK(\"\"https://evil.example\"\")\",Eve,no");
  });
});
