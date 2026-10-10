import type { Comment, Liker, Post, SocialUser } from "@/lib/domain/types";
import type { ExportBundle } from "./build";

/** Spec §155 — every export must self-declare a schema version, platform, and generation time. */
export const EXPORT_SCHEMA = "socialtrace.profile.v1";

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function userXml(tag: string, user: SocialUser): string {
  return `<${tag}><username>${xmlEscape(user.username)}</username><display_name>${xmlEscape(user.displayName)}</display_name><is_verified>${user.isVerified}</is_verified></${tag}>`;
}

function postXml(tag: string, post: Post): string {
  return `<${tag}><id>${xmlEscape(post.id)}</id><media_type>${post.mediaType}</media_type><caption>${xmlEscape(post.caption)}</caption><like_count>${post.likeCount}</like_count><comment_count>${post.commentCount}</comment_count><posted_at>${post.postedAt ?? ""}</posted_at></${tag}>`;
}

export function toExportXml(bundle: ExportBundle): string {
  const { profile } = bundle;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<socialtrace schema="${EXPORT_SCHEMA}" platform="${profile.platform}" generated_at="${new Date().toISOString()}">`,
    "<profile>",
    `<username>${xmlEscape(profile.username)}</username>`,
    `<display_name>${xmlEscape(profile.displayName)}</display_name>`,
    `<bio>${xmlEscape(profile.bio)}</bio>`,
    `<is_verified>${profile.isVerified}</is_verified>`,
    `<is_private>${profile.isPrivate}</is_private>`,
    "</profile>",
    "<statistics>",
    `<followers>${profile.followerCount}</followers>`,
    `<following>${profile.followingCount}</following>`,
    `<posts>${profile.postCount}</posts>`,
    "</statistics>",
    "<coverage>",
    `<followers percent="${profile.followerCoverage.coveragePercent}" indexed="${profile.followerCoverage.indexedCount}" total="${profile.followerCoverage.totalCount}" />`,
    `<following percent="${profile.followingCoverage.coveragePercent}" indexed="${profile.followingCoverage.indexedCount}" total="${profile.followingCoverage.totalCount}" />`,
    "</coverage>",
    `<posts_exported count="${bundle.posts.length}">${bundle.posts.map((p) => postXml("post", p)).join("")}</posts_exported>`,
    `<reels_exported count="${bundle.reels.length}">${bundle.reels.map((p) => postXml("reel", p)).join("")}</reels_exported>`,
    `<followers_exported count="${bundle.followers.length}">${bundle.followers.map((u) => userXml("user", u)).join("")}</followers_exported>`,
    `<following_exported count="${bundle.following.length}">${bundle.following.map((u) => userXml("user", u)).join("")}</following_exported>`,
    "</socialtrace>",
  ].join("\n");
}

export function toExportJson(bundle: ExportBundle): string {
  const { profile } = bundle;
  return JSON.stringify(
    {
      schema: EXPORT_SCHEMA,
      platform: profile.platform,
      generatedAt: new Date().toISOString(),
      profile: {
        username: profile.username,
        displayName: profile.displayName,
        bio: profile.bio,
        isVerified: profile.isVerified,
        isPrivate: profile.isPrivate,
      },
      statistics: {
        followers: profile.followerCount,
        following: profile.followingCount,
        posts: profile.postCount,
      },
      coverage: {
        followers: profile.followerCoverage,
        following: profile.followingCoverage,
      },
      postsExported: bundle.posts,
      reelsExported: bundle.reels,
      followersExported: bundle.followers,
      followingExported: bundle.following,
    },
    null,
    2,
  );
}

/**
 * Byte-order mark that opens a UTF-8 CSV file. Excel reads a CSV without it as
 * the system code page, which garbles non-ASCII text. It is added where the
 * file is produced (download or response), so the row serializers below keep
 * their exact output and the formula guard still sees each cell unchanged.
 */
export const CSV_BOM = "\uFEFF";

/** Quotes a cell that holds a delimiter, a quote, or a line break. Numbers and booleans never match, so they are written as-is. */
function csvCell(value: string | number | boolean): string {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Leading characters that Excel and Sheets read as a formula, or that they drop from the row (tab, CR). */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/** Free-text cell (CSV injection guard): a leading formula character gets a single quote before the usual quoting. */
function textCell(value: string): string {
  return csvCell(FORMULA_LEAD.test(value) ? `'${value}` : value);
}

/** Spec §158 — follower/following CSV columns, minus first_seen_at/last_seen_at (no snapshot history exists yet to populate them). */
export function toMemberCsv(users: SocialUser[]): string {
  const header = "platform_user_id,username,display_name,profile_url,is_verified";
  const rows = users.map((u) =>
    [
      textCell(u.id),
      textCell(u.username),
      textCell(u.displayName),
      textCell(`https://instagram.com/${u.username}`),
      csvCell(u.isVerified),
    ].join(","),
  );
  return [header, ...rows].join("\n");
}

export function toPostCsv(posts: Post[]): string {
  const header = "id,media_type,caption,like_count,comment_count,view_count,posted_at";
  const rows = posts.map((p) =>
    [
      textCell(p.id),
      csvCell(p.mediaType),
      textCell(p.caption),
      csvCell(p.likeCount),
      csvCell(p.commentCount),
      csvCell(p.viewCount ?? ""),
      csvCell(p.postedAt ?? ""),
    ].join(","),
  );
  return [header, ...rows].join("\n");
}

/** Post likers CSV. The Liker type carries no profile URL, so none is written. */
export function toLikerCsv(likers: Liker[]): string {
  const header = "username,display_name,verified";
  const rows = likers.map((l) =>
    [textCell(l.username), textCell(l.displayName), csvCell(l.isVerified ? "yes" : "no")].join(","),
  );
  return [header, ...rows].join("\n");
}

/** Post comments CSV. postedAt is an empty cell when the source gave no valid date. */
export function toCommentCsv(comments: Comment[]): string {
  const header = "author_username,text,like_count,posted_at";
  const rows = comments.map((c) =>
    [textCell(c.authorUsername), textCell(c.text), csvCell(c.likeCount), csvCell(c.postedAt ?? "")].join(","),
  );
  return [header, ...rows].join("\n");
}
