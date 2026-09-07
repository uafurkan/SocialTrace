"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Copy, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasteButton } from "@/components/ui/paste-button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { copy } from "@/lib/copy";
import { TRANSCRIPTION_LANGUAGES, TRANSLATION_TARGET_LANGUAGES } from "@/lib/transcription/languages";
import { useInputHistory } from "@/lib/use-input-history";

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
  | { status: "downloading" }
  /** `videoUrl` arrives as soon as the download step finishes, well before transcription completes — lets the user start watching immediately instead of waiting for the whole pipeline. */
  | { status: "transcribing"; videoUrl: string | null }
  | { status: "done"; result: TranscriptResultPayload }
  | { status: "error"; message: string };

type TranslationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; text: string; segments: TranscriptSegment[]; languageLabel: string }
  | { status: "error"; message: string };

/**
 * Reads the API's newline-delimited JSON stream (docs/TRANSCRIBER.md
 * "Speed") instead of polling — each line is one progress/result event.
 */
async function submitForTranscription(
  url: string,
  language: string | undefined,
  onEvent: (event: Record<string, unknown>) => void,
): Promise<void> {
  const res = await fetch("/api/v1/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, language }),
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

function plainTextOf(text: string, segments: TranscriptSegment[]): string {
  return segments.length > 0 ? segments.map((s) => s.text).join(" ") : text;
}

function timestampedTextOf(text: string, segments: TranscriptSegment[]): string {
  if (segments.length === 0) return text;
  return segments.map((s) => `[${formatTimestamp(s.start)}] ${s.text}`).join("\n");
}

function VideoPreview({ videoUrl }: { videoUrl: string }) {
  return (
    <Card className="h-fit lg:sticky lg:top-4">
      <CardContent className="pt-6">
        <video src={videoUrl} controls playsInline className="w-full rounded-card bg-black" style={{ maxHeight: 480 }} />
      </CardContent>
    </Card>
  );
}

function TranscriptBody({
  text,
  segments,
  emptyMessage,
}: {
  text: string;
  segments: TranscriptSegment[];
  emptyMessage: string;
}) {
  const [copiedKind, setCopiedKind] = useState<"text" | "timestamps" | null>(null);

  async function handleCopy(kind: "text" | "timestamps") {
    const value = kind === "text" ? plainTextOf(text, segments) : timestampedTextOf(text, segments);
    await navigator.clipboard.writeText(value);
    setCopiedKind(kind);
    setTimeout(() => setCopiedKind(null), 2000);
  }

  if (!text) {
    return <p className="text-sm text-secondary">{emptyMessage}</p>;
  }

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <Button variant="secondary" size="sm" onClick={() => handleCopy("text")}>
          {copiedKind === "text" ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          {copiedKind === "text" ? copy.transcriber.copiedCta : copy.transcriber.copyCta}
        </Button>
        {segments.length > 0 ? (
          <Button variant="secondary" size="sm" onClick={() => handleCopy("timestamps")}>
            {copiedKind === "timestamps" ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
            {copiedKind === "timestamps" ? copy.transcriber.copiedCta : copy.transcriber.copyTimestampsCta}
          </Button>
        ) : null}
      </div>
      <div className="mt-4 max-h-96 space-y-3 overflow-y-auto text-sm text-primary">
        {segments.length > 0 ? (
          segments.map((segment, index) => (
            <p key={index}>
              <span className="mr-2 font-mono text-xs text-muted">{formatTimestamp(segment.start)}</span>
              {segment.text}
            </p>
          ))
        ) : (
          <p className="whitespace-pre-wrap">{text}</p>
        )}
      </div>
    </>
  );
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
  const [language, setLanguage] = useState("auto");
  const [state, setState] = useState<WidgetState>({ status: "idle" });
  const [translateTarget, setTranslateTarget] = useState(TRANSLATION_TARGET_LANGUAGES[0].code);
  const [translation, setTranslation] = useState<TranslationState>({ status: "idle" });
  const [activeTab, setActiveTab] = useState<"original" | "translated">("original");
  const { history: urlHistory, addToHistory: addUrlToHistory, listId: urlHistoryListId } = useInputHistory(
    `transcriber-url${platformHint ? `-${platformHint.toLowerCase()}` : ""}`,
  );

  async function runTranscription(targetUrl: string) {
    if (!targetUrl.trim()) return;
    addUrlToHistory(targetUrl.trim());
    setState({ status: "downloading" });
    setTranslation({ status: "idle" });
    setActiveTab("original");

    try {
      await submitForTranscription(targetUrl.trim(), language === "auto" ? undefined : language, (event) => {
        if (event.stage === "downloading") setState({ status: "downloading" });
        else if (event.stage === "transcribing") setState({ status: "transcribing", videoUrl: (event.videoUrl as string) ?? null });
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

  const searchParams = useSearchParams();
  const urlParam = searchParams.get("url");
  const lastHandledUrlParam = useRef<string | null>(null);

  useEffect(() => {
    if (!autoSubmitFromQueryParam || !urlParam) return;
    // Next.js reuses this component across a same-route navigation (e.g.
    // the mobile header's video-paste box submitting a second link while
    // already on /transcribe) — it doesn't remount, so a mount-only effect
    // would only ever catch the first link. Keying off the query param's
    // value itself (via the ref, since re-running on every render would
    // just re-submit the same value forever) makes every distinct `?url=`
    // trigger a run, whether it arrived on first load or a later push.
    if (lastHandledUrlParam.current === urlParam) return;
    lastHandledUrlParam.current = urlParam;
    // Mirrors the URL query param into the input so the user sees what
    // they pasted — not a state/prop sync this rule is meant to guard
    // against, since the source of truth here is the URL, not a prop.
    setUrl(urlParam);
    void runTranscription(urlParam);
    // runTranscription is stable enough in practice here (recreated each
    // render, but only ever called through this guarded branch) — adding
    // it would re-run this effect on every state change runTranscription
    // closes over, defeating the ref guard above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSubmitFromQueryParam, urlParam]);

  async function handleTranslate() {
    if (state.status !== "done") return;
    const target = TRANSLATION_TARGET_LANGUAGES.find((l) => l.code === translateTarget);
    if (!target) return;

    setTranslation({ status: "loading" });
    try {
      const res = await fetch("/api/v1/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: state.result.text, segments: state.result.segments, targetLanguage: target.code }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? copy.transcriber.translateErrorGeneric);
      setTranslation({ status: "done", text: body.result.text, segments: body.result.segments ?? [], languageLabel: target.label });
      setActiveTab("translated");
    } catch (error) {
      setTranslation({ status: "error", message: error instanceof Error ? error.message : copy.transcriber.translateErrorGeneric });
    }
  }

  const isBusy = state.status === "downloading" || state.status === "transcribing";

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={platformHint ? `Paste a ${platformHint} video link` : copy.transcriber.urlPlaceholder}
              className="pr-20"
              aria-label="Video URL"
              list={urlHistoryListId}
              autoComplete="off"
            />
            <PasteButton onPaste={setUrl} />
            <datalist id={urlHistoryListId}>
              {urlHistory.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>
          <Button type="submit" loading={isBusy} disabled={isBusy}>
            {copy.transcriber.submitCta}
          </Button>
        </div>
        <div className="flex flex-col gap-1 sm:max-w-xs">
          <label htmlFor="transcriber-language" className="text-xs font-medium text-secondary">
            {copy.transcriber.languageLabel}
          </label>
          <select
            id="transcriber-language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="h-10 rounded-button border border-border bg-surface px-3 text-sm text-primary focus-visible:border-brand"
          >
            {TRANSCRIPTION_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted">{copy.transcriber.languageHint}</p>
        </div>
      </form>

      {isBusy ? (
        <div className={state.status === "transcribing" && state.videoUrl ? "mt-6 grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]" : undefined}>
          {state.status === "transcribing" && state.videoUrl ? <VideoPreview videoUrl={state.videoUrl} /> : null}
          <p className="mt-4 text-sm text-secondary" role="status">
            {state.status === "downloading" ? copy.transcriber.stageDownloading : copy.transcriber.stageTranscribing}
          </p>
        </div>
      ) : null}

      {state.status === "error" ? (
        <p className="mt-4 text-sm text-danger" role="alert">
          {state.message}
        </p>
      ) : null}

      {state.status === "done" ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr] lg:items-start">
          {state.result.videoUrl ? <VideoPreview videoUrl={state.result.videoUrl} /> : null}

          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border pb-4">
                <h2 className="text-sm font-semibold text-primary">{copy.transcriber.resultHeading}</h2>
                {state.result.language !== "auto" ? (
                  <span className="rounded-full bg-surface-subtle px-2.5 py-1 text-xs font-medium text-secondary">
                    {state.result.language}
                  </span>
                ) : null}
              </div>

              {state.result.text ? (
                <div className="flex flex-col gap-1 sm:max-w-xs">
                  <label htmlFor="translate-target" className="text-xs font-medium text-secondary">
                    {copy.transcriber.translateLabel}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <select
                      id="translate-target"
                      value={translateTarget}
                      onChange={(e) => setTranslateTarget(e.target.value)}
                      className="h-10 min-w-0 flex-1 rounded-button border border-border bg-surface px-3 text-sm text-primary focus-visible:border-brand"
                    >
                      {TRANSLATION_TARGET_LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      loading={translation.status === "loading"}
                      disabled={translation.status === "loading"}
                      onClick={handleTranslate}
                    >
                      {translation.status === "loading" ? copy.transcriber.translatingCta : copy.transcriber.translateCta}
                    </Button>
                  </div>
                  {translation.status === "error" ? (
                    <p className="text-xs text-danger" role="alert">
                      {translation.message}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {translation.status === "done" ? (
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "original" | "translated")}>
                  <TabsList>
                    <TabsTrigger value="original">{copy.transcriber.tabOriginal}</TabsTrigger>
                    <TabsTrigger value="translated">
                      {copy.transcriber.tabTranslated} ({translation.languageLabel})
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="original">
                    <TranscriptBody text={state.result.text} segments={state.result.segments} emptyMessage={copy.transcriber.noSpeech} />
                  </TabsContent>
                  <TabsContent value="translated">
                    <TranscriptBody text={translation.text} segments={translation.segments} emptyMessage={copy.transcriber.noSpeech} />
                  </TabsContent>
                </Tabs>
              ) : (
                <TranscriptBody text={state.result.text} segments={state.result.segments} emptyMessage={copy.transcriber.noSpeech} />
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
