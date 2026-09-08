/**
 * Free, unauthenticated Instagram source — the JSON endpoint instagram.com's
 * own logged-out frontend calls when it renders a profile page.
 *
 * Why this exists: every piece of real Instagram data on this site went
 * through one paid vendor (Apify), so when that account hit its monthly usage
 * limit, the engagement calculator, competitor analyzer, and every uncached
 * profile went down together. This is the first link of a chain that keeps
 * working when the paid link doesn't — and for profile/posts/reels it is also
 * simply better: one ~300ms request returns the profile *and* its recent
 * posts, where the Apify path needs two separate billed actor runs.
 *
 * What it is not: a login. `x-ig-app-id` identifies Instagram's *web app*, not
 * a user — it is a constant in instagram.com's own public client bundle, sent
 * by every logged-out browser. No credential, cookie, or session is used or
 * stored anywhere in this file.
 *
 * Known constraint (verified live): Instagram refuses this endpoint from
 * datacenter IPs with `401 {"require_login": true}`. It returns `null` there,
 * and the caller falls through to Apify — so on a blocked IP this costs one
 * fast request and changes nothing, while on an unblocked one it serves the
 * whole result for free. Every failure mode is `null`, never a partial or
 * zero-filled Profile.
 */
import type { Post, Profile } from "@/lib/domain/types";
import { ProfileNotFoundError } from "../types";
import { coverageFor, MEMBER_FETCH_CAP } from "../coverage";

const WEB_PROFILE_INFO_URL = "https://i.instagram.com/api/v1/users/web_profile_info/";

/** Instagram's public web-client app id — see the file header. Not a credential. */
const IG_WEB_APP_ID = "936619743392459";

const FETCH_TIMEOUT_MS = 15_000;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface TimelineNode {
  id?: unknown;
  shortcode?: unknown;
  display_url?: unknown;
  thumbnail_src?: unknown;
  is_video?: unknown;
  product_type?: unknown;
  video_view_count?: unknown;
  taken_at_timestamp?: unknown;
  edge_liked_by?: { count?: unknown };
  edge_media_preview_like?: { count?: unknown };
  edge_media_to_comment?: { count?: unknown };
  edge_media_to_caption?: { edges?: Array<{ node?: { text?: unknown } }> };
}

export interface WebProfileUser {
  id?: unknown;
  username: string;
  full_name?: unknown;
  biography?: unknown;
  profile_pic_url?: unknown;
  profile_pic_url_hd?: unknown;
  is_verified?: unknown;
  is_private?: unknown;
  edge_followed_by: { count: number };
  edge_follow: { count: number };
  edge_owner_to_timeline_media: { count?: unknown; edges?: Array<{ node?: TimelineNode }> };
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Rejects anything that isn't recognisably a real user object with real
 * counts. This guard is load-bearing rather than defensive noise: the counts
 * feed the snapshot and diff engines, so silently mapping a changed or
 * truncated response into a `Profile` full of zeros wouldn't just show a wrong
 * number once — it would record a fake "lost all followers" event in a
 * visitor's tracking history. A shape we don't recognise must degrade to
 * `null` so the caller falls through to Apify, never to a plausible-looking
 * profile built from missing fields.
 */
function isWebProfileUser(value: unknown): value is WebProfileUser {
  if (typeof value !== "object" || value === null) return false;
  const user = value as Record<string, unknown>;
  if (typeof user.username !== "string" || user.username.length === 0) return false;

  const followedBy = user.edge_followed_by as { count?: unknown } | undefined;
  const follow = user.edge_follow as { count?: unknown } | undefined;
  if (!isNumber(followedBy?.count) || !isNumber(follow?.count)) return false;

  return typeof user.edge_owner_to_timeline_media === "object" && user.edge_owner_to_timeline_media !== null;
}

/**
 * Returns the user object, or `null` when this source couldn't answer
 * (blocked, rate-limited, timed out, or an unrecognised response shape).
 *
 * Throws `ProfileNotFoundError` only on a real 404 — that is a genuine fact
 * about the profile rather than a source failure, so it must propagate instead
 * of triggering a pointless paid retry against Apify for a user who does not
 * exist.
 */
export async function fetchWebProfileInfo(username: string): Promise<WebProfileUser | null> {
  const url = `${WEB_PROFILE_INFO_URL}?username=${encodeURIComponent(username)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "x-ig-app-id": IG_WEB_APP_ID,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    return null;
  }

  if (res.status === 404) {
    throw new ProfileNotFoundError(username);
  }
  if (res.status !== 200) {
    // 401 require_login / 429 rate-limited — expected on a blocked IP.
    console.warn(`[instagram-public] web_profile_info unavailable for ${username}: HTTP ${res.status}`);
    return null;
  }

  const body = await res.json().catch(() => null);
  const user = (body as { data?: { user?: unknown } } | null)?.data?.user;
  if (!isWebProfileUser(user)) {
    console.warn(`[instagram-public] web_profile_info returned an unrecognised shape for ${username}`);
    return null;
  }
  return user;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** Maps to the exact `Profile` shape the Apify path produces, reusing its own coverage math so the two sources stay indistinguishable downstream. */
export function toProfile(user: WebProfileUser): Profile {
  const followerCount = user.edge_followed_by.count;
  const followingCount = user.edge_follow.count;
  const postCount = isNumber(user.edge_owner_to_timeline_media.count)
    ? user.edge_owner_to_timeline_media.count
    : 0;

  return {
    id: `profile_${user.username}`,
    externalId: typeof user.id === "string" ? user.id : null,
    platform: "instagram",
    username: user.username,
    displayName: text(user.full_name) || user.username,
    bio: text(user.biography),
    avatarUrl: text(user.profile_pic_url_hd) || text(user.profile_pic_url),
    isVerified: user.is_verified === true,
    isPrivate: user.is_private === true,
    followerCount,
    followingCount,
    postCount,
    followerCoverage: coverageFor(Math.min(followerCount, MEMBER_FETCH_CAP), followerCount),
    followingCoverage: coverageFor(Math.min(followingCount, MEMBER_FETCH_CAP), followingCount),
  };
}

/**
 * `product_type === "clips"` is Instagram's own marker for a reel. That's a
 * real accuracy gain, not just a free one: the Apify path can't separate reels
 * from ordinary videos (documented in docs/KNOWN_LIMITATIONS.md) and settles
 * for `type === "Video"`, which labels every video post a reel.
 */
function mediaTypeOf(node: TimelineNode): Post["mediaType"] {
  if (node.product_type === "clips") return "reel";
  return node.is_video === true ? "video" : "image";
}

function captionOf(node: TimelineNode): string {
  return text(node.edge_media_to_caption?.edges?.[0]?.node?.text);
}

function likeCountOf(node: TimelineNode): number {
  // Instagram serves the like count under either key depending on the surface;
  // whichever is present is the same number.
  if (isNumber(node.edge_liked_by?.count)) return node.edge_liked_by.count;
  if (isNumber(node.edge_media_preview_like?.count)) return node.edge_media_preview_like.count;
  return 0;
}

/**
 * The same response that carries the profile also carries its most recent
 * posts (typically 12), so a caller that needs both — the engagement
 * calculator, for one — gets them from a single request.
 *
 * Nodes missing an id or shortcode are dropped rather than emitted with
 * placeholder values: a post whose permalink doesn't resolve is worse than one
 * absent post in a 12-post engagement sample.
 */
export function toPosts(user: WebProfileUser, profileId: string): Post[] {
  const edges = user.edge_owner_to_timeline_media.edges ?? [];

  return edges.flatMap(({ node }) => {
    if (!node || typeof node.id !== "string" || typeof node.shortcode !== "string") return [];

    const mediaUrl = text(node.display_url);
    return [
      {
        id: node.id,
        profileId,
        mediaType: mediaTypeOf(node),
        thumbnailUrl: text(node.thumbnail_src) || mediaUrl,
        mediaUrl,
        permalink: `https://www.instagram.com/p/${node.shortcode}/`,
        caption: captionOf(node),
        likeCount: likeCountOf(node),
        commentCount: isNumber(node.edge_media_to_comment?.count) ? node.edge_media_to_comment.count : 0,
        viewCount: isNumber(node.video_view_count) ? node.video_view_count : null,
        postedAt: isNumber(node.taken_at_timestamp)
          ? new Date(node.taken_at_timestamp * 1000).toISOString()
          : new Date(0).toISOString(),
      },
    ];
  });
}
