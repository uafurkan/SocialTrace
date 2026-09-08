export type AvailabilityPlatform = "instagram" | "tiktok" | "facebook" | "youtube";

export interface AvailabilityResult {
  platform: AvailabilityPlatform;
  handle: string;
  status: "available" | "taken" | "unknown";
}

/**
 * What a single check method learned. `null` means "this method learned
 * nothing" — deliberately distinct from `"unknown"`, which is the final
 * answer only once every method for a platform has been tried. Keeping the
 * two separate is what lets the chains below express "try the next source"
 * without ever letting an inconclusive intermediate result reach the user
 * dressed up as an answer.
 */
type MethodResult = AvailabilityResult["status"] | null;

/**
 * Same value as media/proxy's own FETCH_TIMEOUT_MS (src/app/api/v1/media/proxy/route.ts)
 * — kept as a separate constant because route.ts files can only export
 * Next.js route handlers, not arbitrary values, so importing it isn't possible.
 */
const FETCH_TIMEOUT_MS = 15_000;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchWithTimeout(url: string, extraHeaders?: Record<string, string>): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: { "User-Agent": USER_AGENT, ...extraHeaders },
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
 * Instagram's public web-client application id — a constant hardcoded in
 * instagram.com's own client-side bundle and sent by every logged-out
 * browser that loads a profile page. It identifies the *web app*, not a
 * user: it is not a credential, not a secret, and not tied to any account.
 */
const IG_WEB_APP_ID = "936619743392459";

/**
 * The JSON endpoint instagram.com's own logged-out frontend calls. When it
 * answers, it is unambiguous (404 vs. a real user object) — far better than
 * the HTML page below, which is behind a login wall.
 *
 * Verified this session: Instagram refuses this endpoint from *this*
 * environment's datacenter IP with `401 {"require_login": true}`, so the
 * chain falls straight through to the page check here. It is kept as the
 * first link because IP reputation is the only thing gating it — from a
 * residential or production IP that isn't rate-limited it answers normally,
 * and when it does we get a definitive result for free. Any non-200/404
 * (401, 429, 403) is treated as "learned nothing", never as an answer.
 */
async function instagramViaWebProfileInfo(handle: string): Promise<MethodResult> {
  const res = await fetchWithTimeout(
    `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`,
    { "x-ig-app-id": IG_WEB_APP_ID, Accept: "application/json" },
  );
  if (!res) return null;
  if (res.status === 404) return "available";
  if (res.status !== 200) return null;

  const body = await res.json().catch(() => null);
  const username = (body as { data?: { user?: { username?: unknown } } } | null)?.data?.user?.username;
  return typeof username === "string" ? "taken" : null;
}

/**
 * The original method. Instagram redirects *every* unauthenticated request —
 * taken or available alike — to its login page from this environment, with no
 * distinguishing marker, so in practice this returns `null` (learned nothing)
 * rather than an answer. Retained because it costs one request and does
 * answer from IPs Instagram hasn't walled off.
 */
async function instagramViaProfilePage(handle: string): Promise<MethodResult> {
  const res = await fetchWithTimeout(`https://www.instagram.com/${encodeURIComponent(handle)}/`);
  if (!res) return null;
  if (res.status === 404) return "available";
  if (res.status === 200) {
    const body = await res.text();
    if (/"is_private"|"edge_followed_by"/.test(body)) return "taken";
  }
  return null;
}

async function checkInstagram(handle: string): Promise<AvailabilityResult["status"]> {
  return (await instagramViaWebProfileInfo(handle)) ?? (await instagramViaProfilePage(handle)) ?? "unknown";
}

/**
 * Facebook's public Graph API discriminates without any access token, but
 * only in one direction — verified live this session against real handles:
 *
 *   nike / cocacola / bbcnews  -> 403, error.code 200 ("Provide valid app ID")
 *   zuck                       -> 400, error.code 100 / subcode 33
 *   <nonsense handle>          -> 400, error.code 100 / subcode 33
 *
 * Code 200 is definitive: Facebook resolved the alias to a real object and
 * only then complained about the missing token. So `code === 200` proves
 * **taken**.
 *
 * The reverse does NOT hold, and this is the trap worth spelling out:
 * `zuck` is a real profile that has existed since 2004, yet it returns the
 * exact same code/subcode as a handle nobody has ever registered. Facebook
 * stopped exposing personal profiles through Graph years ago, so "personal
 * profile" and "does not exist" are permanently indistinguishable here.
 * Reporting code 100 as `"available"` would confidently tell a visitor that
 * a taken handle is free — the single worst answer this tool can give — so
 * it returns `null` instead and the chain ends at `"unknown"`.
 */
async function facebookViaGraphAlias(handle: string): Promise<MethodResult> {
  const res = await fetchWithTimeout(`https://graph.facebook.com/${encodeURIComponent(handle)}`, {
    Accept: "application/json",
  });
  if (!res) return null;

  const body = await res.json().catch(() => null);
  const code = (body as { error?: { code?: unknown } } | null)?.error?.code;
  return code === 200 ? "taken" : null;
}

/** Same login-wall situation as Instagram's page check — kept as a second opinion, expected to be inconclusive. */
async function facebookViaProfilePage(handle: string): Promise<MethodResult> {
  const res = await fetchWithTimeout(`https://www.facebook.com/${encodeURIComponent(handle)}`);
  if (!res) return null;
  if (res.status === 200) {
    const body = await res.text();
    if (/"page_id"|"profile_id"/.test(body)) return "taken";
  }
  return null;
}

async function checkFacebook(handle: string): Promise<AvailabilityResult["status"]> {
  return (await facebookViaGraphAlias(handle)) ?? (await facebookViaProfilePage(handle)) ?? "unknown";
}

/**
 * TikTok returns HTTP 200 for taken and available handles alike, but its
 * embedded initial-state JSON carries a *positive* marker for each case —
 * both confirmed live this session:
 *
 *   taken      -> "uniqueId":"<handle>"  (and "statusCode":0)
 *   available  -> "statusCode":10221     (TikTok's own user-not-found code)
 *
 * Both answers are positively confirmed rather than one being inferred from
 * the other's absence. That matters: the earlier version read "no uniqueId"
 * as available, so if TikTok ever renamed that key or served an interstitial,
 * every handle on earth would have reported as free to register. Now an
 * unrecognized shape returns `null` and ends at `"unknown"`.
 */
async function checkTikTok(handle: string): Promise<AvailabilityResult["status"]> {
  const res = await fetchWithTimeout(`https://www.tiktok.com/@${encodeURIComponent(handle)}`);
  if (!res) return "unknown";
  if (res.status === 404) return "available";
  if (res.status !== 200) return "unknown";

  const body = await res.text();
  if (body.includes(`"uniqueId":"${handle.toLowerCase()}"`)) return "taken";
  if (body.includes('"statusCode":10221')) return "available";
  return "unknown";
}

/**
 * YouTube gives a clean, reliable signal — confirmed live this session:
 * a real handle's page returns 200, an unregistered one returns 404.
 */
async function checkYouTube(handle: string): Promise<AvailabilityResult["status"]> {
  const res = await fetchWithTimeout(`https://www.youtube.com/@${encodeURIComponent(handle)}`);
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
