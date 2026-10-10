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
  isReservedIpAddress,
  readCappedBody,
  redirectLimitReached,
  resolveHostAddresses,
  resolveRedirectLocation,
  videoProxyMode,
  type HostLookup,
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
    "[fec0::1]",
    "100.64.0.1",
    "224.0.0.1",
    "ff02::1",
    "::8.8.8.8",
    "[::8.8.8.8]",
    "64:ff9b::808:808",
    "[64:ff9b:1::1]",
    "[2002:808:808::1]",
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
    "100.128.0.1",
    "223.255.255.255",
    "2001:4860:4860::8888",
    "2606:4700:4700::1111",
    "::ffff:8.8.8.8",
    "[::ffff:808:808]",
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

describe("isReservedIpAddress", () => {
  // Each range with the last address before it, its first and last address,
  // and the first address after it. IPv4-mapped IPv6 uses the embedded IPv4.
  it.each<[string, boolean]>([
    ["0.0.0.0", true],
    ["0.255.255.255", true],
    ["1.0.0.0", false],
    ["9.255.255.255", false],
    ["10.0.0.0", true],
    ["10.255.255.255", true],
    ["11.0.0.0", false],
    ["100.63.255.255", false],
    ["100.64.0.0", true],
    ["100.127.255.255", true],
    ["100.128.0.0", false],
    ["126.255.255.255", false],
    ["127.0.0.0", true],
    ["127.255.255.255", true],
    ["128.0.0.0", false],
    ["169.253.255.255", false],
    ["169.254.0.0", true],
    ["169.254.255.255", true],
    ["169.255.0.0", false],
    ["172.15.255.255", false],
    ["172.16.0.0", true],
    ["172.31.255.255", true],
    ["172.32.0.0", false],
    ["192.167.255.255", false],
    ["192.168.0.0", true],
    ["192.168.255.255", true],
    ["192.169.0.0", false],
    ["223.255.255.255", false],
    ["224.0.0.0", true],
    ["239.255.255.255", true],
    ["240.0.0.0", true],
    ["255.255.255.255", true],
    ["8.8.8.8", false],
    ["1.1.1.1", false],
    ["::", true],
    ["::1", true],
    ["fbff::1", false],
    ["fc00::", true],
    ["fdff:ffff::1", true],
    ["fe7f::1", false],
    ["fe80::", true],
    ["febf::1", true],
    // fec0::/10 site-local runs to feff, so the last address before ff00 is reserved.
    ["fec0::", true],
    ["feff:ffff::1", true],
    ["ff00::", true],
    ["ff02::1", true],
    ["fe80::1%eth0", true],
    // IPv4-compatible ::/96 (deprecated) is reserved whatever address it embeds.
    ["::8.8.8.8", true],
    ["::0.0.0.1", true],
    // NAT64 well-known prefix 64:ff9b::/96 and local-use 64:ff9b:1::/48.
    ["64:ff9b::", true],
    ["64:ff9b::808:808", true],
    ["64:ff9b:0:1::", false],
    ["64:ff9b:1::", true],
    ["64:ff9b:1:ffff:ffff:ffff:ffff:ffff", true],
    ["64:ff9b:2::", false],
    // 6to4 2002::/16.
    ["2002::", true],
    ["2002:808:808::1", true],
    ["2002:ffff:ffff:ffff:ffff:ffff:ffff:ffff", true],
    ["2001:ffff::", false],
    ["2003::", false],
    ["::ffff:126.255.255.255", false],
    ["::ffff:127.0.0.0", true],
    ["::ffff:127.255.255.255", true],
    ["::ffff:7f00:1", true],
    ["::ffff:10.0.0.1", true],
    ["::ffff:100.64.0.1", true],
    ["::ffff:169.254.169.254", true],
    ["::ffff:172.15.255.255", false],
    ["::ffff:172.16.0.1", true],
    ["::ffff:192.168.1.1", true],
    ["::ffff:224.0.0.1", true],
    ["::ffff:8.8.8.8", false],
    ["::ffff:808:808", false],
    ["[::ffff:127.0.0.1]", true],
    // Text that is not an IP address fails closed.
    ["not-an-ip", true],
  ])("%s -> reserved %s", (address, reserved) => {
    expect(isReservedIpAddress(address)).toBe(reserved);
  });
});

describe("resolveHostAddresses", () => {
  /** A lookup that answers with `addresses` and records every call. */
  function fakeLookup(addresses: string[]) {
    const calls: Array<{ hostname: string; options: unknown }> = [];
    const lookup: HostLookup = async (hostname, options) => {
      calls.push({ hostname, options });
      return addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));
    };
    return { lookup, calls };
  }

  it("resolves a name once with every answer, in verbatim order", async () => {
    const { lookup, calls } = fakeLookup(["93.184.216.34", "10.0.0.7"]);
    expect(await resolveHostAddresses("Example.COM.", { lookup })).toEqual({
      kind: "addresses",
      addresses: [
        { address: "93.184.216.34", family: 4 },
        { address: "10.0.0.7", family: 4 },
      ],
    });
    expect(calls).toEqual([{ hostname: "example.com", options: { all: true, verbatim: true } }]);
  });

  it("returns a public IP literal as its own answer, without a lookup", async () => {
    const { lookup, calls } = fakeLookup(["93.184.216.34"]);
    expect(await resolveHostAddresses("8.8.8.8", { lookup })).toEqual({
      kind: "addresses",
      addresses: [{ address: "8.8.8.8", family: 4 }],
    });
    expect(await resolveHostAddresses("[2606:4700:4700::1111]", { lookup })).toEqual({
      kind: "addresses",
      addresses: [{ address: "2606:4700:4700::1111", family: 6 }],
    });
    expect(calls).toEqual([]);
  });

  it("returns private for localhost and private literals without a lookup", async () => {
    const { lookup, calls } = fakeLookup(["93.184.216.34"]);
    for (const host of [
      "localhost",
      "app.localhost",
      "127.0.0.1",
      "[::1]",
      "[::1",
      "169.254.169.254",
      "100.64.0.1",
      "[fd00::1]",
      "[::ffff:10.0.0.1]",
    ]) {
      expect(await resolveHostAddresses(host, { lookup }), host).toEqual({ kind: "private" });
    }
    expect(calls).toEqual([]);
  });

  it("treats an empty answer as unresolved", async () => {
    const { lookup } = fakeLookup([]);
    expect(await resolveHostAddresses("nowhere.example", { lookup })).toEqual({ kind: "unresolved" });
  });

  it("treats a failed lookup as unresolved and does not throw", async () => {
    const lookup: HostLookup = async () => {
      throw Object.assign(new Error("getaddrinfo ENOTFOUND nowhere.example"), { code: "ENOTFOUND" });
    };
    await expect(resolveHostAddresses("nowhere.example", { lookup })).resolves.toEqual({ kind: "unresolved" });
  });

  it("treats a lookup that never answers as unresolved once the timeout passes", async () => {
    const lookup: HostLookup = () => new Promise(() => undefined);
    await expect(resolveHostAddresses("slow.example", { lookup, timeoutMs: 5 })).resolves.toEqual({
      kind: "unresolved",
    });
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
