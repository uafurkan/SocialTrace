export type AvailabilityPlatform = "instagram" | "tiktok" | "facebook" | "youtube";

/**
 * "available" is only ever reported from an official source that says the
 * handle does not exist. Everything else is "taken" when a source confirms it,
 * and "unknown" otherwise. An inconclusive answer is never read as free.
 */
export interface AvailabilityResult {
  platform: AvailabilityPlatform;
  handle: string;
  status: "available" | "taken" | "unknown";
  /** Set only when `status` is "unknown". */
  reason?: "no_official_source" | "inconclusive";
}

type Outcome = Pick<AvailabilityResult, "status" | "reason">;

const AVAILABLE: Outcome = { status: "available" };
const TAKEN: Outcome = { status: "taken" };
const INCONCLUSIVE: Outcome = { status: "unknown", reason: "inconclusive" };
const NO_OFFICIAL_SOURCE: Outcome = { status: "unknown", reason: "no_official_source" };

const FETCH_TIMEOUT_MS = 15_000;

/** Names this service honestly. It does not imitate a browser to get a different answer. */
const USER_AGENT = "Mozilla/5.0 (compatible; SocialTraceBot/1.0; +https://socialtrace.co)";

async function fetchWithTimeout(url: string, extraHeaders?: Record<string, string>): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html", ...extraHeaders },
      redirect: "manual",
      signal: controller.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * YouTube with a Data API key: channels.list with `forHandle` costs one quota
 * unit. An empty `items` array means no channel has this handle. The key goes
 * in a header, not the URL, so it cannot end up in a logged URL.
 */
async function checkYouTubeApi(handle: string, key: string): Promise<Outcome> {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(`@${handle}`)}`;
  const res = await fetchWithTimeout(url, { "x-goog-api-key": key, Accept: "application/json" });
  if (!res || res.status !== 200) return INCONCLUSIVE;

  const body = (await res.json().catch(() => null)) as { items?: unknown } | null;
  if (!body || !Array.isArray(body.items)) return INCONCLUSIVE;
  return body.items.length === 0 ? AVAILABLE : TAKEN;
}

/**
 * Fallback when no API key is configured: a real handle's page answers 200 and
 * an unregistered one answers 404, confirmed earlier. Any other answer, such as
 * a block or a consent page, is inconclusive.
 */
async function checkYouTubePage(handle: string): Promise<Outcome> {
  const res = await fetchWithTimeout(`https://www.youtube.com/@${encodeURIComponent(handle)}`);
  if (!res) return INCONCLUSIVE;
  if (res.status === 404) return AVAILABLE;
  if (res.status === 200) return TAKEN;
  return INCONCLUSIVE;
}

async function checkYouTube(handle: string): Promise<Outcome> {
  const key = process.env.YOUTUBE_API_KEY;
  return key ? checkYouTubeApi(handle, key) : checkYouTubePage(handle);
}

/**
 * TikTok's oEmbed endpoint accepts a creator profile URL and answers 200 with
 * profile data for an existing account. Measured: 6 of 6 known accounts
 * answered 200, and 6 of 6 made-up handles answered 400. Only 200 is read as
 * taken. A 400 is not read as free, because it is a generic error and can also
 * come from a rate limit.
 */
async function checkTikTok(handle: string): Promise<Outcome> {
  const profileUrl = `https://www.tiktok.com/@${handle}`;
  const res = await fetchWithTimeout(`https://www.tiktok.com/oembed?url=${encodeURIComponent(profileUrl)}`, {
    Accept: "application/json",
  });
  return res?.status === 200 ? TAKEN : INCONCLUSIVE;
}

/**
 * Instagram and Facebook have no official source that answers "is this handle
 * taken?" for an arbitrary account. Earlier versions asked undocumented
 * endpoints, read scraped page JSON, and read Facebook error codes as a side
 * channel. Those were removed. Instagram's Business Discovery could confirm
 * Business and Creator accounts once it is set up, but it cannot say a handle
 * is free.
 */
async function unsupported(): Promise<Outcome> {
  return NO_OFFICIAL_SOURCE;
}

const CHECKERS: Record<AvailabilityPlatform, (handle: string) => Promise<Outcome>> = {
  instagram: unsupported,
  tiktok: checkTikTok,
  facebook: unsupported,
  youtube: checkYouTube,
};

/** Each platform's own allowed-character rule. Rejecting invalid input costs nothing and avoids an outbound request. */
const HANDLE_PATTERN: Record<AvailabilityPlatform, RegExp> = {
  instagram: /^[a-zA-Z0-9._]{1,30}$/,
  tiktok: /^[a-zA-Z0-9._]{1,24}$/,
  facebook: /^[a-zA-Z0-9.]{5,50}$/,
  youtube: /^[a-zA-Z0-9._-]{3,30}$/,
};

export function isValidHandle(platform: AvailabilityPlatform, handle: string): boolean {
  return HANDLE_PATTERN[platform].test(handle);
}

export async function checkPlatform(platform: AvailabilityPlatform, handle: string): Promise<AvailabilityResult> {
  return { platform, handle, ...(await CHECKERS[platform](handle)) };
}

export async function checkAllPlatforms(handle: string): Promise<AvailabilityResult[]> {
  const platforms = Object.keys(CHECKERS) as AvailabilityPlatform[];
  const settled = await Promise.allSettled(platforms.map((platform) => checkPlatform(platform, handle)));
  return platforms.map((platform, i) => {
    const outcome = settled[i];
    return outcome.status === "fulfilled"
      ? outcome.value
      : { platform, handle, ...INCONCLUSIVE };
  });
}
