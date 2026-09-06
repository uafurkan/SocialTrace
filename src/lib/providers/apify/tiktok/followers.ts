import type { SocialUser } from "@/lib/domain/types";
import { runApifyActor } from "../client";

const FOLLOWERS_ACTOR_ID = "clockworks~tiktok-followers-scraper";

interface TikTokConnectionItem {
  authorMeta?: {
    id: string;
    name: string;
    nickName?: string;
    avatar?: string;
    verified?: boolean;
  };
  connectionType?: "follower" | "following";
}

/** Fetches both followers and following in one actor call — cheaper than two separate runs, filtered client-side by connectionType. */
export async function fetchApifyTikTokMembers(
  username: string,
  kind: "followers" | "following",
  cap: number,
): Promise<SocialUser[]> {
  const items = (await runApifyActor(FOLLOWERS_ACTOR_ID, {
    profiles: [username],
    maxFollowersPerProfile: kind === "followers" ? cap : 0,
    maxFollowingPerProfile: kind === "following" ? cap : 0,
    shouldDownloadAvatars: false,
  })) as TikTokConnectionItem[];

  if (!Array.isArray(items)) return [];

  const wantType = kind === "followers" ? "follower" : "following";
  return items
    .filter((item) => item.connectionType === wantType && item.authorMeta?.name)
    .map((item) => ({
      id: `tiktok_user_${item.authorMeta!.id}`,
      platform: "tiktok" as const,
      username: item.authorMeta!.name,
      displayName: item.authorMeta!.nickName || item.authorMeta!.name,
      avatarUrl: item.authorMeta!.avatar ?? "",
      isVerified: item.authorMeta!.verified ?? false,
    }));
}
