# Data Model

No database exists in this build (see `docs/KNOWN_LIMITATIONS.md`). This
document maps the current TypeScript domain types
(`src/lib/domain/types.ts`) onto the future schema from spec §31, so
introducing Postgres later is a mapping exercise rather than a redesign.

## `Profile` → future `profiles` table

| TS field | Spec `profiles` column | Notes |
|---|---|---|
| `id` | `id` | Currently `profile_${username}`; becomes a real surrogate key. |
| `platform` | `platform` | Only `"instagram"` today. |
| `username` | `username` / `normalized_username` | Normalization not yet implemented. |
| `displayName` | `display_name` | |
| `bio` | `bio` | |
| `avatarUrl` | `avatar_url` | Empty in mock data. |
| `isVerified` | `is_verified` | |
| `isPrivate` | `is_private` | Always `false` in mock data. |
| `followerCount`, `followingCount`, `postCount` | same | |
| `followerCoverage`, `followingCoverage` | *(derived, not a column)* | Computed from `profile_snapshots` + `follower_memberships` counts in the real system; see spec §149 Data Coverage Model. |

## `SocialUser` → future `social_users` table

Identity entity, separate from a specific profile's follower/following
membership (spec §31 "Social users"). In this build, `SocialUser` records
are generated per (profileId, kind) pair and are not shared across
profiles the way the real `social_users` table would dedupe them.

## `Post` → future `media_items` table

`mediaType: "reel"` maps to the spec's separate reels concept; this build
folds reels into the same `Post` shape with `mediaType` distinguishing
them, since there's no persistence layer forcing a table split yet.

## `CoverageStatus` — spec §149 Data Coverage Model

```ts
interface CoverageStatus {
  status: "available" | "partial" | "unavailable";
  coveragePercent: number; // 0-100
  indexedCount: number;
  totalCount: number;
  lastCheckedAt: string; // ISO 8601
}
```

`status` is derived (`coveragePercent >= 99.5` → `available`, `indexed >
0` → `partial`, else `unavailable`) rather than stored — once real
snapshots exist, this should be computed from
`follower_memberships`/`profile_snapshots` at read time or cached
alongside the snapshot, not hand-set.

## Tables (see docs/DATABASE.md)

`src/lib/db/schema.ts` defines `profiles`, `social_users`, `memberships`
(follower/following, `kind`-discriminated), `media_items`,
`profile_snapshots`, and `change_events`, matching the mappings above.

As of the snapshot + diff engine slices (`src/lib/snapshot/capture.ts`,
`src/lib/diff/changes.ts` — see `docs/SNAPSHOTS.md`/`docs/DIFF.md`),
`profiles`, `social_users`, `memberships`, `profile_snapshots`, and
`change_events` are all actually written to and read from when a user
captures a profile snapshot: `captureSnapshot` writes the snapshot itself
and, since it also has the previous snapshot on hand, computes and writes
any `change_events` (added/removed members, changed profile fields) in
the same request. `media_items` is still unwritten — snapshot capture
deliberately doesn't persist the media feed, since it's out of scope for
the diff model spec §20 describes.
`src/lib/providers/mock-provider.ts`/`apify/` still serve all other data
(profile display, posts, reels, live followers/following browsing) —
only the History and Changes tabs and the `/tracking` dashboard touch
Postgres.

`watchlist_entries` (spec §21 Tracking/Watchlist, see `docs/TRACKING.md`)
and `saved_searches` (spec §22, see `docs/SAVED_SEARCHES.md`) are also
written to and read from — but both key rows by an anonymous
`visitor_id` cookie value, not a real user, since there's no `users`
table or auth in this build.

## Not modeled yet

`tracking_jobs` (a real scheduler's job queue — `watchlist_entries`
itself exists, but nothing runs recurring jobs against it),
`subscriptions`, `api_keys` — all from spec §31, none exist in this
build. `exports` doesn't exist as a table either — exports are generated
synchronously and streamed, never persisted (`docs/EXPORT.md`).
