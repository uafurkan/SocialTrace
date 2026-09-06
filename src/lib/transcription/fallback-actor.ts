import { runApifyActor } from "@/lib/providers/apify/client";
import type { TranscriptPlatform, TranscriptResult } from "./types";

/**
 * Last-resort path (docs/TRANSCRIBER.md bad-outcome #2): an independent,
 * all-in-one download+transcribe actor, tried only when the primary
 * unified pipeline (downloader.ts + speech-to-text.ts) fails end-to-end
 * for a URL. Output shape confirmed live against a real public TikTok
 * video this session: `{ status, durationSec, transcript,
 * detected_language }` — no per-segment timestamps, so `segments` comes
 * back empty (an honest degradation, not a bug: this path is a fallback,
 * not the primary experience).
 */
const FALLBACK_ACTOR_ID = "tictechid~anoxvanzi-transcriber";

interface FallbackActorItem {
  status?: string;
  durationSec?: number;
  transcript?: string;
  detected_language?: string;
}

export async function tryFallbackActor(sourceUrl: string, platform: TranscriptPlatform): Promise<TranscriptResult | null> {
  const items = (await runApifyActor(FALLBACK_ACTOR_ID, { urls: [sourceUrl] })) as FallbackActorItem[];
  const item = Array.isArray(items) ? items[0] : undefined;
  if (!item || item.status !== "success") return null;

  const text = (item.transcript ?? "").trim();
  if (!text) return null;

  return {
    text,
    segments: [],
    language: item.detected_language ?? "auto",
    durationSeconds: item.durationSec ?? 0,
    platform,
    provider: FALLBACK_ACTOR_ID,
  };
}
