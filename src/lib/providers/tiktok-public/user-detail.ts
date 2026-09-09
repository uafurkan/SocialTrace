/**
 * Free, unauthenticated TikTok source — the JSON TikTok's own logged-out
 * profile page embeds in a `<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">`
 * tag to hydrate the page client-side. Every visitor's browser downloads this
 * on every profile view without ever logging in; reading it here is the same
 * act, just server-side instead of client-side.
 *
 * Why this exists: the TikTok Apify actor is the only path to a TikTok
 * profile today, so an exhausted Apify quota takes down every *uncached*
 * TikTok profile (a cached one still renders via the stale-on-error fallback
 * in profile-cache.ts). This mirrors the free Instagram source
 * (../instagram-public/web-profile-info.ts) exactly: same free-first,
 * null-on-any-doubt contract, same reason it's not a login (no cookie, no
 * session, no credential — a public HTML page fetched anonymously).
 *
 * Known gap: this page's embedded JSON carries the profile and its stats but
 * an empty `itemList` — TikTok loads the video grid via a separate,
 * harder-to-replicate endpoint. So this source covers profile only; posts
 * stay on the Apify path (see profile.ts for the equivalent Instagram case
 * where one response covers both).
 */
import type { Profile } from "@/lib/domain/types";
import { ProfileNotFoundError } from "../types";
import { coverageFor, MEMBER_FETCH_CAP } from "../coverage";

const FETCH_TIMEOUT_MS = 15_000;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const REHYDRATION_SCRIPT_RE =
  /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/;

/** TikTok's own "no such user" code, confirmed live against a nonexistent handle. */
const USER_NOT_FOUND_STATUS_CODE = 10221;

interface TikTokUserDetailUser {
  id?: unknown;
  uniqueId: string;
  nickname?: unknown;
  signature?: unknown;
  avatarLarger?: unknown;
  avatarMedium?: unknown;
  verified?: unknown;
  privateAccount?: unknown;
  secUid?: unknown;
}

interface TikTokUserDetailStats {
  followerCount?: unknown;
  followingCount?: unknown;
  videoCount?: unknown;
}

export interface TikTokUserDetail {
  user: TikTokUserDetailUser;
  stats: TikTokUserDetailStats;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/**
 * Rejects anything that isn't recognisably a real user + stats pair — the
 * same load-bearing guard as the Instagram source's `isWebProfileUser`. A
 * shape TikTok has changed must degrade to `null`, never to a `Profile`
 * built from missing fields that would poison the snapshot/diff engine.
 */
function isUserDetail(value: unknown): value is TikTokUserDetail {
  if (typeof value !== "object" || value === null) return false;
  const detail = value as Record<string, unknown>;
  const user = detail.user as Record<string, unknown> | undefined;
  const stats = detail.stats as Record<string, unknown> | undefined;
  if (typeof user?.uniqueId !== "string" || user.uniqueId.length === 0) return false;
  return isNumber(stats?.followerCount) && isNumber(stats?.followingCount);
}

/**
 * Returns the parsed user-detail payload, or `null` when this source
 * couldn't answer (network failure, unexpected HTML, unrecognised shape) —
 * the caller falls through to Apify exactly as with the Instagram source.
 *
 * Throws `ProfileNotFoundError` only on TikTok's own confirmed "no such
 * user" status code — a real fact about the profile, not a source failure.
 */
export async function fetchTikTokUserDetail(username: string): Promise<TikTokUserDetail | null> {
  const url = `https://www.tiktok.com/@${encodeURIComponent(username)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    return null;
  }

  if (res.status !== 200) {
    console.warn(`[tiktok-public] user-detail page unavailable for ${username}: HTTP ${res.status}`);
    return null;
  }

  const html = await res.text().catch(() => null);
  const match = html ? REHYDRATION_SCRIPT_RE.exec(html) : null;
  if (!match) {
    console.warn(`[tiktok-public] rehydration script not found for ${username}`);
    return null;
  }

  const body = JSON.parse(match[1]) as { __DEFAULT_SCOPE__?: Record<string, unknown> };
  const userDetailModule = body.__DEFAULT_SCOPE__?.["webapp.user-detail"] as
    | { userInfo?: unknown; statusCode?: unknown }
    | undefined;

  if (userDetailModule?.statusCode === USER_NOT_FOUND_STATUS_CODE) {
    throw new ProfileNotFoundError(username);
  }

  const userInfo = userDetailModule?.userInfo;
  if (!isUserDetail(userInfo)) {
    console.warn(`[tiktok-public] user-detail returned an unrecognised shape for ${username}`);
    return null;
  }
  return userInfo;
}

/** Maps to the exact `Profile` shape the Apify path produces. */
export function toProfile(detail: TikTokUserDetail): Profile {
  const followerCount = detail.stats.followerCount as number;
  const followingCount = detail.stats.followingCount as number;
  const { user } = detail;

  return {
    id: `profile_tiktok_${user.uniqueId}`,
    externalId: typeof user.id === "string" ? user.id : text(user.secUid) || null,
    platform: "tiktok",
    username: user.uniqueId,
    displayName: text(user.nickname) || user.uniqueId,
    bio: text(user.signature),
    avatarUrl: text(user.avatarLarger) || text(user.avatarMedium),
    isVerified: user.verified === true,
    isPrivate: user.privateAccount === true,
    followerCount,
    followingCount,
    postCount: isNumber(detail.stats.videoCount) ? detail.stats.videoCount : 0,
    followerCoverage: coverageFor(Math.min(followerCount, MEMBER_FETCH_CAP), followerCount),
    followingCoverage: coverageFor(Math.min(followingCount, MEMBER_FETCH_CAP), followingCount),
  };
}
