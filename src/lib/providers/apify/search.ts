import type { SocialUser } from "@/lib/domain/types";
import { runApifyActor } from "./client";

const SEARCH_ACTOR_ID = "nkactors~instagram-search-users-api-no-cookies-fast-reliable";

interface ApifySearchUser {
  pk_id?: string;
  id?: string;
  username?: string;
  full_name?: string;
  profile_pic_url?: string;
  is_verified?: boolean;
}

interface ApifySearchResponse {
  query: string;
  result?: {
    num_results?: number;
    users?: ApifySearchUser[];
  };
}

/**
 * Real Instagram search-as-you-type takes ~6-7s per call (Apify actor
 * cold start, not something a debounce can fully hide) — see
 * docs/PROVIDER_CONTRACT.md. Results are cached per lowercased query for
 * the process lifetime so repeated keystrokes on the same finished query
 * (e.g. backspace-then-retype) don't re-bill/re-wait.
 */
const searchCache = new Map<string, SocialUser[]>();

export async function fetchApifyUserSearch(query: string, limit: number): Promise<SocialUser[]> {
  const key = query.trim().toLowerCase();
  if (!key) return [];

  const cached = searchCache.get(key);
  if (cached) return cached.slice(0, limit);

  const items = (await runApifyActor(SEARCH_ACTOR_ID, { query: key })) as ApifySearchResponse[];
  const users = items[0]?.result?.users ?? [];

  // Instagram's own endpoint already ranks by relevance; preserve that order.
  const normalized: SocialUser[] = users
    .filter((u) => typeof u.username === "string" && u.username.length > 0)
    .map((u) => ({
      id: `ig_${u.pk_id ?? u.id ?? u.username}`,
      platform: "instagram",
      username: u.username!,
      displayName: u.full_name || u.username!,
      avatarUrl: u.profile_pic_url ?? "",
      isVerified: u.is_verified ?? false,
    }));

  searchCache.set(key, normalized);
  return normalized.slice(0, limit);
}
