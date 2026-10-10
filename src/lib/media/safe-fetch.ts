/**
 * Fetches one media URL with its connection pinned to an address that was
 * checked, which closes the DNS rebinding window that a separate lookup and
 * fetch leave open.
 *
 * For each hop (the first URL and every redirect target):
 *   1. The URL must be https. The caller's `checkUrl` policy then runs
 *      (allowlist, Apify rule). Nothing is resolved before both pass.
 *   2. The name is resolved once, with every answer. If any answer is private
 *      or reserved, the hop is refused and no connection is made.
 *   3. An https request is sent whose `lookup` option returns only the address
 *      verified in step 2. The socket goes to that address. `servername` is the
 *      hostname, so the certificate is still checked against the name.
 *
 * Redirects are followed by hand, up to MAX_REDIRECTS. Node's built-in fetch
 * cannot take a resolver, so this module uses node:https. It does not read
 * HTTP(S)_PROXY, so the pinned address is the one connected to. See
 * `safeFetchMedia` for what a proxy would change.
 */
import type { IncomingMessage } from "node:http";
import { request as httpsRequest, type RequestOptions } from "node:https";
import { isIP } from "node:net";
import { Readable } from "node:stream";

import {
  MAX_MEDIA_BYTES,
  createCappedStream,
  isRedirectStatus,
  isReservedIpAddress,
  normalizeHost,
  redirectLimitReached,
  resolveHostAddresses,
  resolveRedirectLocation,
  type HostLookup,
  type ResolvedAddress,
} from "./guard";

/**
 * Sent on every media fetch. It names the proxy honestly and does not imitate
 * a browser. A CDN that refuses non-browser clients refuses us too, and that
 * media simply fails to load. Getting past hotlink protection by impersonating
 * a browser is an access-control bypass, and this project does not do that.
 */
export const MEDIA_USER_AGENT = "Mozilla/5.0 (compatible; SocialTraceBot/1.0; +https://socialtrace.co)";

/** Outcome of the caller's policy check for one URL. `reason` comes back to the caller on refusal. */
export type HopCheck = { ok: true } | { ok: false; reason: string };

/** The part of https.ClientRequest this module uses. Tests supply a fake. */
export interface PinnedRequest {
  on(event: "error", listener: (error: Error) => void): unknown;
  end(): unknown;
  destroy(error?: Error): unknown;
}

/** Same call shape as `https.request(options, onResponse)`. */
export type PinnedRequestFn = (
  options: RequestOptions,
  onResponse: (response: IncomingMessage) => void,
) => PinnedRequest;

export interface SafeFetchOptions {
  /** Policy for one URL: the first URL and every redirect target. Runs before resolution. */
  checkUrl: (url: URL) => HopCheck;
  /** Extra request headers for one hop. Computed per hop, so a redirect target never gets the first hop's headers. */
  headers?: (url: URL) => Record<string, string>;
  /** Aborts the whole fetch, including the body. */
  signal?: AbortSignal;
  /** Longest wait from the first request until the final response headers arrive, redirects included. */
  headersTimeoutMs?: number;
  /** Longest wait from the final response headers until the body ends. */
  bodyTimeoutMs?: number;
  /** Body cap, counted as bytes arrive. Defaults to MAX_MEDIA_BYTES. */
  maxBytes?: number;
  /** DNS lookup. Defaults to dns.lookup with every answer. Tests inject their own. */
  lookup?: HostLookup;
  /** https request function. Defaults to node:https request. Tests inject their own. */
  request?: PinnedRequestFn;
}

export type SafeFetchResult =
  /** The final response. Its body is capped and the timers abort it. The caller reads or cancels it. */
  | { kind: "ok"; response: Response }
  /**
   * A hop was refused before any connection to it. `redirect` is true when the
   * refused URL was a redirect target. `reason` is the caller's reason from
   * `checkUrl`, or one of "not-https", "private-address", "unresolvable".
   */
  | { kind: "refused"; reason: string; redirect: boolean }
  /** More redirects than MAX_REDIRECTS. */
  | { kind: "too-many-redirects" }
  /** The request failed, or a timer or the caller's signal aborted it before the final headers arrived. */
  | { kind: "failed"; error: unknown };

type LookupFn = NonNullable<RequestOptions["lookup"]>;

const defaultRequest: PinnedRequestFn = (options, onResponse) => httpsRequest(options, onResponse);

/** Hop-by-hop headers are not copied onto the response that is relayed. */
const HOP_BY_HOP = new Set(["connection", "keep-alive", "proxy-connection", "te", "trailer", "transfer-encoding", "upgrade"]);

/** Statuses that must not carry a body. A Response cannot be built with one. */
const NULL_BODY_STATUSES = new Set([204, 205, 304]);

/** A lookup that answers only with the address already verified for `hostname`. */
function pinnedLookup(hostname: string, pinned: ResolvedAddress): LookupFn {
  return (host, lookupOptions, callback) => {
    if (host !== hostname) {
      callback(Object.assign(new Error(`lookup refused for ${host}`), { code: "ERR_PINNED_LOOKUP" }), "", 0);
      return;
    }
    if (lookupOptions.all) {
      callback(null, [{ address: pinned.address, family: pinned.family }]);
      return;
    }
    callback(null, pinned.address, pinned.family);
  };
}

type Vetted = { kind: "pinned"; hostname: string; address: ResolvedAddress } | { kind: "refused"; reason: string };

/** Scheme, caller policy, then one resolution. Any reserved answer refuses the hop. */
async function vetHop(url: URL, options: SafeFetchOptions): Promise<Vetted> {
  if (url.protocol !== "https:") return { kind: "refused", reason: "not-https" };
  const policy = options.checkUrl(url);
  if (!policy.ok) return { kind: "refused", reason: policy.reason };

  const resolved = await resolveHostAddresses(url.hostname, { lookup: options.lookup });
  if (resolved.kind === "private") return { kind: "refused", reason: "private-address" };
  if (resolved.kind === "unresolved") return { kind: "refused", reason: "unresolvable" };
  if (resolved.addresses.some((entry) => isReservedIpAddress(entry.address))) {
    return { kind: "refused", reason: "private-address" };
  }
  return { kind: "pinned", hostname: normalizeHost(url.hostname), address: resolved.addresses[0] };
}

/** Sends one GET to the pinned address. Resolves with the response headers. */
function sendPinned(
  requestFn: PinnedRequestFn,
  url: URL,
  vetted: { hostname: string; address: ResolvedAddress },
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const req = requestFn(
      {
        hostname: vetted.hostname,
        port: url.port === "" ? 443 : Number(url.port),
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: { Accept: "*/*", "Accept-Encoding": "identity", ...headers },
        // A fresh socket per hop. A pooled socket would skip the lookup above.
        agent: false,
        // The certificate is checked against the name, not the pinned address.
        servername: isIP(vetted.hostname) === 0 ? vetted.hostname : undefined,
        lookup: pinnedLookup(vetted.hostname, vetted.address),
      },
      (response) => resolve(response),
    );
    // Stays attached for the life of the request, so a later error cannot go unhandled.
    req.on("error", reject);
    const abort = (): void => {
      req.destroy(signal.reason as Error);
    };
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
    req.end();
  });
}

/** Relays a final response. Its body is capped, and the body timer and the signal abort it. */
function relay(response: IncomingMessage, controller: AbortController, bodyTimeoutMs: number | undefined, maxBytes: number): Response {
  const status = response.statusCode ?? 502;
  const headers = new Headers();
  for (const [name, value] of Object.entries(response.headers)) {
    if (value === undefined || HOP_BY_HOP.has(name)) continue;
    for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item);
  }

  if (NULL_BODY_STATUSES.has(status)) {
    response.destroy();
    return new Response(null, { status, headers });
  }

  const onAbort = (): void => {
    response.destroy(controller.signal.reason as Error);
  };
  const bodyTimer =
    bodyTimeoutMs === undefined
      ? undefined
      : setTimeout(() => controller.abort(new Error("media body timed out")), bodyTimeoutMs);
  const settle = (): void => {
    clearTimeout(bodyTimer);
    controller.signal.removeEventListener("abort", onAbort);
  };
  controller.signal.addEventListener("abort", onAbort, { once: true });
  if (controller.signal.aborted) onAbort();

  // Readable.toWeb turns the Node stream into the web stream a Response takes.
  const source = Readable.toWeb(response) as unknown as ReadableStream<Uint8Array>;
  return new Response(createCappedStream(source, maxBytes, settle), { status, headers });
}

function headerText(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  return Array.isArray(value) && value.length > 0 ? value[0] : null;
}

/**
 * Fetches `start` and follows redirects, checking and pinning each hop as
 * described at the top of this file.
 *
 * Residual risk: node:https does not read HTTP(S)_PROXY, so the connection goes
 * to the address that was checked. If a proxy were put in front of node:https
 * (a proxy-aware agent, or a runtime that applies env proxies to node:https),
 * the proxy would resolve the hostname itself. The address checked here would
 * then not be the address reached, and the rebinding window would move to the
 * proxy's resolver. Nothing in this module checks where the proxy connects.
 */
export async function safeFetchMedia(start: URL, options: SafeFetchOptions): Promise<SafeFetchResult> {
  const controller = new AbortController();
  const callerSignal = options.signal;
  const abortFromCaller = (): void => controller.abort(callerSignal?.reason);
  if (callerSignal?.aborted) abortFromCaller();
  else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });

  const headersTimer =
    options.headersTimeoutMs === undefined
      ? undefined
      : setTimeout(() => controller.abort(new Error("media headers timed out")), options.headersTimeoutMs);
  const requestFn = options.request ?? defaultRequest;
  const maxBytes = options.maxBytes ?? MAX_MEDIA_BYTES;

  try {
    let current = start;
    let redirectsFollowed = 0;
    for (;;) {
      const vetted = await vetHop(current, options);
      if (vetted.kind === "refused") {
        return { kind: "refused", reason: vetted.reason, redirect: redirectsFollowed > 0 };
      }

      let response: IncomingMessage;
      try {
        response = await sendPinned(requestFn, current, vetted, options.headers?.(current) ?? {}, controller.signal);
      } catch (error) {
        return { kind: "failed", error };
      }

      const status = response.statusCode ?? 502;
      const next = isRedirectStatus(status) ? resolveRedirectLocation(headerText(response.headers.location), current) : null;
      // A 3xx without a usable Location is final. The caller sees it as not ok.
      if (next === null) {
        return { kind: "ok", response: relay(response, controller, options.bodyTimeoutMs, maxBytes) };
      }

      response.destroy();
      if (redirectLimitReached(redirectsFollowed)) return { kind: "too-many-redirects" };
      redirectsFollowed += 1;
      current = next;
    }
  } finally {
    // The caller's signal stays attached: it must still abort the body after this returns.
    clearTimeout(headersTimer);
  }
}
