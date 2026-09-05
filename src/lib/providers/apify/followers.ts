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
      // Live output is an array wrapping a single page object —
      // `[{ cursor_next, results: [...] }]` — not the page object itself.
      const page = Array.isArray(raw) ? raw[0] : raw;
      const results = (page as { results?: unknown[] } | undefined)?.results;
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
  // Every actor reachable at all (even one returning a clean empty/error
  // result, e.g. `{ error: "private_account" }` for a private profile) is
  // a genuine "no accessible members" answer, not an infrastructure
  // failure — only throw if every single actor call itself errored out.
  let anyActorReachable = false;

  for (const actor of candidates) {
    try {
      const raw = await runApifyActor(actor.actorId, actor.buildInput(username, limit, kind));
      anyActorReachable = true;
      // Observed live: at least one actor in this chain (coderx), when it
      // can't actually access a private account's list, falls back to
      // returning the queried account's own username as if it were a
      // member of its own list, instead of a clean empty/error result.
      // A real account is never its own follower/following — exclude it
      // defensively regardless of which actor produces this.
      const normalized = actor
        .normalize(raw)
        ?.filter((u) => u.username && u.username.toLowerCase() !== username.toLowerCase());
      if (normalized && normalized.length > 0) {
        memberCache.set(cacheKey, normalized);
        return normalized;
      }
      console.warn(`[apify-provider] actor "${actor.actorId}" returned no usable ${kind} data for ${username}`);
    } catch (err) {
      console.warn(`[apify-provider] actor "${actor.actorId}" failed for ${username}:`, err);
    }
  }

  if (anyActorReachable) {
    memberCache.set(cacheKey, []);
    return [];
  }
  throw new Error(`All follower/following actors failed for ${username} (${kind}).`);
}
