/**
 * Pure checks shared by the media routes (video proxy and media download).
 *
 * Nothing here performs I/O. The routes do the fetching and call these
 * helpers for the initial URL and for every redirect target.
 *
 * Limits of the hostname checks: they read the hostname text only and never
 * resolve DNS. A public name whose DNS record points at a private address is
 * not caught here. Closing that needs a resolver check before connecting.
 */
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
    (first === 169 && second === 254) || // 169.254.0.0/16 link-local, cloud metadata
    (first === 172 && second >= 16 && second <= 31) || // 172.16.0.0/12
    (first === 192 && second === 168) // 192.168.0.0/16
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

  // ::a.b.c.d (deprecated IPv4-compatible) and ::ffff:a.b.c.d (IPv4-mapped):
  // judged by the embedded IPv4 address. This also covers :: (0.0.0.0) and
  // ::1 (0.0.0.1), both inside 0.0.0.0/8.
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && (g5 === 0 || g5 === 0xffff)) {
    return isPrivateIPv4(embeddedIPv4);
  }
  return (
    (g0 & 0xfe00) === 0xfc00 || // fc00::/7 unique local
    (g0 & 0xffc0) === 0xfe80 // fe80::/10 link-local
  );
}

/**
 * True when a hostname is, or resolves textually to, a private, loopback,
 * link-local or unspecified address, or to `localhost`. Brackets around an
 * IPv6 literal are optional. WHATWG URL keeps them in `URL.hostname`, so
 * pass that value directly. Unparseable IPv6-looking text and an empty host
 * count as private (fail closed).
 */
export function isPrivateAddress(hostname: string): boolean {
  let host = hostname.trim().toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
  host = host.replace(/\.$/, "");

  if (host === "" || host === "localhost" || host.endsWith(".localhost")) return true;

  if (host.includes(":")) {
    const zoneStart = host.indexOf("%");
    const literal = zoneStart === -1 ? host : host.slice(0, zoneStart);
    const groups = parseIPv6(literal);
    return groups === null ? true : isPrivateIPv6(groups);
  }

  const ipv4 = parseIPv4(host);
  return ipv4 !== null && isPrivateIPv4(ipv4);
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
