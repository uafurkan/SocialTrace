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

## Tables now defined (schema/migrations only — see docs/DATABASE.md)

`src/lib/db/schema.ts` now defines `profiles`, `social_users`,
`memberships` (follower/following, `kind`-discriminated),
`media_items`, `profile_snapshots`, and `change_events`, matching the
mappings above. No app code reads from or writes to these tables yet —
`src/lib/providers/mock-provider.ts` still serves the UI directly.

## Not modeled yet

`tracking_jobs`, `watchlists`, `saved_searches`, `exports`,
`subscriptions`, `api_keys` — all from spec §31, none exist in this
build.
