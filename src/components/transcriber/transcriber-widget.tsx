"use client";

import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { copy } from "@/lib/copy";

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

interface TranscriptResultPayload {
  text: string;
  segments: TranscriptSegment[];
  language: string;
  durationSeconds: number;
  platform: string;
  videoUrl: string | null;
}

type WidgetState =
  | { status: "idle" }
  | { status: "downloading" | "transcribing" }
  | { status: "done"; result: TranscriptResultPayload }
  | { status: "error"; message: string };

/**
 * Reads the API's newline-delimited JSON stream (docs/TRANSCRIBER.md
 * "Speed") instead of polling — each line is one progress/result event.
 */
async function submitForTranscription(url: string, onEvent: (event: Record<string, unknown>) => void): Promise<void> {
  const res = await fetch("/api/v1/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  const contentType = res.headers.get("Content-Type") ?? "";
  if (!contentType.includes("x-ndjson")) {
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
    onEvent({ stage: "done", result: body.result });
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("Something went wrong.");
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      onEvent(JSON.parse(line));
    }
  }
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TranscriberWidget({
  platformHint,
  autoSubmitFromQueryParam,
}: {
  platformHint?: string;
  /** Reads `?url=` from the current location on mount and submits it automatically — used when the homepage's transcribe tab hands off here. */
  autoSubmitFromQueryParam?: boolean;
}) {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<WidgetState>({ status: "idle" });
  const [copied, setCopied] = useState(false);

  async function runTranscription(targetUrl: string) {
    if (!targetUrl.trim()) return;
    setState({ status: "downloading" });
    setCopied(false);

    try {
      await submitForTranscription(targetUrl.trim(), (event) => {
        if (event.stage === "downloading") setState({ status: "downloading" });
        else if (event.stage === "done") setState({ status: "done", result: event.result as TranscriptResultPayload });
        else if (event.stage === "error") setState({ status: "error", message: (event.message as string) ?? copy.transcriber.errorGeneric });
      });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : copy.transcriber.errorGeneric });
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    void runTranscription(url);
  }

  useEffect(() => {
    if (!autoSubmitFromQueryParam) return;
    const fromQuery = new URLSearchParams(window.location.search).get("url");
    if (!fromQuery) return;
    // Mirrors the URL query param into the input once, on mount, so the
    // user sees what they pasted on the homepage — not a state/prop sync
    // this rule is meant to guard against.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(fromQuery);
    void runTranscription(fromQuery);
    // Only ever runs once, on mount — not a dependency-driven re-fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isBusy = state.status === "downloading" || state.status === "transcribing";

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <Input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={platformHint ? `Paste a ${platformHint} video link` : copy.transcriber.urlPlaceholder}
          className="flex-1"
          aria-label="Video URL"
        />
        <Button type="submit" loading={isBusy} disabled={isBusy}>
          {copy.transcriber.submitCta}
        </Button>
      </form>

      {isBusy ? (
        <p className="mt-4 text-sm text-secondary" role="status">
          {state.status === "downloading" ? copy.transcriber.stageDownloading : copy.transcriber.stageTranscribing}
        </p>
      ) : null}

      {state.status === "error" ? (
        <p className="mt-4 text-sm text-danger" role="alert">
          {state.message}
        </p>
      ) : null}

      {state.status === "done" ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
          {state.result.videoUrl ? (
            <Card className="h-fit lg:sticky lg:top-4">
              <CardContent className="pt-6">
                <video
                  src={state.result.videoUrl}
                  controls
                  playsInline
                  className="w-full rounded-card bg-black"
                  style={{ maxHeight: 480 }}
                />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardContent className="pt-6">
              {state.result.text ? (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm text-muted">
                      {state.result.language !== "auto" ? `Language: ${state.result.language}` : null}
                    </p>
                    <Button variant="secondary" size="sm" onClick={() => handleCopy(state.result.text)}>
                      {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                      {copied ? copy.transcriber.copiedCta : copy.transcriber.copyCta}
                    </Button>
                  </div>
                  <div className="mt-4 max-h-96 space-y-3 overflow-y-auto text-sm text-primary">
                    {state.result.segments.length > 0 ? (
                      state.result.segments.map((segment, index) => (
                        <p key={index}>
                          <span className="mr-2 font-mono text-xs text-muted">{formatTimestamp(segment.start)}</span>
                          {segment.text}
                        </p>
                      ))
                    ) : (
                      <p className="whitespace-pre-wrap">{state.result.text}</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-secondary">{copy.transcriber.noSpeech}</p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
