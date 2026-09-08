"use client";

import { useState } from "react";

import type { Platform } from "@/lib/domain/types";
import type { EngagementResult } from "@/lib/engagement/calculate";
import { extractUsername } from "@/lib/profile-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PLATFORMS: Array<{ id: Platform; label: string }> = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "facebook", label: "Facebook" },
];

type ErrorReason = "profile_not_found" | "private_account" | "no_posts" | "engagement_failed";

const ERROR_COPY: Record<ErrorReason, string> = {
  profile_not_found: "No public profile found for that username.",
  private_account: "This account is private — engagement can't be calculated from a private profile.",
  no_posts: "This profile has no public posts to sample.",
  engagement_failed: "Something went wrong calculating engagement. Try again in a moment.",
};

export function EngagementCalculatorWidget() {
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EngagementResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const handle = extractUsername(username, platform);
    if (!handle) {
      setError("Enter a full username or a valid profile link.");
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/v1/engagement-calculator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, username: handle }),
      });
      const data = await res.json();
      if (!res.ok) {
        const reason = (data?.error as ErrorReason) ?? "engagement_failed";
        setError(ERROR_COPY[reason] ?? ERROR_COPY.engagement_failed);
        return;
      }
      setResult(data.result as EngagementResult);
    } catch {
      setError(ERROR_COPY.engagement_failed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-2 shadow-default sm:flex-row sm:items-center">
        <select
          aria-label="Platform"
          value={platform}
          onChange={(event) => setPlatform(event.target.value as Platform)}
          className="h-11 shrink-0 cursor-pointer rounded-button border border-border bg-surface px-3 text-sm font-medium text-primary sm:w-36"
        >
          {PLATFORMS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <Input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Username or profile link"
          aria-label="Username or profile link"
          autoComplete="off"
          className="flex-1"
        />
        <Button type="submit" loading={loading} className="sm:w-auto">
          Calculate
        </Button>
      </form>

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      {result ? (
        <div className="mt-6 rounded-card border border-border bg-surface p-5">
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-semibold text-primary">{result.engagementRatePercent.toFixed(2)}%</span>
            <span className="text-sm text-muted">engagement rate</span>
          </div>
          <p className="mt-2 text-sm text-secondary">
            Based on the {result.sampleSize} most recent posts from @{result.username} ({result.followerCount.toLocaleString()} followers).
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <div className="text-muted">Avg. likes</div>
              <div className="font-semibold text-primary">{Math.round(result.avgLikes).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-muted">Avg. comments</div>
              <div className="font-semibold text-primary">{Math.round(result.avgComments).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-muted">Posts sampled</div>
              <div className="font-semibold text-primary">
                {result.sampleSize} of {result.requestedSampleSize} requested
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
