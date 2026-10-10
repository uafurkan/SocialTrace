import type { SocialUser } from "@/lib/domain/types";
import { CHAIN_DEADLINE_MS, MIN_RUN_WAIT_MS } from "@/lib/cache/cold-budget";
import { withDataCache } from "@/lib/cache/data-cache";
import { APIFY_TIMEOUT_MS, runApifyActor } from "./client";

export type MemberKind = "followers" | "following";

/** Runs one actor and resolves with its raw items. The run stops being waited on after `options.timeoutMs`. */
export type ActorRun = (
  actorId: string,
  input: Record<string, unknown>,
  options: { timeoutMs: number },
) => Promise<unknown>;

export interface MemberChainOptions {
  /** Clock in ms. Defaults to Date.now; tests inject a fake. */
  now?: () => number;
  /** Runs one actor. Defaults to runApifyActor; tests inject a fake. */
  run?: ActorRun;
  /** Time limit for the whole chain. Defaults to CHAIN_DEADLINE_MS. */
  budgetMs?: number;
}

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

/**
 * Runs the actor chain for one list and returns the first usable answer.
 *
 * The chain has `budgetMs` from its start. Each run is given
 * min(APIFY_TIMEOUT_MS, time left), so no wait runs past the budget, and no run
 * starts with less than MIN_RUN_WAIT_MS left. The worst case is therefore the
 * budget itself. A run that is cut off keeps running on Apify and is billed.
 *
 * Throws when the chain could not finish: an actor was skipped, or cut off by
 * the budget, and none returned usable data. Nothing is cached then, and a
 * stale row (if any) is still served. When every actor answered with nothing
 * usable, or errored before the budget ran out, the answer is a real "no
 * accessible members" result, and this returns [].
 */
export async function runMemberChain(
  username: string,
  kind: MemberKind,
  limit: number,
  options: MemberChainOptions = {},
): Promise<SocialUser[]> {
  const now = options.now ?? Date.now;
  const run = options.run ?? runApifyActor;
  const budgetMs = options.budgetMs ?? CHAIN_DEADLINE_MS;
  const deadlineAt = now() + budgetMs;
  const candidates = ACTOR_CHAIN.filter((actor) => !(actor.followersOnly && kind !== "followers"));
  // Every actor reachable at all (even one returning a clean empty/error
  // result, e.g. `{ error: "private_account" }` for a private profile) is
  // a genuine "no accessible members" answer, not an infrastructure
  // failure — only throw if every single actor call itself errored out.
  let anyActorReachable = false;
  // Set when an actor was skipped, or errored after the budget ran out. Its answer is unknown, not empty.
  let cutShort = false;

  for (const actor of candidates) {
    const leftMs = deadlineAt - now();
    if (leftMs < MIN_RUN_WAIT_MS) {
      cutShort = true;
      break;
    }
    try {
      const raw = await run(actor.actorId, actor.buildInput(username, limit, kind), {
        timeoutMs: Math.min(APIFY_TIMEOUT_MS, leftMs),
      });
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
        return normalized;
      }
      console.warn(`[apify-provider] actor "${actor.actorId}" returned no usable ${kind} data for ${username}`);
    } catch (err) {
      if (deadlineAt - now() <= 0) {
        cutShort = true;
      }
      console.warn(`[apify-provider] actor "${actor.actorId}" failed for ${username}:`, err);
    }
  }

  // Cut short before every actor answered, so an empty result would be a guess
  // that withDataCache caches for 1 hour. Throw instead: nothing is written.
  if (cutShort) {
    throw new Error(
      `Member lookup for ${username} (${kind}) reached the ${budgetMs / 1000}s limit before any actor returned data.`,
    );
  }
  if (anyActorReachable) {
    return [];
  }
  throw new Error(`All follower/following actors failed for ${username} (${kind}).`);
}

export async function fetchMembers(username: string, kind: MemberKind, limit: number): Promise<SocialUser[]> {
  // The DB cache (see data-cache.ts) is what makes paginating/revisiting an
  // already-fetched list not re-run (and re-bill/re-wait-on) this whole
  // fallback chain — each candidate actor is its own ~10-60s call, so
  // trying several in sequence on a cache miss can genuinely take minutes.
  return withDataCache(`members:${kind}:${username.toLowerCase()}`, () => runMemberChain(username, kind, limit));
}
