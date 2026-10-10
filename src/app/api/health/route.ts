import { NextResponse } from "next/server";

import { getDb, isDbConfigured, schema } from "@/lib/db";

// Reads live DB state on every call — must not be statically cached at build time.
export const dynamic = "force-dynamic";

// Probe results are reused for this long, so a monitor polling often does not
// run a query each time. The promise itself is cached, so concurrent requests
// share one probe.
const PROBE_TTL_MS = 30_000;
let cachedProbe: { expiresAt: number; ok: Promise<boolean> } | null = null;

function probeDatabase(): Promise<boolean> {
  const now = Date.now();
  if (cachedProbe && now < cachedProbe.expiresAt) return cachedProbe.ok;

  const ok = (async () => {
    try {
      await getDb().select({ id: schema.profiles.id }).from(schema.profiles).limit(1);
      return true;
    } catch (error) {
      console.error("[health] database probe failed:", error);
      return false;
    }
  })();
  cachedProbe = { expiresAt: now + PROBE_TTL_MS, ok };
  return ok;
}

/**
 * Liveness/readiness check for production monitoring (spec §110). Always
 * 200 when the process itself is up; `database.ok` separately reports
 * whether a configured database actually answers a query, since a
 * misconfigured DATABASE_URL shouldn't look identical to "no database at
 * all" (see docs/DATABASE.md) — a deploy relying on persistence needs to
 * be able to tell those apart.
 *
 * The driver error is logged on the server only. It can name hosts, users or
 * internals, so the 503 body is fixed.
 */
export async function GET() {
  const database: { configured: boolean; ok: boolean | null } = {
    configured: isDbConfigured(),
    ok: null,
  };

  if (database.configured) {
    database.ok = await probeDatabase();
  }

  if (database.configured && !database.ok) {
    return NextResponse.json({ ok: false, database: "unavailable" }, { status: 503 });
  }

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    database,
  });
}
