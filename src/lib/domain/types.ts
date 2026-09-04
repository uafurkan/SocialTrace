/**
 * Canonical domain models (spec §31), trimmed to what the UI needs in this
 * frontend-only slice. No persistence yet — these types are the intended
 * 1:1 shape of the future `profiles` / `social_users` / `media_items`
 * tables (see docs/DATA_MODEL.md), so introducing the real DB later is a
 * mapping exercise, not a redesign.
 */

export type Platform = "instagram";

/** Spec §1.2 — every data surface must disclose how complete it is. */
export interface CoverageStatus {
  status: "available" | "partial" | "unavailable";
  /** 0-100. */
  coveragePercent: number;
  indexedCount: number;
  totalCount: number;
  lastCheckedAt: string;
}

export interface Profile {
  id: string;
  platform: Platform;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  isVerified: boolean;
  isPrivate: boolean;
  followerCount: number;
  followingCount: number;
  postCount: number;
  followerCoverage: CoverageStatus;
  followingCoverage: CoverageStatus;
}

export interface SocialUser {
  id: string;
  platform: Platform;
  username: string;
  displayName: string;
  avatarUrl: string;
  isVerified: boolean;
}

export type PostMediaType = "image" | "video" | "reel";

export interface Post {
  id: string;
  profileId: string;
  mediaType: PostMediaType;
  thumbnailUrl: string;
  caption: string;
  likeCount: number;
  commentCount: number;
  viewCount: number | null;
  postedAt: string;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  totalCount: number;
}
