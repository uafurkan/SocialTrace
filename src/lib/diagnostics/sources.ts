/**
 * Answers one question cheaply: does the free Instagram source
 * (providers/instagram-public/web-profile-info.ts) actually reach Instagram
 * from *this* deployment's outbound IP? From this sandbox it's a confirmed
 * `401 require_login` (Instagram blocking a datacenter IP range) — that
 * tells us nothing about production, since Vercel's egress IPs are a
 * different range with different reputation. Shared by the admin page and
 * the diagnostics route so both report the exact same probe.
 *
 * Deliberately makes zero Apify calls — a diagnostic must never spend a
 * billed run. The Apify half only reads the quota breaker's in-memory state.
 */
import { fetchWebProfileInfo } from "../providers/instagram-public/web-profile-info";
import { isApifyQuotaBreakerOpen } from "../providers/apify/client";
import { ProfileNotFoundError } from "../providers/types";

/** A real, stable public account — never expected to be deleted or renamed. */
const PROBE_HANDLE = "instagram";

export interface SourceDiagnostics {
  instagramPublic: { ok: boolean; status: number | null; latencyMs: number };
  apify: { quotaBreakerOpen: boolean };
}

export async function probeSources(): Promise<SourceDiagnostics> {
  const startedAt = Date.now();
  let ok = false;
  let status: number | null = null;

  try {
    const user = await fetchWebProfileInfo(PROBE_HANDLE);
    ok = user !== null;
    // fetchWebProfileInfo doesn't hand back the raw status on success, but a
    // non-null result only happens on a 200 — the reverse (null) means the
    // caller's own console.warn already logged the real status; this probe
    // only needs to know ok/not-ok, not reproduce that log.
    status = ok ? 200 : null;
  } catch (error) {
    // A confirmed ProfileNotFoundError would mean Instagram itself answered
    // (just not for this handle) — treat that as "reachable" too, since the
    // question this probe answers is IP reachability, not this handle's fate.
    ok = error instanceof ProfileNotFoundError;
    status = ok ? 404 : null;
  }

  return {
    instagramPublic: { ok, status, latencyMs: Date.now() - startedAt },
    apify: { quotaBreakerOpen: isApifyQuotaBreakerOpen() },
  };
}
