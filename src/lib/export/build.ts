import type { CursorPage, Post, Profile, SocialUser } from "@/lib/domain/types";
import { provider } from "@/lib/providers";

/**
 * Spec §29 describes exports as background jobs with queueing, streaming,
 * and signed-URL delivery — infrastructure this build doesn't have yet (no
 * job queue, no auth, no blob storage; see docs/KNOWN_LIMITATIONS.md).
 * Instead this generates a bounded export synchronously inside the API
 * request. The cap keeps that request fast and keeps the Apify provider's
 * per-result billing predictable regardless of a profile's real follower
 * count.
 */
export const EXPORT_LIST_LIMIT = 500;
const PAGE_SIZE = 100;

async function collect<T>(fetchPage: (cursor: string | undefined) => Promise<CursorPage<T>>, limit: number): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  do {
    const page = await fetchPage(cursor);
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor && items.length < limit);
  return items.slice(0, limit);
}

export interface ExportBundle {
  profile: Profile;
  posts: Post[];
  reels: Post[];
  followers: SocialUser[];
  following: SocialUser[];
}

export async function buildExportBundle(username: string): Promise<ExportBundle> {
  const { profile } = await provider.getProfile(username);
  const [posts, reels, followers, following] = await Promise.all([
    collect((cursor) => provider.getPosts(profile.id, cursor, PAGE_SIZE), EXPORT_LIST_LIMIT),
    collect((cursor) => provider.getReels(profile.id, cursor, PAGE_SIZE), EXPORT_LIST_LIMIT),
    collect((cursor) => provider.getFollowers(profile.id, cursor, PAGE_SIZE), EXPORT_LIST_LIMIT),
    collect((cursor) => provider.getFollowing(profile.id, cursor, PAGE_SIZE), EXPORT_LIST_LIMIT),
  ]);
  return { profile, posts, reels, followers, following };
}
