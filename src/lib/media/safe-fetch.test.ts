import { EventEmitter } from "node:events";
import type { IncomingMessage } from "node:http";
import type { RequestOptions } from "node:https";
import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";

import { MAX_REDIRECTS, PayloadTooLargeError, type HostLookup, type ResolvedAddress } from "./guard";
import { safeFetchMedia, type HopCheck, type PinnedRequest, type PinnedRequestFn, type SafeFetchResult } from "./safe-fetch";

const START = new URL("https://scontent.cdninstagram.com/v/a.mp4?x=1");
const ALLOW = (): HopCheck => ({ ok: true });

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function answer(addresses: string[]): ResolvedAddress[] {
  return addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));
}

/** Lookup keyed by hostname. A name not in the table fails like NXDOMAIN. Every call is recorded. */
function mapLookup(table: Record<string, string[]>) {
  const calls: string[] = [];
  const lookup: HostLookup = async (hostname) => {
    calls.push(hostname);
    const addresses = table[hostname];
    if (!addresses) throw Object.assign(new Error(`ENOTFOUND ${hostname}`), { code: "ENOTFOUND" });
    return answer(addresses);
  };
  return { lookup, calls };
}

/** Lookup that answers with each list in turn, and repeats the last one. Models a name whose answer changes. */
function sequenceLookup(sequence: string[][]) {
  const calls: string[] = [];
  let index = 0;
  const lookup: HostLookup = async (hostname) => {
    calls.push(hostname);
    const addresses = sequence[Math.min(index, sequence.length - 1)];
    index += 1;
    return answer(addresses);
  };
  return { lookup, calls };
}

/**
 * One scripted reply. `stall` sends the headers and the chunks but never ends
 * the body. `fail` errors the request before any headers. `hang` never answers.
 */
type Reply =
  | { status: number; headers?: Record<string, string>; chunks?: Uint8Array[]; stall?: boolean }
  | { fail: true }
  | "hang";

/** Stands in for an https.ClientRequest. It answers with the scripted reply once `end()` is called. */
class FakeRequest extends EventEmitter {
  private response: PassThrough | undefined;

  constructor(
    private readonly reply: Reply,
    private readonly onResponse: (response: IncomingMessage) => void,
  ) {
    super();
  }

  end(): this {
    const reply = this.reply;
    if (reply === "hang") return this;
    setImmediate(() => {
      if ("fail" in reply) {
        this.emit("error", Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }));
        return;
      }
      const response = new PassThrough();
      Object.assign(response, { statusCode: reply.status, headers: reply.headers ?? {} });
      this.response = response;
      this.onResponse(response as unknown as IncomingMessage);
      for (const chunk of reply.chunks ?? []) response.write(chunk);
      if (!reply.stall) response.end();
    });
    return this;
  }

  destroy(error?: Error): this {
    if (error) this.emit("error", error);
    this.response?.destroy(error);
    return this;
  }
}

/** Stand-in for node:https request. Each call takes the next reply and records its options. Nothing touches the network. */
function fakeHttps(replies: Reply[]) {
  const calls: RequestOptions[] = [];
  const request: PinnedRequestFn = (options, onResponse) => {
    calls.push(options);
    const reply = replies.shift();
    if (reply === undefined) throw new Error(`unexpected request to ${String(options.hostname)}`);
    return new FakeRequest(reply, onResponse) as unknown as PinnedRequest;
  };
  return { request, calls };
}

/** Runs the request's `lookup` option the way net does, asking for `host`, with or without `all`. */
function askPinnedLookup(options: RequestOptions, host: string, all: boolean): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!options.lookup) {
      reject(new Error("request has no lookup option"));
      return;
    }
    options.lookup(host, { all }, (error, address, family) => {
      if (error) reject(error);
      else resolve(all ? address : { address, family });
    });
  });
}

function okResponse(result: SafeFetchResult): Response {
  expect(result.kind).toBe("ok");
  if (result.kind !== "ok") throw new Error(`expected ok, got ${result.kind}`);
  return result.response;
}

async function readAll(body: ReadableStream<Uint8Array> | null): Promise<string> {
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

describe("safeFetchMedia: pinned connection", () => {
  it("connects to the verified address, with TLS checked against the hostname", async () => {
    const { lookup } = mapLookup({ "scontent.cdninstagram.com": ["93.184.216.34"] });
    const https = fakeHttps([{ status: 200, chunks: [bytes("abcd")] }]);

    const result = await safeFetchMedia(START, { checkUrl: ALLOW, lookup, request: https.request });

    expect(await readAll(okResponse(result).body)).toBe("abcd");
    const [options] = https.calls;
    expect(options.hostname).toBe("scontent.cdninstagram.com");
    expect(options.servername).toBe("scontent.cdninstagram.com");
    expect(options.path).toBe("/v/a.mp4?x=1");
    expect(options.port).toBe(443);
    expect(options.method).toBe("GET");
    expect(options.agent).toBe(false);
    expect(options.headers).toMatchObject({ "Accept-Encoding": "identity" });
    expect(await askPinnedLookup(options, "scontent.cdninstagram.com", false)).toEqual({
      address: "93.184.216.34",
      family: 4,
    });
    expect(await askPinnedLookup(options, "scontent.cdninstagram.com", true)).toEqual([
      { address: "93.184.216.34", family: 4 },
    ]);
    // The pinned lookup answers only for the hostname it was built for.
    await expect(askPinnedLookup(options, "elsewhere.example", false)).rejects.toMatchObject({
      code: "ERR_PINNED_LOOKUP",
    });
  });

  it("resolves once and pins the first answer, so a rebinding name never reaches its private second answer", async () => {
    // First answer public, second private: the attack this module closes.
    const { lookup, calls } = sequenceLookup([["93.184.216.34"], ["10.0.0.7"]]);
    const https = fakeHttps([{ status: 200 }]);

    const result = await safeFetchMedia(START, { checkUrl: ALLOW, lookup, request: https.request });

    okResponse(result);
    expect(calls).toEqual(["scontent.cdninstagram.com"]);
    expect(https.calls).toHaveLength(1);
    expect(await askPinnedLookup(https.calls[0], "scontent.cdninstagram.com", false)).toEqual({
      address: "93.184.216.34",
      family: 4,
    });
  });
});

describe("safeFetchMedia: refusals before any connection", () => {
  it.each([
    "127.0.0.1",
    "169.254.169.254",
    "10.1.2.3",
    "172.16.5.5",
    "192.168.1.1",
    "100.64.0.9",
    "224.0.0.251",
    "::1",
    "fd00::5",
    "fe80::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:169.254.169.254",
    "::8.8.8.8",
    "64:ff9b::a9fe:a9fe",
    "64:ff9b:1::1",
    "2002:a9fe:a9fe::1",
    "fec0::1",
  ])("refuses a public-looking name that resolves to %s", async (address) => {
    const { lookup } = mapLookup({ "public-looking.example": [address] });
    const https = fakeHttps([]);

    const result = await safeFetchMedia(new URL("https://public-looking.example/a.mp4"), {
      checkUrl: ALLOW,
      lookup,
      request: https.request,
    });

    expect(result).toEqual({ kind: "refused", reason: "private-address", redirect: false });
    expect(https.calls).toEqual([]);
  });

  it("refuses the name when any one answer is private, not only the first", async () => {
    const { lookup } = mapLookup({ "mixed.example": ["93.184.216.34", "10.0.0.7"] });
    const https = fakeHttps([]);

    const result = await safeFetchMedia(new URL("https://mixed.example/a.mp4"), {
      checkUrl: ALLOW,
      lookup,
      request: https.request,
    });

    expect(result).toEqual({ kind: "refused", reason: "private-address", redirect: false });
    expect(https.calls).toEqual([]);
  });

  it("refuses a name that does not resolve, and one whose answer is empty", async () => {
    const https = fakeHttps([]);
    const missing = await safeFetchMedia(new URL("https://nowhere.example/a.mp4"), {
      checkUrl: ALLOW,
      lookup: mapLookup({}).lookup,
      request: https.request,
    });
    const empty = await safeFetchMedia(new URL("https://empty.example/a.mp4"), {
      checkUrl: ALLOW,
      lookup: mapLookup({ "empty.example": [] }).lookup,
      request: https.request,
    });

    expect(missing).toEqual({ kind: "refused", reason: "unresolvable", redirect: false });
    expect(empty).toEqual({ kind: "refused", reason: "unresolvable", redirect: false });
    expect(https.calls).toEqual([]);
  });

  it("refuses a private literal host without a lookup", async () => {
    const { lookup, calls } = mapLookup({});
    const https = fakeHttps([]);

    const result = await safeFetchMedia(new URL("https://169.254.169.254/latest/meta-data"), {
      checkUrl: ALLOW,
      lookup,
      request: https.request,
    });

    expect(result).toEqual({ kind: "refused", reason: "private-address", redirect: false });
    expect(calls).toEqual([]);
    expect(https.calls).toEqual([]);
  });

  it("refuses a non-https URL without resolving it", async () => {
    const { lookup, calls } = mapLookup({ "scontent.cdninstagram.com": ["93.184.216.34"] });
    const https = fakeHttps([]);

    const result = await safeFetchMedia(new URL("http://scontent.cdninstagram.com/a.mp4"), {
      checkUrl: ALLOW,
      lookup,
      request: https.request,
    });

    expect(result).toEqual({ kind: "refused", reason: "not-https", redirect: false });
    expect(calls).toEqual([]);
  });

  it("refuses a URL the caller's policy rejects, without resolving it", async () => {
    const { lookup, calls } = mapLookup({ "example.com": ["93.184.216.34"] });
    const https = fakeHttps([]);

    const result = await safeFetchMedia(new URL("https://example.com/a.mp4"), {
      checkUrl: () => ({ ok: false, reason: "host-not-allowlisted" }),
      lookup,
      request: https.request,
    });

    expect(result).toEqual({ kind: "refused", reason: "host-not-allowlisted", redirect: false });
    expect(calls).toEqual([]);
  });
});

describe("safeFetchMedia: redirect hops", () => {
  it("pins each hop to its own verified address and computes each hop's headers", async () => {
    const { lookup } = mapLookup({
      "scontent.cdninstagram.com": ["93.184.216.34"],
      "video.fbcdn.net": ["151.101.1.1"],
    });
    const https = fakeHttps([
      { status: 302, headers: { location: "https://video.fbcdn.net/x/b.mp4" } },
      { status: 200, chunks: [bytes("ok")] },
    ]);
    const hopUrls: string[] = [];

    const result = await safeFetchMedia(START, {
      checkUrl: ALLOW,
      lookup,
      request: https.request,
      headers: (url) => {
        hopUrls.push(url.href);
        return { Range: "bytes=0-", "X-Hop": url.hostname };
      },
    });

    expect(okResponse(result).status).toBe(200);
    expect(https.calls.map((call) => call.hostname)).toEqual(["scontent.cdninstagram.com", "video.fbcdn.net"]);
    expect(https.calls.map((call) => call.servername)).toEqual(["scontent.cdninstagram.com", "video.fbcdn.net"]);
    expect(https.calls[1].path).toBe("/x/b.mp4");
    expect(await askPinnedLookup(https.calls[0], "scontent.cdninstagram.com", false)).toEqual({
      address: "93.184.216.34",
      family: 4,
    });
    expect(await askPinnedLookup(https.calls[1], "video.fbcdn.net", false)).toEqual({
      address: "151.101.1.1",
      family: 4,
    });
    expect(https.calls[1].headers).toMatchObject({ "X-Hop": "video.fbcdn.net", Range: "bytes=0-" });
    expect(hopUrls).toEqual([START.href, "https://video.fbcdn.net/x/b.mp4"]);
  });

  it("refuses a redirect to a host that resolves to a private address, without connecting to it", async () => {
    const { lookup } = mapLookup({
      "scontent.cdninstagram.com": ["93.184.216.34"],
      "internal.fbcdn.net": ["10.0.0.5"],
    });
    const https = fakeHttps([{ status: 302, headers: { location: "https://internal.fbcdn.net/a.mp4" } }]);

    const result = await safeFetchMedia(START, { checkUrl: ALLOW, lookup, request: https.request });

    expect(result).toEqual({ kind: "refused", reason: "private-address", redirect: true });
    expect(https.calls).toHaveLength(1);
  });

  it("refuses a redirect to a private literal and to a non-https URL", async () => {
    const { lookup } = mapLookup({ "scontent.cdninstagram.com": ["93.184.216.34"] });

    const literal = await safeFetchMedia(START, {
      checkUrl: ALLOW,
      lookup,
      request: fakeHttps([{ status: 302, headers: { location: "https://10.0.0.1/a.mp4" } }]).request,
    });
    const plain = await safeFetchMedia(START, {
      checkUrl: ALLOW,
      lookup,
      request: fakeHttps([{ status: 302, headers: { location: "http://scontent.cdninstagram.com/a.mp4" } }]).request,
    });

    expect(literal).toEqual({ kind: "refused", reason: "private-address", redirect: true });
    expect(plain).toEqual({ kind: "refused", reason: "not-https", redirect: true });
  });

  it("refuses a redirect target that the caller's policy rejects", async () => {
    const { lookup } = mapLookup({
      "scontent.cdninstagram.com": ["93.184.216.34"],
      "evil.example": ["93.184.216.35"],
    });
    const https = fakeHttps([{ status: 302, headers: { location: "https://evil.example/a.mp4" } }]);

    const result = await safeFetchMedia(START, {
      checkUrl: (url) => (url.hostname === "evil.example" ? { ok: false, reason: "host-not-allowlisted" } : { ok: true }),
      lookup,
      request: https.request,
    });

    expect(result).toEqual({ kind: "refused", reason: "host-not-allowlisted", redirect: true });
    expect(https.calls).toHaveLength(1);
  });

  it("refuses a redirect target that does not resolve", async () => {
    const { lookup } = mapLookup({ "scontent.cdninstagram.com": ["93.184.216.34"] });
    const https = fakeHttps([{ status: 302, headers: { location: "https://gone.example/a.mp4" } }]);

    const result = await safeFetchMedia(START, { checkUrl: ALLOW, lookup, request: https.request });

    expect(result).toEqual({ kind: "refused", reason: "unresolvable", redirect: true });
  });

  it("follows exactly MAX_REDIRECTS redirects", async () => {
    const { lookup } = mapLookup({ "scontent.cdninstagram.com": ["93.184.216.34"] });
    const replies: Reply[] = [];
    for (let i = 0; i < MAX_REDIRECTS; i++) replies.push({ status: 302, headers: { location: `/hop-${i}.mp4` } });
    replies.push({ status: 200 });
    const https = fakeHttps(replies);

    const result = await safeFetchMedia(START, { checkUrl: ALLOW, lookup, request: https.request });

    okResponse(result);
    expect(https.calls).toHaveLength(MAX_REDIRECTS + 1);
  });

  it("refuses one redirect past MAX_REDIRECTS with too-many-redirects", async () => {
    const { lookup } = mapLookup({ "scontent.cdninstagram.com": ["93.184.216.34"] });
    const replies: Reply[] = [];
    for (let i = 0; i < MAX_REDIRECTS + 1; i++) replies.push({ status: 302, headers: { location: `/hop-${i}.mp4` } });
    const https = fakeHttps(replies);

    const result = await safeFetchMedia(START, { checkUrl: ALLOW, lookup, request: https.request });

    expect(result).toEqual({ kind: "too-many-redirects" });
    expect(https.calls).toHaveLength(MAX_REDIRECTS + 1);
  });

  it("returns a 3xx without a usable Location as the final response", async () => {
    const { lookup } = mapLookup({ "scontent.cdninstagram.com": ["93.184.216.34"] });
    const https = fakeHttps([{ status: 302 }]);

    const result = await safeFetchMedia(START, { checkUrl: ALLOW, lookup, request: https.request });

    expect(okResponse(result).status).toBe(302);
  });
});

describe("safeFetchMedia: the relayed response", () => {
  it("keeps the status and the headers the routes read, and drops hop-by-hop headers", async () => {
    const { lookup } = mapLookup({ "scontent.cdninstagram.com": ["93.184.216.34"] });
    const https = fakeHttps([
      {
        status: 206,
        headers: {
          "content-type": "video/mp4",
          "content-range": "bytes 0-3/10",
          "content-length": "4",
          "accept-ranges": "bytes",
          "transfer-encoding": "chunked",
          connection: "keep-alive",
        },
        chunks: [bytes("abcd")],
      },
    ]);

    const response = okResponse(
      await safeFetchMedia(START, { checkUrl: ALLOW, lookup, request: https.request }),
    );

    expect(response.status).toBe(206);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(response.headers.get("content-range")).toBe("bytes 0-3/10");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("transfer-encoding")).toBeNull();
    expect(response.headers.get("connection")).toBeNull();
  });

  it("relays a 304 with no body", async () => {
    const { lookup } = mapLookup({ "scontent.cdninstagram.com": ["93.184.216.34"] });
    const https = fakeHttps([{ status: 304 }]);

    const response = okResponse(
      await safeFetchMedia(START, { checkUrl: ALLOW, lookup, request: https.request }),
    );

    expect(response.status).toBe(304);
    expect(response.body).toBeNull();
  });
});

describe("safeFetchMedia: body cap and timers", () => {
  const threeChunks = () => [bytes("aaaa"), bytes("bbbb"), bytes("cccc")];

  it("delivers a body that stays under the cap whole", async () => {
    const { lookup } = mapLookup({ "scontent.cdninstagram.com": ["93.184.216.34"] });
    const https = fakeHttps([{ status: 200, chunks: threeChunks() }]);

    const response = okResponse(
      await safeFetchMedia(START, { checkUrl: ALLOW, lookup, request: https.request, maxBytes: 12 }),
    );

    expect(await readAll(response.body)).toBe("aaaabbbbcccc");
  });

  it("errors the body with PayloadTooLargeError once the cap is passed", async () => {
    const { lookup } = mapLookup({ "scontent.cdninstagram.com": ["93.184.216.34"] });
    const https = fakeHttps([{ status: 200, chunks: threeChunks() }]);

    const response = okResponse(
      await safeFetchMedia(START, { checkUrl: ALLOW, lookup, request: https.request, maxBytes: 10 }),
    );

    await expect(readAll(response.body)).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  it("aborts a stalled body after bodyTimeoutMs", async () => {
    const { lookup } = mapLookup({ "scontent.cdninstagram.com": ["93.184.216.34"] });
    const https = fakeHttps([{ status: 200, chunks: [bytes("aa")], stall: true }]);

    const response = okResponse(
      await safeFetchMedia(START, { checkUrl: ALLOW, lookup, request: https.request, bodyTimeoutMs: 20 }),
    );

    await expect(readAll(response.body)).rejects.toThrow("media body timed out");
  });

  it("aborts an open body when the caller's signal fires", async () => {
    const { lookup } = mapLookup({ "scontent.cdninstagram.com": ["93.184.216.34"] });
    const https = fakeHttps([{ status: 200, chunks: [bytes("aa")], stall: true }]);
    const caller = new AbortController();

    const response = okResponse(
      await safeFetchMedia(START, { checkUrl: ALLOW, lookup, request: https.request, signal: caller.signal }),
    );
    const pending = readAll(response.body);
    caller.abort(new Error("caller deadline"));

    await expect(pending).rejects.toThrow("caller deadline");
  });

  it("fails a request that never answers once headersTimeoutMs passes", async () => {
    const { lookup } = mapLookup({ "scontent.cdninstagram.com": ["93.184.216.34"] });
    const https = fakeHttps(["hang"]);

    const result = await safeFetchMedia(START, {
      checkUrl: ALLOW,
      lookup,
      request: https.request,
      headersTimeoutMs: 20,
    });

    expect(result.kind).toBe("failed");
  });

  it("fails a request whose connection errors before headers", async () => {
    const { lookup } = mapLookup({ "scontent.cdninstagram.com": ["93.184.216.34"] });
    const https = fakeHttps([{ fail: true }]);

    const result = await safeFetchMedia(START, { checkUrl: ALLOW, lookup, request: https.request });

    expect(result.kind).toBe("failed");
  });

  it("fails a request started after the caller's signal has already fired", async () => {
    const { lookup } = mapLookup({ "scontent.cdninstagram.com": ["93.184.216.34"] });
    const https = fakeHttps([{ status: 200 }]);
    const caller = new AbortController();
    caller.abort(new Error("gave up"));

    const result = await safeFetchMedia(START, { checkUrl: ALLOW, lookup, request: https.request, signal: caller.signal });

    expect(result.kind).toBe("failed");
  });
});
