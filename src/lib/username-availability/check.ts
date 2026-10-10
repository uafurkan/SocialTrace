export type AvailabilityPlatform = "instagram" | "tiktok" | "facebook" | "youtube";

export interface AvailabilityResult {
  platform: AvailabilityPlatform;
  handle: string;
  status: "available" | "taken" | "unknown";
}

type Status = AvailabilityResult["status"];

const FETCH_TIMEOUT_MS = 15_000;

/** Names this service honestly. It does not imitate a browser to get a different answer. */
const USER_AGENT = "Mozilla/5.0 (compatible; SocialTraceBot/1.0; +https://socialtrace.co)";

async function fetchWithTimeout(url: string): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
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
 * YouTube: a real handle's page answers 200 and an unregistered one answers
 * 404, confirmed earlier. Any other answer, including a block or a consent
 * page, is reported as `unknown`. It is never read as "available".
 */
async function checkYouTube(handle: string): Promise<Status> {
  const res = await fetchWithTimeout(`https://www.youtube.com/@${encodeURIComponent(handle)}`);
  if (!res) return "unknown";
  if (res.status === 404) return "available";
  if (res.status === 200) return "taken";
  return "unknown";
}

/**
 * Instagram, TikTok and Facebook have no source here that answers "is this
 * handle taken?" without logging in, using an undocumented endpoint, or
 * copying a browser identity. Earlier versions did all three: an app-id
 * request, scraped page JSON, and Facebook error codes read as a side channel.
 * Those were removed. `unknown` is the only honest answer.
 */
async function unsupported(): Promise<Status> {
  return "unknown";
}

const CHECKERS: Record<AvailabilityPlatform, (handle: string) => Promise<Status>> = {
  instagram: unsupported,
  tiktok: unsupported,
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

export async function checkAllPlatforms(handle: string): Promise<AvailabilityResult[]> {
  const platforms = Object.keys(CHECKERS) as AvailabilityPlatform[];
  const settled = await Promise.allSettled(platforms.map((platform) => CHECKERS[platform](handle)));
  return platforms.map((platform, i) => {
    const outcome = settled[i];
    return {
      platform,
      handle,
      status: outcome.status === "fulfilled" ? outcome.value : "unknown",
    };
  });
}
