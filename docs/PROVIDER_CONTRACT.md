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
  getStories(profileId: string): Promise<Story[]>;
  getHighlights(profileId: string): Promise<Highlight[]>;
  getTaggedPosts(profileId: string): Promise<TaggedPost[]>;
  getLikers(permalink: string, limit?: number): Promise<Liker[]>;
  getComments(permalink: string, limit?: number): Promise<Comment[]>;
  getFollowers(profileId: string, cursor?: string, limit?: number, query?: string): Promise<CursorPage<SocialUser>>;
  getFollowing(profileId: string, cursor?: string, limit?: number, query?: string): Promise<CursorPage<SocialUser>>;
}
```

`ProviderCapabilities` declares what a given implementation can actually
do — `followerHistory` is `false` on both providers, and the UI renders an
honest "not available" state rather than faking that data (spec §154
Feature Capability UI). `stories`, `highlights`, `taggedPosts`, and
`postEngagement` (likers + comments) are all `true` on both providers: the
mock provider generates deterministic fake data for each, and the Apify
provider fetches the real thing (see below). `getLikers`/`getComments`
take the post's own `permalink` (its real instagram.com URL, now part of
the `Post`/`TaggedPost` domain types) rather than an internal profileId,
since likers/comments are keyed by post, not by profile.

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

## Serverless function timeouts (`maxDuration`)

Apify actor runs (`run-sync-get-dataset-items`) routinely take 10-25+
seconds — confirmed directly (`fetchApifyProfile("dinememento")` took
~11s of a 24.6s total request). Vercel's default serverless execution
limit (10s on Hobby) is shorter than that, and a function killed mid-run
renders as a generic, unhelpful crash (the `error.tsx` boundary), not the
honest "couldn't load" empty states `safeProviderCall` is meant to
produce — those only catch an actual thrown error, not a platform-level
timeout kill. Every route that can reach a provider call (all
`profile/[username]/**/page.tsx` and `layout.tsx`, plus
`/api/v1/profiles/[profileId]/{followers,following}` and
`/api/v1/posts/engagement`) sets `export const maxDuration = 60;` —
Vercel's practical max on Hobby — so a slow actor run gets the time it
needs instead of triggering a platform timeout.

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
- **No username search actor, by design.** The homepage box takes a full
  username or a profile link and resolves it with the same single
  `getProfile` call the profile page itself makes — there is no
  suggestions-as-you-type endpoint. A live search actor
  (`nkactors/instagram-search-users-api-no-cookies-fast-reliable`) was
  tried in an earlier slice but was removed: it billed per keystroke
  (debounced, not eliminated) with a ~6-7s cold start per call, for a
  homepage convenience feature. See `docs/SEARCH.md` and
  `docs/DECISIONS.md`.
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
- **Stories** (`apify/stories.ts`): `data-slayer/instagram-stories-scraper`
  ("No Login") — verified live during development against a real public
  account's active stories: no session cookie needed, returns Instagram's
  own raw Stories API records (`image_versions`/`video_versions`,
  `taken_at`/`expiring_at`). A profile with nothing active comes back as
  `{ username, status: "no_active_stories" }` instead of a story item,
  which is filtered out — the honest zero-stories case, not a failure.
  Picks the widest available image/video rendition as both the thumbnail
  and the downloadable asset. No pagination — a profile realistically
  never has more than a handful of active (unexpired) stories at once.
- **Media downloads** (`/api/v1/media/download`, used by the post/reel
  grid and the story viewer): proxies the actual image/video file with
  `Content-Disposition: attachment`, restricted to an allowlist of
  Instagram's CDN domains (`cdninstagram.com`, `fbcdn.net`) plus the mock
  provider's placeholder image host (`picsum.photos`) — this is a public,
  unauthenticated route, so an open proxy to arbitrary URLs would be an
  SSRF hole.
- **Highlights** (`apify/highlights.ts`):
  `seemuapps/instagram-highlights-scraper` — verified live against real
  public accounts. Unlike several competing actors that only return
  highlight *metadata* (title/cover/count with no way to actually view the
  saved stories inside), this one resolves each highlight's full `stories`
  array in the same call. No pagination — a profile's highlight reels
  don't grow fast enough to need it.
- **Tagged posts** (`apify/tagged-posts.ts`):
  `instagram-scraper/instagram-tagged-posts-scraper` — verified live
  against a real account (confirmed the target profile actually appears
  in each result's `tagged_user` array, not just echoed input); results
  are filtered again in code to the same check as defense in depth. No
  pagination, capped at 24 results per profile per call.
- **Post likers + comments** (`apify/likers.ts`, `apify/comments.ts`,
  `/api/v1/posts/engagement`): `memo23/instagram-likers-scraper` and
  Apify's own official `apify/instagram-comment-scraper` — both take a
  post/reel's real permalink URL, not an internal id. Exposed through a
  small dedicated route rather than baked into the post grid response,
  so a profile's whole post grid doesn't eagerly bill Apify once per
  visible post — a viewer only pays for the one post whose likers/
  comments they actually open.
- **Not implemented**: follower history — `capabilities.followerHistory`
  stays `false`, same honesty rule as the mock provider.

## TikTok and Facebook providers (`apify/tiktok/`, `apify/facebook/`)

Second and third `SocialDataProvider` implementations, added alongside
Instagram's — reachable via `getProvider(platform)`
(`src/lib/providers/index.ts`) rather than the single default `provider`
export, which stays the Instagram instance so every pre-existing call
site is unaffected. Routed at `/profile/tiktok/[username]` and
`/profile/facebook/[username]` (not under `/profile/[username]`, to
avoid a route-collision risk with an Instagram username literally named
"tiktok" or "facebook", and to leave every already-indexed Instagram URL
untouched) via their own lean `PlatformProfileHeader` — Track/Compare/
Export aren't wired up for these two platforms in this slice (they're
tied to watchlist/snapshot tables that only ever write `platform:
"instagram"` rows today).

- **TikTok** (`clockworks/tiktok-profile-scraper`,
  `clockworks/tiktok-followers-scraper`,
  `clockworks/tiktok-comments-scraper` — the same author's actors,
  13.5M/177K/13.9M runs respectively, verified live against a real public
  account this session): profile + videos in one call (`authorMeta` on
  the first dataset item is the profile, every item is a video/post),
  followers and following in one call tagged by `connectionType`, and
  per-video comments. `capabilities.reels` is `false` — TikTok has no
  separate reels concept, every upload is already a video, so a second
  "reels" tab would just repeat the same list. `capabilities.stories`/
  `highlights`/`taggedPosts` are `false` — no actor covers these (TikTok
  doesn't really have an equivalent to Instagram's saved highlights or
  tagged-posts feed). `getLikers` returns `[]` — no actor found exposes a
  per-video likers list, only aggregate like counts, so the engagement
  modal opens straight to Comments for TikTok (see
  `post-engagement-modal.tsx`'s `hasLikers` check). A TikTok-liked-videos
  actor and a reposts actor exist on Apify but both have single/double-
  digit total runs — too unproven to build a real feature on, so neither
  is used; this is a deliberate gap, not an oversight.
- **Facebook** (`apify/facebook-pages-scraper`,
  `apify/facebook-posts-scraper`, `apify/facebook-comments-scraper` —
  official Apify actors, 32M/43M/10.6M runs, verified live this session):
  Page profile (followers/following are real counts; there is no public
  follower/following *list* for a Facebook Page anywhere, from any tool —
  Meta simply doesn't expose one, so `capabilities.followers`/`following`
  are `false` and `getFollowers`/`getFollowing` throw rather than
  returning a silently-empty page, which would misleadingly look like a
  page with zero followers instead of "this can't be fetched at all").
  Posts include real like/comment/share counts and per-post comments, but
  `mediaUrl` is left empty — no actor tested here returns a direct
  downloadable video/photo file for Facebook, only the post's own
  `facebook.com/reel/...` permalink, so the download button is correctly
  absent rather than linking to a fake "download" that just reopens the
  post.
- Both platforms' CDN domains (`tiktokcdn.com`, `tiktokcdn-us.com`,
  `tiktokv.com`, `muscdn.com`) were added to the existing hotlink-risk
  proxy allowlist (`src/lib/media-proxy.ts`) and the media
  download/proxy route's SSRF allowlist
  (`src/app/api/v1/media/download/utils.ts`) — same reasoning as
  Instagram/Facebook's own CDN domains already there.
- `src/lib/cache/profile-cache.ts` (the DB cache in front of
  `getProvider(platform).getProfile`) previously read/wrote rows keyed by
  `normalizedUsername` alone, with a comment explaining that filtering by
  `platform` too via `and(eq(...), eq(...))` had spuriously returned zero
  rows in the Next.js dev runtime. With only Instagram ever writing rows,
  that was latent rather than active — a second platform makes it a real
  collision risk (a TikTok "nike" lookup could serve Instagram's cached
  "nike" row). Fixed by selecting rows matching `normalizedUsername` and
  filtering `platform` in JS instead of in the query — same effective
  result, without the buggy combinator.
- `src/lib/profile-link.ts`'s `extractUsername` and
  `src/app/api/v1/posts/engagement/route.ts` both took a `platform`
  parameter (defaulting to `"instagram"`) instead of being duplicated per
  platform — the homepage's search widget now has a 3-way Instagram/
  TikTok/Facebook toggle feeding the same `extractUsername`, and the one
  engagement route validates the permalink's host and picks the provider
  per platform.

## Video transcriber: a separate, non-`SocialDataProvider` pipeline

`/transcribe` (docs/TRANSCRIBER.md) is not an Instagram feature and
doesn't implement `SocialDataProvider` — it's a second product surface
with its own small pipeline (`src/lib/transcription/`), reusing only
`runApifyActor` (for the universal video/audio downloader actor and the
last-resort fallback actor) from this provider layer. Its own
primary/fallback chain is Groq → OpenAI Whisper for the actual
speech-to-text step, unrelated to Apify entirely.

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
