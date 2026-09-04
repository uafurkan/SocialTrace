import { NextResponse } from "next/server";

import { getDb, isDbConfigured, schema } from "@/lib/db";

// Reads live DB state on every call — must not be statically cached at build time.
export const dynamic = "force-dynamic";

/**
 * Liveness/readiness check for production monitoring (spec §110). Always
 * 200 when the process itself is up; `database.ok` separately reports
 * whether a configured database actually answers a query, since a
 * misconfigured DATABASE_URL shouldn't look identical to "no database at
 * all" (see docs/DATABASE.md) — a deploy relying on persistence needs to
 * be able to tell those apart.
 */
export async function GET() {
  const database: { configured: boolean; ok: boolean | null; error?: string } = {
    configured: isDbConfigured(),
    ok: null,
  };

  if (database.configured) {
    try {
      await getDb().select({ id: schema.profiles.id }).from(schema.profiles).limit(1);
      database.ok = true;
    } catch (error) {
      database.ok = false;
      database.error = error instanceof Error ? error.message : "Unknown database error";
    }
  }

  const status = database.configured && !database.ok ? 503 : 200;
  return NextResponse.json(
    {
      status: status === 200 ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      database,
    },
    { status },
  );
}
