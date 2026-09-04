# Provider Contract

Spec §34/§35. The domain and UI layers depend only on the
`SocialDataProvider` interface (`src/lib/providers/types.ts`) —
never on a specific acquisition provider (spec §1.3).

```ts
interface SocialDataProvider {
  readonly capabilities: ProviderCapabilities;
  getProfile(username: string): Promise<ProviderProfileResult>;
  getPosts(profileId: string, cursor?: string, limit?: number): Promise<CursorPage<Post>>;
  getReels(profileId: string, cursor?: string, limit?: number): Promise<CursorPage<Post>>;
  getFollowers(profileId: string, cursor?: string, limit?: number, query?: string): Promise<CursorPage<SocialUser>>;
  getFollowing(profileId: string, cursor?: string, limit?: number, query?: string): Promise<CursorPage<SocialUser>>;
}
```

`ProviderCapabilities` declares what a given implementation can actually
do — `stories`/`highlights`/`followerHistory` are `false` on the mock
provider, and the UI renders an honest "not available" state rather than
faking that data (spec §154 Feature Capability UI).

## Current implementation: `MockSocialDataProvider`

`src/lib/providers/mock-provider.ts`. No network calls, no real Instagram
data. Deterministic: the same username always produces the same profile
via a seeded PRNG (`mulberry32` keyed by a hash of the username), so pages
are reproducible across requests and in tests.

Two usernames are hand-seeded to exercise the coverage UI honestly (spec
§1.2's own worked examples):

- `nike` — 312.4M followers, ~80K indexed → ~0.03% coverage (partial).
- `smallcreator` — 42,183 followers, fully indexed → 100% coverage.

Any other username gets a randomly generated profile with coverage
weighted by follower count (larger accounts get proportionally less
indexed). `doesnotexist` / `notfound` throw `ProfileNotFoundError`, which
`src/lib/server/profile.ts` translates into Next.js `notFound()`.

Follower/following generation is capped at 5,000 in-memory users per
profile regardless of the fake `followerCount`, to keep the mock fast —
this is a mock-only limitation, not a modeled "coverage" number.

## Real implementation: `ApifyInstagramProvider`

`src/lib/providers/apify/`. Uses [Apify](https://apify.com) actors over
their REST API (`POST /v2/acts/{actorId}/run-sync-get-dataset-items`, see
`apify/client.ts`) — no scraping code of our own, no Instagram login/
cookies. Selected via `SOCIAL_PROVIDER=apify` + `APIFY_API_TOKEN` in
`src/lib/providers/index.ts`; the mock provider stays the default so
nothing costs money unless explicitly opted in.

- **Profile + posts** (`apify/profile.ts`, `apify/posts.ts`): both come
  from the single `apify/instagram-profile-scraper` actor's response
  (`followersCount`, `followsCount`, `biography`, `verified`,
  `latestPosts[]`, etc.).
- **Reels** (`apify/reels.ts`): a dedicated actor,
  `apify/instagram-reel-scraper`, not approximated from the profile
  actor's recent posts — real reel data (caption, likes, comments,
  `videoPlayCount`, timestamp). Cached per-process per profile so
  re-paginating doesn't re-run the actor.
- **Username search** (`apify/search.ts`): backs the homepage search
  box's suggestions dropdown, via
  `nkactors/instagram-search-users-api-no-cookies-fast-reliable`, which
  calls Instagram's own internal search and returns results already
  ranked by relevance (closest match first) — preserved as-is rather than
  re-sorted. **Latency**: this actor takes ~6-7 seconds per call (Apify
  actor cold start), so it cannot power true per-keystroke "search as you
  type" — `ProfileSearchForm` debounces 500ms after typing stops and
  shows a loading state instead of faking instant results. Results are
  cached per lowercased query for the process lifetime.
- **Followers/following** (`apify/followers.ts`): no single actor was
  clearly best, so this tries **five actors in a fixed priority order**,
  falling back to the next on any failure or empty/malformed result:
  1. `apify/instagram-followers-following-scraper` (official Apify actor)
  2. `scraping_solutions/instagram-scraper-followers-following-no-cookies`
  3. `datadoping/instagram-followers-scraper` (followers only — no "following" mode)
  4. `coderx/instagram-followers-following-scraper-no-cookies-login`
  5. `seemuapps/instagram-followers-scraper`

  Each actor returns a different raw shape (verified live against real
  output during development, not guessed from docs) — see the
  `normalize` function next to each entry in `ACTOR_CHAIN`. Results are
  capped at `MEMBER_FETCH_CAP` (200) per profile per kind and cached
  in-memory per process so paginating an already-fetched list doesn't
  re-run (and re-bill) the actor chain — this is a cost/safety guard, not
  a durable cache; see `docs/KNOWN_LIMITATIONS.md`.
- **Coverage honesty**: `Profile.followerCoverage`/`followingCoverage`
  are computed against `MEMBER_FETCH_CAP`, not a live fetched count (that
  would mean invoking a paid follower-scraper actor on every profile
  view) — so a huge account's coverage badge will correctly show a very
  low percentage the moment its real follower count is known, before its
  follower list is ever fetched.
- **Not implemented**: stories, highlights, follower history —
  `capabilities` marks these `false`, same honesty rule as the mock
  provider.

## Adding another provider later

1. Implement `SocialDataProvider` against the real source, including
   honest `capabilities` flags — never claim a capability the source
   doesn't reliably provide (spec §2.3).
2. Update `src/lib/providers/index.ts`'s provider-selection logic (behind
   a feature flag / env check per spec §35 if multiple providers need to
   coexist).
3. No changes should be required in `src/app/**` or `src/components/**` —
   if a change there turns out to be necessary, the interface was
   under-specified and should be fixed instead.
