import type { CursorPage, Post, SocialUser, Story } from "@/lib/domain/types";
import { paginate } from "../paginate";
import type { ProviderCapabilities, SocialDataProvider } from "../types";
import { fetchMembers } from "./followers";
import { fetchApifyPosts } from "./posts";
import { MEMBER_FETCH_CAP, fetchApifyProfile } from "./profile";
import { fetchApifyReels } from "./reels";
import { fetchApifyStories } from "./stories";

function usernameFromProfileId(profileId: string): string {
  return profileId.replace(/^profile_/, "");
}

export class ApifyInstagramProvider implements SocialDataProvider {
  readonly capabilities: ProviderCapabilities = {
    profile: true,
    posts: true,
    reels: true,
    stories: true,
    highlights: false,
    followers: true,
    following: true,
    followerHistory: false,
  };

  async getProfile(username: string) {
    return { profile: await fetchApifyProfile(username) };
  }

  async getPosts(profileId: string, cursor?: string, limit = 24): Promise<CursorPage<Post>> {
    const username = usernameFromProfileId(profileId);
    const all = await fetchApifyPosts(username, profileId);
    return paginate(all, cursor, limit);
  }

  async getReels(profileId: string, cursor?: string, limit = 24): Promise<CursorPage<Post>> {
    const username = usernameFromProfileId(profileId);
    // Dedicated reels dataset (apify/instagram-reel-scraper) — fetch enough
    // up front to satisfy the requested page plus whatever's already been
    // paged through, since the actor has no native cursor of its own.
    const offset = cursor ? Number.parseInt(cursor, 10) || 0 : 0;
    const all = await fetchApifyReels(username, profileId, offset + limit);
    return paginate(all, cursor, limit);
  }

  async getStories(profileId: string): Promise<Story[]> {
    const username = usernameFromProfileId(profileId);
    return fetchApifyStories(username, profileId);
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
    const all = await fetchMembers(username, kind, MEMBER_FETCH_CAP);
    const filtered = query ? all.filter((u) => u.username.toLowerCase().includes(query.toLowerCase())) : all;
    return paginate(filtered, cursor, limit);
  }
}

export const apifyProvider = new ApifyInstagramProvider();
