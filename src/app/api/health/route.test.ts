import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The database module is mocked, so no live database is needed.
const db = vi.hoisted(() => ({
  configured: true,
  limit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  isDbConfigured: () => db.configured,
  getDb: () => ({
    select: () => ({ from: () => ({ limit: db.limit }) }),
  }),
  schema: { profiles: { id: "profiles.id" } },
}));

async function loadGET() {
  // A fresh module instance per test, so the module-level probe cache starts empty.
  vi.resetModules();
  return (await import("./route")).GET;
}

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-04T12:00:00Z"));
    db.configured = true;
    db.limit.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps the success shape when the probe answers", async () => {
    db.limit.mockResolvedValue([]);
    const GET = await loadGET();

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "ok",
      timestamp: "2026-09-04T12:00:00.000Z",
      database: { configured: true, ok: true },
    });
  });

  it("returns a fixed 503 body and logs the real error on the server", async () => {
    const error = new Error("password authentication failed for user 'app'");
    db.limit.mockRejectedValue(error);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const GET = await loadGET();

    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, database: "unavailable" });
    expect(consoleError).toHaveBeenCalledWith(expect.any(String), error);
  });

  it("reports an unconfigured database without probing it", async () => {
    db.configured = false;
    const GET = await loadGET();

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", database: { configured: false, ok: null } });
    expect(db.limit).not.toHaveBeenCalled();
  });

  it("reuses a probe result for 30 seconds", async () => {
    db.limit.mockResolvedValue([]);
    const GET = await loadGET();

    await GET();
    await GET();
    expect(db.limit).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-09-04T12:00:31Z"));
    await GET();
    expect(db.limit).toHaveBeenCalledTimes(2);
  });
});
