export type AvailabilityPlatform = "instagram" | "tiktok" | "facebook" | "youtube";

export interface AvailabilityResult {
  platform: AvailabilityPlatform;
  handle: string;
  status: "available" | "taken" | "unknown";
}

/**
 * Same value as media/proxy's own FETCH_TIMEOUT_MS (src/app/api/v1/media/proxy/route.ts)
 * — kept as a separate constant because route.ts files can only export
 * Next.js route handlers, not arbitrary values, so importing it isn't possible.
 */
const FETCH_TIMEOUT_MS = 15_000;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchWithTimeout(url: string): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
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
 * Instagram and Facebook were checked live against real taken and available
 * handles this session: both platforms redirect *every* unauthenticated
 * request — taken or available alike — to their login page from this
 * environment's outbound IP, with no distinguishing marker anywhere in the
 * response. There is no reliable signal to read here, so both checks return
 * "unknown" whenever that login-redirect pattern is seen, rather than
 * guessing either way — see docs/DECISIONS.md.
 */
async function checkInstagram(handle: string): Promise<AvailabilityResult["status"]> {
  const res = await fetchWithTimeout(`https://www.instagram.com/${encodeURIComponent(handle)}/`);
  if (!res) return "unknown";
  if (res.status === 404) return "available";
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location") ?? "";
    if (location.includes("/accounts/login/")) return "unknown";
  }
  if (res.status === 200) {
    const body = await res.text();
    if (/"is_private"|"edge_followed_by"/.test(body)) return "taken";
  }
  return "unknown";
}

async function checkFacebook(handle: string): Promise<AvailabilityResult["status"]> {
  const res = await fetchWithTimeout(`https://www.facebook.com/${encodeURIComponent(handle)}`);
  if (!res) return "unknown";
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location") ?? "";
    if (location.includes("/login/")) return "unknown";
  }
  if (res.status === 200) {
    const body = await res.text();
    if (/"page_id"|"profile_id"/.test(body)) return "taken";
  }
  return "unknown";
}

/**
 * TikTok returns HTTP 200 for both taken and available handles (no useful
 * status-code signal — confirmed live this session), but a taken profile's
 * page embeds `"uniqueId":"<handle>"` in its initial-state JSON, which is
 * absent for an available handle. Confirmed against two real, well-known
 * accounts and one clearly-unregistered handle.
 */
async function checkTikTok(handle: string): Promise<AvailabilityResult["status"]> {
  const res = await fetch(`https://www.tiktok.com/@${encodeURIComponent(handle)}`, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  }).catch(() => null);
  if (!res || !res.ok) return "unknown";
  const body = await res.text();
  return body.includes(`"uniqueId":"${handle.toLowerCase()}"`) ? "taken" : "available";
}

/**
 * YouTube gives a clean, reliable signal — confirmed live this session:
 * a real handle's page returns 200, an unregistered one returns 404.
 */
async function checkYouTube(handle: string): Promise<AvailabilityResult["status"]> {
  const res = await fetch(`https://www.youtube.com/@${encodeURIComponent(handle)}`, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  }).catch(() => null);
  if (!res) return "unknown";
  if (res.status === 404) return "available";
  if (res.status === 200) return "taken";
  return "unknown";
}

const CHECKERS: Record<AvailabilityPlatform, (handle: string) => Promise<AvailabilityResult["status"]>> = {
  instagram: checkInstagram,
  tiktok: checkTikTok,
  facebook: checkFacebook,
  youtube: checkYouTube,
};

/** Each platform's own allowed-character rule — rejecting obviously-invalid input costs nothing and avoids spending an outbound request on it. */
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
