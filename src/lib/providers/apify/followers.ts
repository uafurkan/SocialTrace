import type { SocialUser } from "@/lib/domain/types";
import { runApifyActor } from "./client";

export type MemberKind = "followers" | "following";

interface ActorAttempt {
  actorId: string;
  /** Builds the actor's input for this call. `followsOnly` marks actors that can only scrape followers. */
  buildInput: (username: string, limit: number, kind: MemberKind) => Record<string, unknown>;
  /** Extracts the raw item array from the actor's response shape and normalizes each into a SocialUser. */
  normalize: (raw: unknown) => SocialUser[] | null;
  followersOnly?: boolean;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function bool(v: unknown): boolean {
  return v === true;
}

/** Field names verified against each actor's live output during development — see docs/PROVIDER_CONTRACT.md. */
const ACTOR_CHAIN: ActorAttempt[] = [
  {
    actorId: "apify~instagram-followers-following-scraper",
    buildInput: (username, limit, kind) => ({
      usernames: [username],
      dataToScrape: kind,
      resultsLimit: limit,
    }),
    normalize: (raw) => {
      if (!Array.isArray(raw)) return null;
      return raw.map((r) => {
        const item = r as Record<string, unknown>;
        return {
          id: `ig_${str(item.userId)}`,
          platform: "instagram",
          username: str(item.username),
          displayName: str(item.fullName) || str(item.username),
          avatarUrl: str(item.profilePicUrl),
          isVerified: bool(item.isVerified),
        };
      });
    },
  },
  {
    actorId: "scraping_solutions~instagram-scraper-followers-following-no-cookies",
    buildInput: (username, limit, kind) => ({
      Account: [username],
      resultsLimit: Math.max(limit, 50),
      dataToScrape: kind === "followers" ? "Followers" : "Followings",
    }),
    normalize: (raw) => {
      if (!Array.isArray(raw)) return null;
      return raw.map((r) => {
        const item = r as Record<string, unknown>;
        return {
          id: `ig_${str(item.id)}`,
          platform: "instagram",
          username: str(item.username),
          displayName: str(item.full_name) || str(item.username),
          avatarUrl: str(item.profile_pic_url),
          isVerified: bool(item.is_verified),
        };
      });
    },
  },
  {
    actorId: "datadoping~instagram-followers-scraper",
    followersOnly: true,
    buildInput: (username, limit) => ({
      usernames: [username],
      max_count: Math.max(limit, 50),
    }),
    normalize: (raw) => {
      if (!Array.isArray(raw)) return null;
      return raw.map((r) => {
        const item = r as Record<string, unknown>;
        return {
          id: `ig_${str(item.id)}`,
          platform: "instagram",
          username: str(item.username),
          displayName: str(item.full_name) || str(item.username),
          avatarUrl: str(item.profile_pic_url),
          isVerified: bool(item.is_verified),
        };
      });
    },
  },
  {
    actorId: "coderx~instagram-followers-following-scraper-no-cookies-login",
    buildInput: (username, limit, kind) => ({
      username,
      scrape_type: kind,
      max_items: Math.max(limit, 25),
    }),
    normalize: (raw) => {
      if (!Array.isArray(raw)) return null;
      return raw.map((r) => {
        const item = r as Record<string, unknown>;
        return {
          id: `ig_${str(item.id ?? item.pk)}`,
          platform: "instagram",
          username: str(item.username),
          displayName: str(item.full_name) || str(item.username),
          avatarUrl: str(item.profile_pic_url),
          isVerified: bool(item.is_verified),
        };
      });
    },
  },
  {
    actorId: "seemuapps~instagram-followers-scraper",
    buildInput: (username, limit, kind) => ({
      username,
      mode: kind,
      maxItems: limit,
    }),
    normalize: (raw) => {
      const results = (raw as { results?: unknown[] } | undefined)?.results;
      if (!Array.isArray(results)) return null;
      return results.map((r) => {
        const item = r as Record<string, unknown>;
        return {
          id: `ig_${str(item.userId)}`,
          platform: "instagram",
          username: str(item.username),
          displayName: str(item.displayName) || str(item.username),
          avatarUrl: str(item.profilePicUrl),
          isVerified: bool(item.isVerified),
        };
      });
    },
  },
];

/** Per-process cache so paginating an already-fetched list doesn't re-run (and re-bill) the actor chain. */
const memberCache = new Map<string, SocialUser[]>();

export async function fetchMembers(username: string, kind: MemberKind, limit: number): Promise<SocialUser[]> {
  const cacheKey = `${username}:${kind}`;
  const cached = memberCache.get(cacheKey);
  if (cached) return cached;

  const candidates = ACTOR_CHAIN.filter((actor) => !(actor.followersOnly && kind !== "followers"));

  for (const actor of candidates) {
    try {
      const raw = await runApifyActor(actor.actorId, actor.buildInput(username, limit, kind));
      const normalized = actor.normalize(raw);
      if (normalized && normalized.length > 0) {
        memberCache.set(cacheKey, normalized);
        return normalized;
      }
      console.warn(`[apify-provider] actor "${actor.actorId}" returned no usable ${kind} data for ${username}`);
    } catch (err) {
      console.warn(`[apify-provider] actor "${actor.actorId}" failed for ${username}:`, err);
    }
  }

  throw new Error(`All follower/following actors failed for ${username} (${kind}).`);
}
