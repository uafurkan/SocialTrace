import type { TranscriptResult, TranscriptSegment } from "./types";

/**
 * YouTube fast-path (docs/TRANSCRIBER.md "Speed"): most YouTube videos
 * already have manual or auto-generated captions. Fetching them directly
 * from YouTube's own (unauthenticated, undocumented but widely relied on)
 * timedtext endpoint is free and near-instant — no download actor, no
 * Whisper call. Returns `null` (not a thrown error) when no captions
 * exist, so the caller falls through to the paid download+transcribe
 * pipeline; a genuine failure to reach YouTube at all still throws, since
 * that's a real transient failure, not "no captions."
 */
const YOUTUBE_ID_PATTERNS = [/[?&]v=([^&#]+)/, /youtu\.be\/([^?&#]+)/, /\/shorts\/([^?&#]+)/, /\/embed\/([^?&#]+)/];

export function extractYouTubeVideoId(rawUrl: string): string | null {
  for (const pattern of YOUTUBE_ID_PATTERNS) {
    const match = rawUrl.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string; // "asr" = auto-generated
}

async function findCaptionTracks(videoId: string): Promise<CaptionTrack[]> {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SocialTraceBot/1.0)" },
  });
  if (!res.ok) throw new Error(`Failed to load YouTube page (${res.status})`);
  const html = await res.text();

  const match = html.match(/"captionTracks":(\[.*?\])/);
  if (!match) return [];
  try {
    return JSON.parse(match[1]) as CaptionTrack[];
  } catch {
    return [];
  }
}

function pickTrack(tracks: CaptionTrack[], preferredLanguage?: string): CaptionTrack | null {
  if (tracks.length === 0) return null;
  const manual = tracks.filter((t) => t.kind !== "asr");
  const byLanguage = (list: CaptionTrack[]) =>
    preferredLanguage ? list.find((t) => t.languageCode.startsWith(preferredLanguage)) : undefined;
  return byLanguage(manual) ?? manual[0] ?? byLanguage(tracks) ?? tracks[0];
}

interface TimedTextJson3 {
  events?: Array<{
    tStartMs?: number;
    dDurationMs?: number;
    segs?: Array<{ utf8?: string }>;
  }>;
}

async function fetchSegments(track: CaptionTrack): Promise<TranscriptSegment[]> {
  const url = new URL(track.baseUrl);
  url.searchParams.set("fmt", "json3");
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch captions (${res.status})`);
  const data = (await res.json()) as TimedTextJson3;

  const segments: TranscriptSegment[] = [];
  for (const event of data.events ?? []) {
    const text = (event.segs ?? []).map((s) => s.utf8 ?? "").join("");
    if (!text.trim()) continue;
    const startMs = event.tStartMs ?? 0;
    segments.push({
      start: startMs / 1000,
      end: (startMs + (event.dDurationMs ?? 0)) / 1000,
      text: text.replace(/\n/g, " ").trim(),
    });
  }
  return segments;
}

export async function tryYouTubeCaptions(videoId: string, preferredLanguage?: string): Promise<TranscriptResult | null> {
  const tracks = await findCaptionTracks(videoId);
  const track = pickTrack(tracks, preferredLanguage);
  if (!track) return null;

  const segments = await fetchSegments(track);
  if (segments.length === 0) return null;

  const durationSeconds = segments[segments.length - 1]?.end ?? 0;
  return {
    text: segments.map((s) => s.text).join(" "),
    segments,
    language: track.languageCode,
    durationSeconds,
    platform: "youtube",
    provider: "youtube_captions",
  };
}
