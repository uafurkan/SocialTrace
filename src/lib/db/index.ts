/**
 * Lazy Postgres client factory, using Neon's HTTP driver rather than a raw
 * TCP connection. This isn't just a sandbox workaround (see git history
 * for that earlier one-off use) — it's the permanent driver, because the
 * project's live database is Neon and HTTP-based access is what serverless
 * Next.js deployments (Vercel, etc.) actually want: no persistent
 * connection pool to manage per invocation. See docs/DATABASE.md.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as dbSchema from "./schema";

export { dbSchema as schema };

let cached: ReturnType<typeof drizzle<typeof dbSchema>> | null = null;

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb() {
  if (cached) return cached;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. See .env.example. Callers that can run without " +
        "persistence (e.g. the snapshot engine) should check isDbConfigured() first " +
        "instead of letting this throw — see docs/SNAPSHOTS.md.",
    );
  }

  cached = drizzle(neon(connectionString), { schema: dbSchema });
  return cached;
}
