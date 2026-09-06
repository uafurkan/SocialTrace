import type { Comment, CursorPage, Highlight, Liker, Post, SocialUser, Story, TaggedPost } from "@/lib/domain/types";
import { paginate } from "../../paginate";
import type { ProviderCapabilities, SocialDataProvider } from "../../types";
import { fetchApifyTikTokComments } from "./comments";
import { fetchApifyTikTokMembers } from "./followers";
import { fetchApifyTikTokPosts } from "./posts";
import { MEMBER_FETCH_CAP, fetchApifyTikTokProfile } from "./profile";

function usernameFromProfileId(profileId: string): string {
  return profileId.replace(/^profile_tiktok_/, "");
}

/**
 * TikTok has no stories/highlights/tagged-posts concept to scrape, and no
 * actor here exposes a per-video likers list (only aggregate counts) — so
 * those capabilities are honestly false rather than faked, same pattern
 * the Instagram provider uses for gaps in its own actor coverage.
 */
export class ApifyTikTokProvider implements SocialDataProvider {
  readonly capabilities: ProviderCapabilities = {
    profile: true,
    posts: true,
    reels: false,
    stories: false,
    highlights: false,
    taggedPosts: false,
    postEngagement: true,
    followers: true,
    following: true,
    followerHistory: false,
  };

  async getProfile(username: string) {
    return { profile: await fetchApifyTikTokProfile(username) };
  }

  async getPosts(profileId: string, cursor?: string, limit = 24): Promise<CursorPage<Post>> {
    const username = usernameFromProfileId(profileId);
    const offset = cursor ? Number.parseInt(cursor, 10) || 0 : 0;
    const all = await fetchApifyTikTokPosts(username, profileId, offset + limit);
    return paginate(all, cursor, limit);
  }

  async getReels(): Promise<CursorPage<Post>> {
    return { items: [], nextCursor: null, totalCount: 0 };
  }

  async getStories(): Promise<Story[]> {
    return [];
  }

  async getHighlights(): Promise<Highlight[]> {
    return [];
  }

  async getTaggedPosts(): Promise<TaggedPost[]> {
    return [];
  }

  async getLikers(): Promise<Liker[]> {
    return [];
  }

  async getComments(permalink: string, limit?: number): Promise<Comment[]> {
    return fetchApifyTikTokComments(permalink, limit);
  }

  async getFollowers(profileId: string, cursor?: string, limit = 100, query?: string): Promise<CursorPage<SocialUser>> {
    return this.buildMembers(profileId, "followers", cursor, limit, query);
  }

  async getFollowing(profileId: string, cursor?: string, limit = 100, query?: string): Promise<CursorPage<SocialUser>> {
    return this.buildMembers(profileId, "following", cursor, limit, query);
  }

  private async buildMembers(
    profileId: string,
    kind: "followers" | "following",
    cursor: string | undefined,
    limit: number,
    query?: string,
  ): Promise<CursorPage<SocialUser>> {
    const username = usernameFromProfileId(profileId);
    const all = await fetchApifyTikTokMembers(username, kind, MEMBER_FETCH_CAP);
    const filtered = query ? all.filter((u) => u.username.toLowerCase().includes(query.toLowerCase())) : all;
    return paginate(filtered, cursor, limit);
  }
}

export const apifyTikTokProvider = new ApifyTikTokProvider();
