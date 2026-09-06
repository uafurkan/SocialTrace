import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { resolveIdentity } from "@/lib/auth/identity";
import { PlanLimitError } from "@/lib/billing/plans";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { clientIdentifierFor, rateLimit } from "@/lib/rate-limit";
import { detectPlatform, normalizeVideoUrl, transcribe, TranscriptionError, type TranscriptResult } from "@/lib/transcription";
import { assertTranscriptionAllowed, recordUsage } from "@/lib/transcription/quota";
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

function toPayload(result: TranscriptResult): TranscriptResultPayload {
  return {
    text: result.text,
    segments: result.segments,
    language: result.language,
    durationSeconds: result.durationSeconds,
    platform: result.platform,
    videoUrl: result.videoUrl ?? null,
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

  try {
    await assertTranscriptionAllowed(identity.scopeId, identity.account?.plan ?? null);
  } catch (error) {
    if (error instanceof PlanLimitError || error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    throw error;
  }

  const cacheKey = normalizeVideoUrl(url, platform);
  const db = getDb();

  const [existing] = await db.select().from(schema.transcriptCache).where(eq(schema.transcriptCache.cacheKey, cacheKey)).limit(1);

  if (existing?.status === "done") {
    await recordUsage(identity.scopeId, cacheKey, false);
    const response = NextResponse.json({
      cached: true,
      result: {
        text: existing.transcriptText ?? "",
        segments: existing.segments ?? [],
        language: existing.language ?? "auto",
        durationSeconds: existing.durationSeconds ?? 0,
        platform: existing.platform,
        videoUrl: null,
      },
    });
    if (identity.visitorCookieToIssue) response.cookies.set(VISITOR_COOKIE, identity.visitorCookieToIssue, VISITOR_COOKIE_OPTIONS);
    return response;
  }

  // Claim the job (bad-outcome #8): only the request that actually inserts
  // the row runs the real pipeline; a request that finds an existing
  // "processing" row waits on it instead of paying for a second run.
  const isOwner = !existing;
  if (isOwner) {
    await db
      .insert(schema.transcriptCache)
      .values({ cacheKey, platform, sourceUrl: url, status: "processing" })
      .onConflictDoNothing({ target: schema.transcriptCache.cacheKey });
  }

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
          writeEvent(controller, { stage: "done", result: toPayload(result) });
          controller.close();
          return;
        }

        const result = await transcribe(url, language);
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
        await recordUsage(identity.scopeId, cacheKey, true);
        writeEvent(controller, { stage: "done", result: toPayload(result) });
      } catch (error) {
        if (isOwner) {
          // Never leave a permanently-cached failure (bad-outcome #14) — delete
          // the claim row so the next request retries the pipeline cleanly.
          await db.delete(schema.transcriptCache).where(eq(schema.transcriptCache.cacheKey, cacheKey)).catch(() => {});
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
