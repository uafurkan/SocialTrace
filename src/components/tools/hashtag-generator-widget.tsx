"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

interface HashtagGenerationResult {
  hashtags: string[];
  matchedCategories: string[];
  isGenericFallback: boolean;
}

export function HashtagGeneratorWidget() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HashtagGenerationResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) {
      setError("Paste a caption or describe your video/post first.");
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setCopied(false);
    try {
      const res = await fetch("/api/v1/hashtag-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong generating hashtags.");
        return;
      }
      setResult(data as HashtagGenerationResult);
    } catch {
      setError("Something went wrong generating hashtags. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyAll() {
    if (!result) return;
    await navigator.clipboard.writeText(result.hashtags.join(" "));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Paste a caption or describe your video/post..."
          aria-label="Caption or topic"
          rows={4}
          className="w-full rounded-card border border-border bg-surface p-3 text-sm text-primary shadow-default focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <Button type="submit" loading={loading} className="self-start">
          Generate hashtags
        </Button>
      </form>

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      {result ? (
        <div className="mt-6 rounded-card border border-border bg-surface p-5">
          {result.isGenericFallback ? (
            <p className="mb-3 text-sm text-muted">No strong topic match found — here are some general tags instead.</p>
          ) : (
            <p className="mb-3 text-sm text-muted">
              Matched: {result.matchedCategories.join(", ")}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {result.hashtags.map((hashtag) => (
              <span key={hashtag} className="rounded-full bg-surface-subtle px-3 py-1 text-sm text-primary">
                {hashtag}
              </span>
            ))}
          </div>
          <Button variant="secondary" size="sm" className="mt-4" onClick={handleCopyAll}>
            {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
            {copied ? "Copied" : "Copy all"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
