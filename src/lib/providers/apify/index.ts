import type { CursorPage, Post, SocialUser } from "@/lib/domain/types";
import { paginate } from "../paginate";
import type { ProviderCapabilities, SocialDataProvider } from "../types";
import { fetchMembers } from "./followers";
import { fetchApifyPosts } from "./posts";
import { MEMBER_FETCH_CAP, fetchApifyProfile } from "./profile";

function usernameFromProfileId(profileId: string): string {
  return profileId.replace(/^profile_/, "");
}

export class ApifyInstagramProvider implements SocialDataProvider {
  readonly capabilities: ProviderCapabilities = {
    profile: true,
    posts: true,
    reels: true,
    stories: false,
    highlights: false,
    followers: true,
    following: true,
    followerHistory: false,
  };

  async getProfile(username: string) {
    return { profile: await fetchApifyProfile(username) };
  }

  async getPosts(profileId: string, cursor?: string, limit = 24): Promise<CursorPage<Post>> {
    return this.buildPosts(profileId, "image", cursor, limit);
  }

  async getReels(profileId: string, cursor?: string, limit = 24): Promise<CursorPage<Post>> {
    return this.buildPosts(profileId, "reel", cursor, limit);
  }

  private async buildPosts(
    profileId: string,
    mediaType: "image" | "reel",
    cursor: string | undefined,
    limit: number,
  ): Promise<CursorPage<Post>> {
    const username = usernameFromProfileId(profileId);
    const all = await fetchApifyPosts(username, profileId);
    // latestPosts doesn't separate reels — approximate reels as videos (see posts.ts).
    const filtered = mediaType === "reel" ? all.filter((p) => p.mediaType === "video") : all;
    return paginate(filtered, cursor, limit);
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
