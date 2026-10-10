/**
 * Checks shared by the media routes (video proxy and media download).
 *
 * Apart from `resolveHostAddresses`, nothing here performs I/O. The fetching
 * lives in `./safe-fetch`, which resolves each hop once through
 * `resolveHostAddresses`, refuses a hop when any address is private, and
 * connects to the address it checked. The first URL and every redirect target
 * go through it.
 *
 * The hostname text is checked by `isPrivateAddress` and the allowlist. The
 * name is also resolved, so a public-looking name whose DNS answer is private
 * is refused.
 */
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

import { ALLOWED_MEDIA_HOSTS } from "@/app/api/v1/media/download/utils";

/** Largest body either media route relays. Enforced by Content-Length and by counting bytes as they arrive. */
export const MAX_MEDIA_BYTES = 100 * 1024 * 1024;

/** Redirects followed per request. A redirect past this count is refused. */
export const MAX_REDIRECTS = 3;

export type VideoProxyMode = "log" | "enforce";

/**
 * `enforce` only when the value is exactly "enforce" (case and spaces
 * ignored). Anything else, including unset and typos, stays in log mode,
 * which blocks no new host.
 */
export function videoProxyMode(value: string | undefined): VideoProxyMode {
  return value?.trim().toLowerCase() === "enforce" ? "enforce" : "log";
}

/**
 * True for an allowlisted domain or one of its subdomains. A single trailing
 * dot is ignored. Lookalikes such as `evilcdninstagram.com` and
 * `cdninstagram.com.evil.net` do not match.
 */
export function isAllowedVideoHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return ALLOWED_MEDIA_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

/** One IPv4 component in the forms WHATWG accepts: decimal, `0x` hex, or leading-zero octal. */
function parseIPv4Part(part: string): number | null {
  let digits = part;
  let radix = 10;
  if (/^0x/i.test(part)) {
    digits = part.slice(2);
    radix = 16;
    if (digits === "") return 0;
  } else if (part.length > 1 && part.startsWith("0")) {
    digits = part.slice(1);
    radix = 8;
  }
  const pattern = radix === 16 ? /^[0-9a-f]+$/i : radix === 8 ? /^[0-7]+$/ : /^[0-9]+$/;
  return pattern.test(digits) ? parseInt(digits, radix) : null;
}

/**
 * IPv4 address as a 32-bit number, or null when the text is not one. Accepts
 * the 1-4 part forms WHATWG accepts, so `127.1`, `2130706433` and `0x7f000001`
 * all map to 127.0.0.1.
 */
function parseIPv4(host: string): number | null {
  const parts = host.split(".");
  if (parts.length > 1 && parts[parts.length - 1] === "") parts.pop();
  if (parts.length > 4) return null;
  const numbers: number[] = [];
  for (const part of parts) {
    const value = parseIPv4Part(part);
    if (value === null) return null;
    numbers.push(value);
  }
  const last = numbers[numbers.length - 1];
  const leading = numbers.slice(0, -1);
  if (leading.some((value) => value > 255)) return null;
  if (last >= 256 ** (5 - numbers.length)) return null;
  return leading.reduce((address, value, index) => address + value * 256 ** (3 - index), last);
}

function isPrivateIPv4(address: number): boolean {
  const first = address >>> 24;
  const second = (address >>> 16) & 0xff;
  return (
    first === 0 || // 0.0.0.0/8, includes 0.0.0.0 itself
    first === 10 || // 10.0.0.0/8
    first === 127 || // 127.0.0.0/8 loopback
    (first === 100 && second >= 64 && second <= 127) || // 100.64.0.0/10 carrier-grade NAT
    (first === 169 && second === 254) || // 169.254.0.0/16 link-local, cloud metadata
    (first === 172 && second >= 16 && second <= 31) || // 172.16.0.0/12
    (first === 192 && second === 168) || // 192.168.0.0/16
    first >= 224 // 224.0.0.0/4 multicast and 240.0.0.0/4 reserved (includes broadcast)
  );
}

/**
 * Eight 16-bit groups from an IPv6 literal (no brackets, no zone id), or null.
 * Accepts `::` compression and a dotted IPv4 tail such as `::ffff:1.2.3.4`.
 */
function parseIPv6(literal: string): number[] | null {
  let text = literal;
  const tailStart = text.lastIndexOf(":") + 1;
  const tail = text.slice(tailStart);
  if (tail.includes(".")) {
    if (tail.split(".").length !== 4) return null;
    const embedded = parseIPv4(tail);
    if (embedded === null) return null;
    text = `${text.slice(0, tailStart)}${(embedded >>> 16).toString(16)}:${(embedded & 0xffff).toString(16)}`;
  }

  const halves = text.split("::");
  if (halves.length > 2) return null;

  const toGroups = (section: string): number[] | null => {
    if (section === "") return [];
    const groups: number[] = [];
    for (const group of section.split(":")) {
      if (!/^[0-9a-f]{1,4}$/i.test(group)) return null;
      groups.push(parseInt(group, 16));
    }
    return groups;
  };

  if (halves.length === 1) {
    const groups = toGroups(text);
    return groups !== null && groups.length === 8 ? groups : null;
  }

  const head = toGroups(halves[0]);
  const rest = toGroups(halves[1]);
  if (head === null || rest === null) return null;
  const missing = 8 - head.length - rest.length;
  if (missing < 1) return null;
  return [...head, ...new Array<number>(missing).fill(0), ...rest];
}

function isPrivateIPv6(groups: number[]): boolean {
  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;
  const embeddedIPv4 = g6 * 0x10000 + g7;
  const zeroPrefix = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0;

  // ::ffff:a.b.c.d (IPv4-mapped) is judged by the embedded IPv4 address.
  if (zeroPrefix && g5 === 0xffff) return isPrivateIPv4(embeddedIPv4);
  // ::/96 (IPv4-compatible, deprecated) is refused whatever it embeds. This
  // includes :: and ::1.
  if (zeroPrefix && g5 === 0) return true;
  return (
    (g0 & 0xfe00) === 0xfc00 || // fc00::/7 unique local
    (g0 & 0xffc0) === 0xfe80 || // fe80::/10 link-local
    (g0 & 0xffc0) === 0xfec0 || // fec0::/10 site-local (deprecated)
    (g0 & 0xff00) === 0xff00 || // ff00::/8 multicast
    (g0 === 0x0064 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) || // 64:ff9b::/96 NAT64
    (g0 === 0x0064 && g1 === 0xff9b && g2 === 0x0001) || // 64:ff9b:1::/48 local-use NAT64
    g0 === 0x2002 // 2002::/16 6to4, which embeds an IPv4 address this does not unwrap
  );
}

/** Lowercased, without IPv6 brackets or a trailing dot. */
export function normalizeHost(hostname: string): string {
  let host = hostname.trim().toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
  return host.replace(/\.$/, "");
}

/**
 * True when IP text is private, loopback, link-local, CGNAT, multicast or
 * reserved. IPv6 is recognised by its colon, otherwise the text is IPv4. An
 * IPv4-mapped address (`::ffff:a.b.c.d`) is judged by its embedded IPv4
 * address. The deprecated IPv4-compatible `::/96` is always reserved, and so
 * are NAT64 (`64:ff9b::/96`, `64:ff9b:1::/48`), 6to4 (`2002::/16`) and
 * site-local (`fec0::/10`). Text that is not an IP address counts as reserved
 * (fail closed).
 */
export function isReservedIpAddress(address: string): boolean {
  const host = normalizeHost(address);
  if (host.includes(":")) {
    const zoneStart = host.indexOf("%");
    const literal = zoneStart === -1 ? host : host.slice(0, zoneStart);
    const groups = parseIPv6(literal);
    return groups === null ? true : isPrivateIPv6(groups);
  }
  const ipv4 = parseIPv4(host);
  return ipv4 === null ? true : isPrivateIPv4(ipv4);
}

/**
 * True when a hostname is a private, loopback, link-local, CGNAT, multicast
 * or reserved IP literal, or `localhost`. Brackets around an IPv6 literal are
 * optional. WHATWG URL keeps them in `URL.hostname`, so pass that value
 * directly. Unparseable IPv6-looking text and an empty host count as private
 * (fail closed). Other names return false: this does not resolve them.
 */
export function isPrivateAddress(hostname: string): boolean {
  const host = normalizeHost(hostname);
  if (host === "" || host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.includes(":")) return isReservedIpAddress(host);
  const ipv4 = parseIPv4(host);
  return ipv4 !== null && isPrivateIPv4(ipv4);
}

/** One address from the resolver, as `dns.lookup` returns it with `{ all: true }`. */
export interface ResolvedAddress {
  address: string;
  family: number;
}

/** The lookup `checkHostResolution` calls. Defaults to `dns.promises.lookup`; tests inject their own. */
export type HostLookup = (
  hostname: string,
  options: { all: true; verbatim: true },
) => Promise<readonly ResolvedAddress[]>;

const defaultLookup: HostLookup = (hostname, options) => dnsLookup(hostname, options);

/** Longest a name may take to resolve. A slower lookup is refused as unresolved. */
export const DNS_TIMEOUT_MS = 5_000;

/** Every address a hostname resolves to, for one fetch hop. The caller checks them and connects to one. */
export type HostAddresses =
  /** One entry per address in the answer. A public IP literal is its own answer and needs no lookup. */
  | { kind: "addresses"; addresses: readonly ResolvedAddress[] }
  /** Judged private from the text alone (localhost, a private literal, an empty host). No lookup was made. */
  | { kind: "private" }
  /** The name did not resolve, the lookup failed, or it timed out. */
  | { kind: "unresolved" };

function withTimeout<T>(pending: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("dns lookup timed out")), ms);
  });
  return Promise.race([pending, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Resolves a hostname once and returns every address in the answer, in the
 * resolver's order. Names that `isPrivateAddress` already judges and IP
 * literals are handled without a lookup. The caller decides what to do with
 * the addresses: `safe-fetch` refuses the hop if any is reserved, and connects
 * to the address it verified.
 */
export async function resolveHostAddresses(
  hostname: string,
  options: { lookup?: HostLookup; timeoutMs?: number } = {},
): Promise<HostAddresses> {
  if (isPrivateAddress(hostname)) return { kind: "private" };
  const host = normalizeHost(hostname);
  const literal = isIP(host);
  if (literal !== 0) return { kind: "addresses", addresses: [{ address: host, family: literal }] };

  const lookup = options.lookup ?? defaultLookup;
  let answers: readonly ResolvedAddress[];
  try {
    // `verbatim` keeps the resolver's order.
    answers = await withTimeout(
      lookup(host, { all: true, verbatim: true }),
      options.timeoutMs ?? DNS_TIMEOUT_MS,
    );
  } catch {
    return { kind: "unresolved" };
  }
  if (answers.length === 0) return { kind: "unresolved" };
  return { kind: "addresses", addresses: answers };
}

export type UrlVerdict =
  | { kind: "allowed" }
  /** Logged in log mode and served. Blocked in enforce mode. */
  | { kind: "would-block"; reason: "host-not-allowlisted" }
  /** Blocked in every mode. */
  | { kind: "blocked"; reason: "not-https" | "private-address" };

/**
 * Verdict for one URL the video proxy is about to fetch: the initial request
 * or a redirect target. Private and non-https URLs are always blocked. An
 * allowlist miss is `would-block`, so the caller applies the mode.
 */
export function classifyVideoUrl(url: URL): UrlVerdict {
  if (url.protocol !== "https:") return { kind: "blocked", reason: "not-https" };
  if (isPrivateAddress(url.hostname)) return { kind: "blocked", reason: "private-address" };
  if (!isAllowedVideoHost(url.hostname)) return { kind: "would-block", reason: "host-not-allowlisted" };
  return { kind: "allowed" };
}

const REDIRECT_STATUSES: ReadonlySet<number> = new Set([301, 302, 303, 307, 308]);

export function isRedirectStatus(status: number): boolean {
  return REDIRECT_STATUSES.has(status);
}

/**
 * Target of a redirect's `Location` header, resolved against the URL that
 * sent it. Null when the header is missing or is not a URL.
 */
export function resolveRedirectLocation(location: string | null, from: URL): URL | null {
  if (!location) return null;
  try {
    return new URL(location, from);
  } catch {
    return null;
  }
}

/**
 * True when `redirectsFollowed` redirects have already been followed, so
 * following one more would exceed MAX_REDIRECTS.
 */
export function redirectLimitReached(redirectsFollowed: number): boolean {
  return redirectsFollowed >= MAX_REDIRECTS;
}

/** Thrown when a body passes its byte cap. Routes map it to 413. */
export class PayloadTooLargeError extends Error {
  readonly limitBytes: number;

  constructor(limitBytes: number) {
    super(`body exceeds ${limitBytes} bytes`);
    this.name = "PayloadTooLargeError";
    this.limitBytes = limitBytes;
  }
}

/** Counts bytes as they arrive and throws once the running total passes `maxBytes`. */
export function createByteCounter(maxBytes: number) {
  let total = 0;
  return {
    add(bytes: number): void {
      total += bytes;
      if (total > maxBytes) throw new PayloadTooLargeError(maxBytes);
    },
    get total(): number {
      return total;
    },
  };
}

/**
 * True when a Content-Length header declares more than `maxBytes`. A missing
 * or non-numeric header declares nothing, so the byte counter has to enforce
 * the cap in those cases.
 */
export function declaredLengthExceeds(contentLength: string | null, maxBytes: number): boolean {
  if (contentLength === null) return false;
  const trimmed = contentLength.trim();
  if (!/^\d+$/.test(trimmed)) return false;
  return Number(trimmed) > maxBytes;
}

/**
 * Reads a whole body into memory. Past `maxBytes` it cancels the source and
 * throws PayloadTooLargeError, so the upstream connection is released early.
 */
export async function readCappedBody(body: ReadableStream<Uint8Array>, maxBytes: number): Promise<ArrayBuffer> {
  const reader = body.getReader();
  const counter = createByteCounter(maxBytes);
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    try {
      counter.add(value.byteLength);
    } catch (error) {
      await reader.cancel(error).catch(() => undefined);
      throw error;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(counter.total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
}

/**
 * Relays a streamed body and errors the output once more than `maxBytes`
 * have gone out. The source is cancelled at that point, so the upstream
 * connection closes. `onSettled` runs once when the stream ends, errors or
 * is cancelled, so the caller can clear a timer.
 */
export function createCappedStream(
  source: ReadableStream<Uint8Array>,
  maxBytes: number,
  onSettled?: () => void,
): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  const counter = createByteCounter(maxBytes);
  let settled = false;
  const settle = (): void => {
    if (settled) return;
    settled = true;
    onSettled?.();
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          settle();
          controller.close();
          return;
        }
        counter.add(value.byteLength);
        controller.enqueue(value);
      } catch (error) {
        settle();
        await reader.cancel(error).catch(() => undefined);
        controller.error(error);
      }
    },
    async cancel(reason) {
      settle();
      await reader.cancel(reason).catch(() => undefined);
    },
  });
}
