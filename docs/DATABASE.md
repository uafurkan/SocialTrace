# Database

Spec §31 / §149. As of the snapshot, diff, and tracking slices, this
database is actually written to and read from — see `docs/SNAPSHOTS.md`,
`docs/DIFF.md`, and `docs/TRACKING.md`. The mock/Apify providers still
serve all the rest of the app's data (`src/lib/providers/`); only
snapshot history (`/profile/[username]/history`), change history
(`/profile/[username]/changes`), and the tracking dashboard
(`/tracking`) touch Postgres.

## Stack

Postgres (Neon), [Drizzle ORM](https://orm.drizzle.team/) + `drizzle-kit`
for migrations, [`@neondatabase/serverless`](https://github.com/neondatabase/serverless)
+ `drizzle-orm/neon-http` as the runtime driver.

- `src/lib/db/schema.ts` — table definitions.
- `src/lib/db/index.ts` — `getDb()` (lazily-initialized Neon HTTP client;
  throws a clear error if `DATABASE_URL` is unset) and `isDbConfigured()`
  (a boolean check callers use to gate DB-dependent features instead of
  hitting that throw — see `docs/SNAPSHOTS.md`).
- `drizzle.config.ts` — points `drizzle-kit` at the schema and reads
  `DATABASE_URL` (falls back to a placeholder string so `generate` works
  without a real database).
- `drizzle/` — committed SQL migrations, generated with
  `npx drizzle-kit generate`.

**Why the HTTP driver, not a TCP pool**: the project's live database is
Neon, and `drizzle-orm/neon-http` (via `@neondatabase/serverless`) issues
each query as one HTTPS request instead of holding a persistent TCP
connection — the right shape for a serverless Next.js deployment (Vercel,
etc.) where a long-lived pool per function instance doesn't fit. This
replaced the earlier `postgres` (postgres.js) driver; see
`docs/DECISIONS.md`. `drizzle-kit`'s own CLI commands (`generate`,
`migrate`) still use a direct connection internally, unrelated to the
app's runtime driver — see the sandbox note below.

## Tables

See `docs/DATA_MODEL.md` for the full mapping from the app's TypeScript
domain types (`src/lib/domain/types.ts`) to these tables.

- `profiles` — one row per tracked profile.
- `social_users` — deduped identities referenced by memberships.
- `memberships` — follower/following edges (`kind` discriminator), with
  `first_seen_at`/`last_seen_at`/`removed_at` so the diff engine can
  derive "new" / "removed" without a separate log table.
- `media_items` — posts and reels, distinguished by `media_type`.
- `profile_snapshots` — one row per indexing pass; `CoverageStatus` is
  computed from these at read time rather than stored on `profiles`.
- `change_events` — diff output between two snapshots (membership churn
  or profile field changes), spec §20. Written by `captureSnapshot`
  (`src/lib/snapshot/capture.ts`) as part of capturing a new snapshot,
  read by `src/lib/diff/changes.ts` — see `docs/DIFF.md`.
- `watchlist_entries` — spec §21 Tracking/Watchlist, scoped to anonymous
  cookie-identified visitors instead of real accounts (there's no `users`
  table for it to reference) — see `docs/TRACKING.md`.

`profiles` and `social_users` are uniquely indexed on
`(platform, normalized_username)` (added in `drizzle/0001_naive_multiple_man.sql`)
so snapshot capture can upsert them instead of duplicating a row per
capture — see `docs/SNAPSHOTS.md`.

## Local usage

```bash
cp .env.example .env.local   # set a real DATABASE_URL
npx drizzle-kit generate     # regenerate migrations after schema changes
npx drizzle-kit migrate      # apply migrations to the configured database
```

No seed script exists yet — populating these tables from the mock (or a
real) provider is future work, not part of this slice.

## Status

All three migrations (`0000_bright_boom_boom.sql`, `0001_naive_multiple_man.sql`,
`0002_plain_cyclops.sql`) are applied to the project's live Neon database —
all seven tables exist, with the unique indexes snapshot capture and
tracking depend on. Note:
`drizzle-kit migrate`'s CLI needs a raw TCP connection regardless of the
app's own driver, which some sandboxed environments (including the one
used to apply these migrations) block, restricting outbound traffic to
HTTPS only. In that case, apply migrations with Neon's HTTP driver
directly instead:

```js
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const db = drizzle(neon(process.env.DATABASE_URL));
await migrate(db, { migrationsFolder: "./drizzle" });
```

On a normal machine (local dev, CI, or a deployed server) `npx drizzle-kit
migrate` works directly with no workaround needed.
