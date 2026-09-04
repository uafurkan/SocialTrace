/**
 * Lazy Postgres client factory. Not imported by any route/component yet —
 * this slice is schema/migrations only (see docs/DATABASE.md). Deferring
 * the `postgres()` connection to first use keeps `npm run build` and
 * `npm run lint` working with no `DATABASE_URL` set.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as dbSchema from "./schema";

export { dbSchema as schema };

let cached: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (cached) return cached;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. See .env.example — this build has no wired-up " +
        "database usage yet (docs/KNOWN_LIMITATIONS.md); this client exists for " +
        "future provider work.",
    );
  }

  const client = postgres(connectionString);
  cached = drizzle(client, { schema: dbSchema });
  return cached;
}
