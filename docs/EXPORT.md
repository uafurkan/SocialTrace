# Export System

Spec §29/§155–§158. Lets a user download a profile's currently-available
data as a structured file.

## What's implemented

`GET /api/v1/profiles/[profileId]/export?username=<username>&format=json|xml|csv[&resource=followers|following|posts|reels]`
(`src/app/api/v1/profiles/[profileId]/export/route.ts`) builds an export
bundle from the active `SocialDataProvider` (`src/lib/export/build.ts`)
and serializes it (`src/lib/export/serialize.ts`):

- **JSON / XML** — the full bundle: profile, statistics, coverage, posts,
  reels, followers, following. Schema-versioned per spec §155
  (`schema: "socialtrace.profile.v1"`, `platform`, `generatedAt`), matching
  the shapes in spec §156/§157.
- **CSV** — one resource per request (`resource=followers|following|posts|reels`),
  since CSV is inherently tabular. Follower/following columns match spec
  §158 (`platform_user_id,username,display_name,profile_url,is_verified`)
  minus `first_seen_at`/`last_seen_at`, which nothing in this build can
  populate yet (no snapshot history) — per spec §158's own rule, "do not
  include columns that cannot be reliably populated."

The profile page's Export button (`src/components/profile/export-menu.tsx`)
is a small dropdown of direct links to this endpoint (browser handles the
download via `Content-Disposition: attachment`) — no client-side
JS-driven file generation.

## What's deliberately not implemented

Spec §29 describes exports as **background jobs**: request → auth check →
queue → worker → stream/chunk → compress → store → signed URL → download →
expiration. This build has no auth, no job queue (Redis/BullMQ), and no
blob storage (see `docs/KNOWN_LIMITATIONS.md`), so building that pipeline
now would mean queuing into nothing and signing URLs to storage that
doesn't exist — fake infrastructure, not a real export system.

Instead, this generates the file **synchronously inside the API request**,
bounded by `EXPORT_LIST_LIMIT = 500` (`src/lib/export/build.ts`) items per
list (followers/following/posts/reels each), fetched via the same
paginated `provider.getX()` calls the rest of the app uses. This keeps the
request fast and keeps the Apify provider's per-result billing predictable
regardless of a profile's real follower count — the same cost-control
reasoning as `MEMBER_FETCH_CAP` in the Apify provider (see
`docs/PROVIDER_CONTRACT.md`).

Not implemented at all: JSONL/NDJSON, ZIP bundles, PDF reports (spec §29's
other formats — deferred until there's a real reason to stream/bundle,
i.e. once real datasets can exceed what fits comfortably in one response),
and any expiring/signed download link (there's nothing to expire — the
response is generated and streamed back directly, not stored).

## When this needs to change

Once a job queue and durable storage exist (a later milestone), replace
the synchronous handler's body with: enqueue a job, return a job id,
generate the file in a worker, upload it, return a signed URL when ready
— `src/lib/export/build.ts` and `serialize.ts` stay as-is; only the
transport around them changes.
