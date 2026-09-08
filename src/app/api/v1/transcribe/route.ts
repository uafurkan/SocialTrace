import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { resolveIdentity } from "@/lib/auth/identity";
import { isAdminEmail } from "@/lib/auth/admin";
import { PlanLimitError } from "@/lib/billing/plans";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { clientIdentifierFor, rateLimit } from "@/lib/rate-limit";
import {
  detectPlatform,
  fetchFreeVideoPreview,
  normalizeVideoUrl,
  transcribe,
  TranscriptionError,
  type TranscriptResult,
} from "@/lib/transcription";
import { assertTranscriptionAllowed, deleteUsageReservation, markUsageBilled, recordUsage } from "@/lib/transcription/quota";
import { VISITOR_COOKIE, VISITOR_COOKIE_OPTIONS } from "@/lib/tracking/visitor-cookie";

export const runtime = "nodejs";
export const maxDuration = 60;

const TRANSCRIBE_RATE_LIMIT = 10;
const TRANSCRIBE_RATE_WINDOW_MS = 10 * 60 * 1000;

/** How long a request will poll someone else's in-flight job for the same URL before giving up (bad-outcome #8, docs/TRANSCRIBER.md) — stays well under the 60s function budget. */
const DUPLICATE_WAIT_TIMEOUT_MS = 45_000;
const DUPLICATE_POLL_INTERVAL_MS = 1_500;

type StreamEvent =
  | { stage: "downloading" }
  | { stage: "transcribing"; videoUrl: string }
  | { stage: "done"; result: TranscriptResultPayload }
  | { stage: "error"; reason: string; message: string };

interface TranscriptResultPayload {
  text: string;
  segments: TranscriptResult["segments"];
  language: string;
  durationSeconds: number;
  platform: string;
  videoUrl: string | null;
}

/**
 * Routes the raw CDN URL through our own /video-proxy instead of handing it
 * to the browser directly — Instagram/Facebook/TikTok/YouTube CDN links are
 * hotlink-protected (Referer/User-Agent checks) or lack CORS headers, so a
 * bare `<video src="{cdn url}">` fails silently in the browser even though
 * the exact same URL is fetchable server-side (that's how Whisper reads it).
 */
function toProxiedVideoUrl(videoUrl: string | null): string | null {
  return videoUrl ? `/api/v1/transcribe/video-proxy?url=${encodeURIComponent(videoUrl)}` : null;
}

function toPayload(result: TranscriptResult): TranscriptResultPayload {
  return {
    text: result.text,
    segments: result.segments,
    language: result.language,
    durationSeconds: result.durationSeconds,
    platform: result.platform,
    videoUrl: toProxiedVideoUrl(result.videoUrl ?? null),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeEvent(controller: ReadableStreamDefaultController<Uint8Array>, event: StreamEvent): void {
  controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + "\n"));
}

export async function POST(request: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "The transcriber requires a configured database (DATABASE_URL is not set)." },
      { status: 501 },
    );
  }

  const body = await request.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const language = typeof body?.language === "string" ? body.language : undefined;
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const platform = detectPlatform(url);
  if (!platform) {
    return NextResponse.json(
      { error: "This link isn't from a supported platform (YouTube, TikTok, Instagram, or Facebook)." },
      { status: 400 },
    );
  }

  const rate = await rateLimit(`transcribe:${clientIdentifierFor(request)}`, TRANSCRIBE_RATE_LIMIT, TRANSCRIBE_RATE_WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const identity = await resolveIdentity(request);
  const isAdmin = isAdminEmail(identity.account?.email);

  if (!isAdmin) {
    try {
      await assertTranscriptionAllowed(identity.scopeId, identity.account?.plan ?? null);
    } catch (error) {
      if (error instanceof PlanLimitError || error instanceof Error) {
        return NextResponse.json({ error: error.message }, { status: 429 });
      }
      throw error;
    }
  }

  const cacheKey = normalizeVideoUrl(url, platform);
  const db = getDb();

  const [existing] = await db.select().from(schema.transcriptCache).where(eq(schema.transcriptCache.cacheKey, cacheKey)).limit(1);

  if (existing?.status === "done") {
    await recordUsage(identity.scopeId, cacheKey, false);
    // A cache hit has no stored video (short-lived CDN URLs aren't
    // persisted — see TranscriptResult.videoUrl's doc comment). Best-effort
    // re-fetch a fresh, free preview link (TikTok/Instagram/Facebook's
    // no-cost embed-page fetchers, ~1s) rather than silently dropping the
    // "watch while you read" player just because this run was cached.
    const freshVideoUrl = await fetchFreeVideoPreview(url, platform).catch(() => null);
    const response = NextResponse.json({
      cached: true,
      result: {
        text: existing.transcriptText ?? "",
        segments: existing.segments ?? [],
        language: existing.language ?? "auto",
        durationSeconds: existing.durationSeconds ?? 0,
        platform: existing.platform,
        videoUrl: toProxiedVideoUrl(freshVideoUrl),
      },
    });
    if (identity.visitorCookieToIssue) response.cookies.set(VISITOR_COOKIE, identity.visitorCookieToIssue, VISITOR_COOKIE_OPTIONS);
    return response;
  }

  // Claim the job (bad-outcome #8): only the request whose INSERT actually
  // lands a row runs the real pipeline; everyone else waits on it instead
  // of paying for a second run. Ownership must come from the INSERT's own
  // effect (via `.returning()`), not from the `existing` SELECT above —
  // two requests can both see no existing row when they race back-to-back,
  // and only checking `!existing` would let both believe they're the
  // owner and both run (and bill) the real pipeline for the same URL.
  // `onConflictDoNothing` guarantees only one of them gets a row back here
  // even when both attempt the insert.
  const claimed = await db
    .insert(schema.transcriptCache)
    .values({ cacheKey, platform, sourceUrl: url, status: "processing" })
    .onConflictDoNothing({ target: schema.transcriptCache.cacheKey })
    .returning({ cacheKey: schema.transcriptCache.cacheKey });
  const isOwner = claimed.length > 0;

  // Reserve this request's usage slot now, before the (potentially
  // 10s-60s) pipeline runs — not after it succeeds. Checking the quota
  // and then only recording usage once the whole pipeline finishes left a
  // window the length of the entire run during which the same scope could
  // fire more requests than its daily limit allows, since none of them
  // would show up in the count yet. Reserving immediately shrinks that
  // window to the time between the SELECT count and this INSERT. Billed
  // status and final disposition are decided below once the outcome (or
  // absence of one, on failure) is known.
  const usageReservation = isOwner ? await recordUsage(identity.scopeId, cacheKey, false) : null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      writeEvent(controller, { stage: "downloading" });

      try {
        if (!isOwner) {
          const result = await waitForExistingJob(cacheKey, DUPLICATE_WAIT_TIMEOUT_MS);
          if (!result) {
            writeEvent(controller, { stage: "error", reason: "transcription_failed", message: "Still processing — please try again shortly." });
            controller.close();
            return;
          }
          await recordUsage(identity.scopeId, cacheKey, false);
          // Same as the immediate-cache-hit branch above: this request
          // rode along on someone else's pipeline run and gets no stored
          // video either — best-effort refetch a free preview link.
          const freshVideoUrl = await fetchFreeVideoPreview(url, platform).catch(() => null);
          writeEvent(controller, { stage: "done", result: { ...toPayload(result), videoUrl: toProxiedVideoUrl(freshVideoUrl) } });
          controller.close();
          return;
        }

        const result = await transcribe(url, language, (videoUrl) => {
          writeEvent(controller, { stage: "transcribing", videoUrl: toProxiedVideoUrl(videoUrl) ?? "" });
        });
        await db
          .update(schema.transcriptCache)
          .set({
            status: "done",
            language: result.language,
            durationSeconds: result.durationSeconds,
            transcriptText: result.text,
            segments: result.segments,
            provider: result.provider,
            updatedAt: new Date(),
          })
          .where(eq(schema.transcriptCache.cacheKey, cacheKey));
        // usageReservation is guaranteed set here: this branch only runs
        // when isOwner is true, and usageReservation was populated
        // immediately after isOwner was determined, above.
        await markUsageBilled(usageReservation!);
        writeEvent(controller, { stage: "done", result: toPayload(result) });
      } catch (error) {
        if (isOwner) {
          // Never leave a permanently-cached failure (bad-outcome #14) — delete
          // the claim row so the next request retries the pipeline cleanly.
          await db.delete(schema.transcriptCache).where(eq(schema.transcriptCache.cacheKey, cacheKey)).catch(() => {});
          // A failed attempt shouldn't cost the visitor part of their daily
          // quota — release the reservation made before the pipeline ran.
          await deleteUsageReservation(usageReservation!).catch(() => {});
        }
        const reason = error instanceof TranscriptionError ? error.reason : "transcription_failed";
        const message = error instanceof Error ? error.message : "Something went wrong.";
        console.error("[transcribe] pipeline failed:", error);
        writeEvent(controller, { stage: "error", reason, message });
      } finally {
        controller.close();
      }
    },
  });

  const response = new NextResponse(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
  if (identity.visitorCookieToIssue) response.cookies.set(VISITOR_COOKIE, identity.visitorCookieToIssue, VISITOR_COOKIE_OPTIONS);
  return response;
}

async function waitForExistingJob(cacheKey: string, timeoutMs: number): Promise<TranscriptResult | null> {
  const db = getDb();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const [row] = await db.select().from(schema.transcriptCache).where(eq(schema.transcriptCache.cacheKey, cacheKey)).limit(1);
    if (!row) return null; // the owner deleted it after a failure
    if (row.status === "done") {
      return {
        text: row.transcriptText ?? "",
        segments: (row.segments as TranscriptResult["segments"]) ?? [],
        language: row.language ?? "auto",
        durationSeconds: row.durationSeconds ?? 0,
        // "upload" is reserved for a future slice (docs/TRANSCRIBER.md) — this build only ever writes the other four.
        platform: row.platform as TranscriptResult["platform"],
        provider: row.provider ?? "unknown",
      };
    }
    await sleep(DUPLICATE_POLL_INTERVAL_MS);
  }
  return null;
}
