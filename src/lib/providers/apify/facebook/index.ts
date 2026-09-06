import type { Comment, CursorPage, Highlight, Liker, Post, SocialUser, Story, TaggedPost } from "@/lib/domain/types";
import { paginate } from "../../paginate";
import type { ProviderCapabilities, SocialDataProvider } from "../../types";
import { fetchApifyFacebookComments } from "./comments";
import { fetchApifyFacebookPosts } from "./posts";
import { fetchApifyFacebookProfile } from "./profile";

function usernameFromProfileId(profileId: string): string {
  return profileId.replace(/^profile_facebook_/, "");
}

/**
 * Facebook Pages have no public follower/following LIST (only a count —
 * Meta doesn't expose one, unlike Instagram/TikTok's follower-scraper
 * actors), and no stories/highlights/tagged-posts/per-post-likers actor
 * was found either — every one of those capabilities is honestly false
 * rather than faked. getFollowers/getFollowing throw rather than silently
 * returning an empty page, since "empty" would misleadingly look like a
 * page with zero followers instead of "this list can't be fetched at all".
 */
export class ApifyFacebookProvider implements SocialDataProvider {
  readonly capabilities: ProviderCapabilities = {
    profile: true,
    posts: true,
    reels: false,
    stories: false,
    highlights: false,
    taggedPosts: false,
    postEngagement: true,
    followers: false,
    following: false,
    followerHistory: false,
  };

  async getProfile(username: string) {
    return { profile: await fetchApifyFacebookProfile(username) };
  }

  async getPosts(profileId: string, cursor?: string, limit = 24): Promise<CursorPage<Post>> {
    const username = usernameFromProfileId(profileId);
    const offset = cursor ? Number.parseInt(cursor, 10) || 0 : 0;
    const all = await fetchApifyFacebookPosts(username, profileId, offset + limit);
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
    return fetchApifyFacebookComments(permalink, limit);
  }

  async getFollowers(): Promise<CursorPage<SocialUser>> {
    throw new Error("Facebook Pages don't expose a follower list — see docs/PROVIDER_CONTRACT.md.");
  }

  async getFollowing(): Promise<CursorPage<SocialUser>> {
    throw new Error("Facebook Pages don't expose a following list — see docs/PROVIDER_CONTRACT.md.");
  }
}

export const apifyFacebookProvider = new ApifyFacebookProvider();
