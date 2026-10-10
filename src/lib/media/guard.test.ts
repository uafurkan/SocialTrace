import { describe, expect, it } from "vitest";

import {
  MAX_MEDIA_BYTES,
  MAX_REDIRECTS,
  PayloadTooLargeError,
  classifyVideoUrl,
  createByteCounter,
  createCappedStream,
  declaredLengthExceeds,
  isAllowedVideoHost,
  isPrivateAddress,
  isRedirectStatus,
  readCappedBody,
  redirectLimitReached,
  resolveRedirectLocation,
  videoProxyMode,
} from "./guard";

/** A source that produces `count` chunks of `size` bytes, then closes. Tracks whether it was cancelled. */
function chunkedSource(count: number, size: number) {
  let produced = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (produced >= count) {
        controller.close();
        return;
      }
      produced += 1;
      controller.enqueue(new Uint8Array(size).fill(produced));
    },
    cancel() {
      cancelled = true;
    },
  });
  return { stream, wasCancelled: () => cancelled };
}

describe("isAllowedVideoHost", () => {
  it("accepts each allowlisted domain exactly", () => {
    for (const host of [
      "cdninstagram.com",
      "fbcdn.net",
      "tiktokcdn.com",
      "tiktokcdn-us.com",
      "tiktokv.com",
      "muscdn.com",
      "licdn.com",
      "picsum.photos",
    ]) {
      expect(isAllowedVideoHost(host), host).toBe(true);
    }
  });

  it("accepts subdomains of an allowlisted domain", () => {
    expect(isAllowedVideoHost("scontent-dfw5-1.cdninstagram.com")).toBe(true);
    expect(isAllowedVideoHost("instagram.ffra1-1.fna.fbcdn.net")).toBe(true);
    expect(isAllowedVideoHost("v16m.tiktokcdn.com")).toBe(true);
  });

  it("ignores case and a single trailing dot", () => {
    expect(isAllowedVideoHost("CDNINSTAGRAM.COM")).toBe(true);
    expect(isAllowedVideoHost("cdninstagram.com.")).toBe(true);
  });

  it("rejects lookalike hosts that only share a suffix or contain a domain", () => {
    expect(isAllowedVideoHost("evilcdninstagram.com")).toBe(false);
    expect(isAllowedVideoHost("cdninstagram.com.evil.net")).toBe(false);
    expect(isAllowedVideoHost("notfbcdn.net")).toBe(false);
    expect(isAllowedVideoHost("fbcdn.net.evil.com")).toBe(false);
    expect(isAllowedVideoHost("cdninstagram.com-evil.net")).toBe(false);
  });

  it("rejects hosts that are not on the list", () => {
    expect(isAllowedVideoHost("example.com")).toBe(false);
    expect(isAllowedVideoHost("api.apify.com")).toBe(false);
    expect(isAllowedVideoHost("localhost")).toBe(false);
    expect(isAllowedVideoHost("169.254.169.254")).toBe(false);
  });
});

describe("isPrivateAddress", () => {
  it.each([
    "localhost",
    "LOCALHOST",
    "localhost.",
    "app.localhost",
    "127.0.0.1",
    "127.255.255.254",
    "10.0.0.1",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.0.10",
    "169.254.169.254",
    "0.0.0.0",
    "[::1]",
    "::1",
    "[::]",
    "::",
    "[::ffff:7f00:1]",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "[::ffff:10.0.0.1]",
    "fd00::1",
    "[fc00::1]",
    "fe80::1",
    "[febf::1]",
    "0x7f000001",
    "2130706433",
    "0177.0.0.1",
    "127.1",
    "0x7f.1",
    "2852039166",
    "0xa9fea9fe",
    "0x0a000001",
  ])("treats %s as private", (host) => {
    expect(isPrivateAddress(host)).toBe(true);
  });

  it.each([
    "example.com",
    "cdninstagram.com",
    "scontent-dfw5-1.cdninstagram.com",
    "8.8.8.8",
    "1.1.1.1",
    "172.32.0.1",
    "172.15.255.255",
    "192.169.0.1",
    "2001:4860:4860::8888",
    "2606:4700:4700::1111",
    "::ffff:8.8.8.8",
    "[::ffff:808:808]",
    "::8.8.8.8",
  ])("treats %s as public", (host) => {
    expect(isPrivateAddress(host)).toBe(false);
  });

  it("fails closed on malformed IPv6 text and an empty host", () => {
    expect(isPrivateAddress("[::1")).toBe(true);
    expect(isPrivateAddress("1::2::3")).toBe(true);
    expect(isPrivateAddress("")).toBe(true);
  });

  it("recognises the hostnames WHATWG URL produces for the same addresses", () => {
    // URL.hostname keeps IPv6 brackets and rewrites IPv4 forms to dotted
    // decimal, so the guard must handle both shapes.
    for (const input of [
      "https://[::1]/",
      "https://[::ffff:127.0.0.1]/",
      "https://0x7f000001/",
      "https://2130706433/",
      "https://0177.0.0.1/",
      "https://[fe80::1]/",
      "https://[fd00::1]/",
      "https://169.254.169.254/",
    ]) {
      expect(isPrivateAddress(new URL(input).hostname), input).toBe(true);
    }
    expect(isPrivateAddress(new URL("https://example.com/").hostname)).toBe(false);
  });
});

describe("classifyVideoUrl", () => {
  it("allows an allowlisted https URL", () => {
    expect(classifyVideoUrl(new URL("https://scontent.cdninstagram.com/v/a.mp4"))).toEqual({ kind: "allowed" });
  });

  it("always blocks non-https URLs", () => {
    expect(classifyVideoUrl(new URL("http://scontent.cdninstagram.com/v/a.mp4"))).toEqual({
      kind: "blocked",
      reason: "not-https",
    });
  });

  it("always blocks private addresses, including normalized forms", () => {
    expect(classifyVideoUrl(new URL("https://127.0.0.1/a.mp4"))).toEqual({
      kind: "blocked",
      reason: "private-address",
    });
    expect(classifyVideoUrl(new URL("https://[::1]/a.mp4"))).toEqual({
      kind: "blocked",
      reason: "private-address",
    });
    expect(classifyVideoUrl(new URL("https://0x7f000001/"))).toEqual({
      kind: "blocked",
      reason: "private-address",
    });
    expect(classifyVideoUrl(new URL("https://169.254.169.254/latest/meta-data"))).toEqual({
      kind: "blocked",
      reason: "private-address",
    });
  });

  it("reports an allowlist miss as would-block, not blocked", () => {
    expect(classifyVideoUrl(new URL("https://evilcdninstagram.com/a.mp4"))).toEqual({
      kind: "would-block",
      reason: "host-not-allowlisted",
    });
    expect(classifyVideoUrl(new URL("https://example.com/a.mp4"))).toEqual({
      kind: "would-block",
      reason: "host-not-allowlisted",
    });
  });
});

describe("videoProxyMode", () => {
  it("defaults to log for unset, empty and unknown values", () => {
    expect(videoProxyMode(undefined)).toBe("log");
    expect(videoProxyMode("")).toBe("log");
    expect(videoProxyMode("log")).toBe("log");
    expect(videoProxyMode("enforced")).toBe("log");
    expect(videoProxyMode("0")).toBe("log");
  });

  it("enforces only on the exact word, ignoring case and spaces", () => {
    expect(videoProxyMode("enforce")).toBe("enforce");
    expect(videoProxyMode(" ENFORCE ")).toBe("enforce");
  });
});

describe("redirect helpers", () => {
  it("allows three redirects", () => {
    expect(MAX_REDIRECTS).toBe(3);
  });

  it("recognises the redirect statuses that carry a Location header", () => {
    for (const status of [301, 302, 303, 307, 308]) {
      expect(isRedirectStatus(status), String(status)).toBe(true);
    }
    for (const status of [200, 206, 300, 304, 400, 500]) {
      expect(isRedirectStatus(status), String(status)).toBe(false);
    }
  });

  it("resolves relative and absolute Location values against the sending URL", () => {
    const base = new URL("https://scontent.cdninstagram.com/a/b.mp4");
    expect(resolveRedirectLocation("/next.mp4", base)?.href).toBe("https://scontent.cdninstagram.com/next.mp4");
    expect(resolveRedirectLocation("https://fbcdn.net/x.mp4", base)?.href).toBe("https://fbcdn.net/x.mp4");
  });

  it("returns null for a missing or unparseable Location", () => {
    const base = new URL("https://scontent.cdninstagram.com/a/b.mp4");
    expect(resolveRedirectLocation(null, base)).toBeNull();
    expect(resolveRedirectLocation("", base)).toBeNull();
    expect(resolveRedirectLocation("http://[", base)).toBeNull();
  });

  it("refuses a redirect once MAX_REDIRECTS have been followed", () => {
    expect(redirectLimitReached(0)).toBe(false);
    expect(redirectLimitReached(MAX_REDIRECTS - 1)).toBe(false);
    expect(redirectLimitReached(MAX_REDIRECTS)).toBe(true);
    expect(redirectLimitReached(MAX_REDIRECTS + 1)).toBe(true);
  });

  it("follows at most three hops of a redirect chain", () => {
    // Mirrors the route loop: check the limit before following each redirect.
    const followChain = (redirectResponses: number) => {
      let followed = 0;
      for (let i = 0; i < redirectResponses; i++) {
        if (redirectLimitReached(followed)) return { followed, refused: true };
        followed += 1;
      }
      return { followed, refused: false };
    };
    expect(followChain(0)).toEqual({ followed: 0, refused: false });
    expect(followChain(3)).toEqual({ followed: 3, refused: false });
    expect(followChain(4)).toEqual({ followed: 3, refused: true });
  });
});

describe("byte caps", () => {
  it("uses a 100 MB cap", () => {
    expect(MAX_MEDIA_BYTES).toBe(100 * 1024 * 1024);
  });

  it("the byte counter allows the cap exactly and throws one byte past it", () => {
    const counter = createByteCounter(10);
    counter.add(4);
    counter.add(6);
    expect(counter.total).toBe(10);
    expect(() => counter.add(1)).toThrow(PayloadTooLargeError);
  });

  it("checks a declared Content-Length against the cap", () => {
    expect(declaredLengthExceeds(null, MAX_MEDIA_BYTES)).toBe(false);
    expect(declaredLengthExceeds("", MAX_MEDIA_BYTES)).toBe(false);
    expect(declaredLengthExceeds("abc", MAX_MEDIA_BYTES)).toBe(false);
    expect(declaredLengthExceeds("-1", MAX_MEDIA_BYTES)).toBe(false);
    expect(declaredLengthExceeds(String(MAX_MEDIA_BYTES), MAX_MEDIA_BYTES)).toBe(false);
    expect(declaredLengthExceeds(String(MAX_MEDIA_BYTES + 1), MAX_MEDIA_BYTES)).toBe(true);
    expect(declaredLengthExceeds("99999999999999999999999", MAX_MEDIA_BYTES)).toBe(true);
  });

  it("readCappedBody joins chunks that stay under the cap", async () => {
    const { stream } = chunkedSource(3, 4);
    const bytes = await readCappedBody(stream, 12);
    expect(bytes.byteLength).toBe(12);
    expect(Array.from(new Uint8Array(bytes))).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3]);
  });

  it("readCappedBody aborts past the cap and cancels the upstream source", async () => {
    const source = chunkedSource(10, 4);
    await expect(readCappedBody(source.stream, 10)).rejects.toBeInstanceOf(PayloadTooLargeError);
    expect(source.wasCancelled()).toBe(true);
  });

  it("createCappedStream relays a body under the cap and signals settlement once", async () => {
    const source = chunkedSource(3, 4);
    let settledCount = 0;
    const reader = createCappedStream(source.stream, 12, () => {
      settledCount += 1;
    }).getReader();

    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
    }
    expect(total).toBe(12);
    expect(settledCount).toBe(1);
  });

  it("createCappedStream errors past the cap, cancels the source and signals settlement once", async () => {
    const source = chunkedSource(10, 4);
    let settledCount = 0;
    const reader = createCappedStream(source.stream, 10, () => {
      settledCount += 1;
    }).getReader();

    // Two 4-byte chunks (8 bytes) pass; the third would reach 12 bytes.
    await reader.read();
    await reader.read();
    await expect(reader.read()).rejects.toBeInstanceOf(PayloadTooLargeError);
    expect(source.wasCancelled()).toBe(true);
    expect(settledCount).toBe(1);
  });
});
