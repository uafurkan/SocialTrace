# Database

Spec §31 / §149. Schema and migrations only in this slice — see
`docs/KNOWN_LIMITATIONS.md`. No app code reads from or writes to this
database yet; `src/lib/providers/mock-provider.ts` continues to serve
`src/app/**` exactly as before.

## Stack

Postgres, [Drizzle ORM](https://orm.drizzle.team/) + `drizzle-kit` for
migrations, the `postgres` (postgres.js) driver.

- `src/lib/db/schema.ts` — table definitions.
- `src/lib/db/index.ts` — `getDb()`, a lazily-initialized client that
  throws a clear error if `DATABASE_URL` is unset. Not imported anywhere
  in `src/app` or `src/components`, so build/lint/typecheck don't need a
  live database.
- `drizzle.config.ts` — points `drizzle-kit` at the schema and reads
  `DATABASE_URL` (falls back to a placeholder string so `generate` works
  without a real database).
- `drizzle/` — committed SQL migrations, generated with
  `npx drizzle-kit generate`.

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
  or profile field changes).

## Local usage

```bash
cp .env.example .env.local   # set a real DATABASE_URL
npx drizzle-kit generate     # regenerate migrations after schema changes
npx drizzle-kit migrate      # apply migrations to the configured database
```

No seed script exists yet — populating these tables from the mock (or a
real) provider is future work, not part of this slice.
