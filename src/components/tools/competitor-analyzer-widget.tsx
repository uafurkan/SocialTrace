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

/** Copy per reason code. The server's own message text is never shown. */
const ERROR_COPY = new Map<string, string>([
  ["rate_limited", "Too many requests right now. Try again in a minute."],
  ["profile_not_found", "No public profile found for that username."],
  ["private_account", "This account is private — engagement can't be calculated from a private profile."],
  ["no_posts", "This profile has no public posts to sample."],
  ["source_unavailable", "We couldn't reach the data source for this profile right now. Please try again shortly."],
  ["timeout", "This profile took too long to analyze. Try again in a moment."],
  ["engagement_failed", "Something went wrong calculating engagement."],
]);
const GENERIC_SIDE_ERROR = "Could not analyze this profile. Try again in a moment.";
const GENERIC_COMPARE_ERROR = "Something went wrong comparing these profiles. Try again in a moment.";

interface Side {
  platform: Platform;
  username: string;
}

interface SideResult {
  result?: EngagementResult;
  error?: { reason: string };
}

function copyForReason(reason: string | undefined): string {
  return (reason === undefined ? undefined : ERROR_COPY.get(reason)) ?? GENERIC_SIDE_ERROR;
}

function ProfileInput({
  label,
  side,
  onChange,
}: {
  label: string;
  side: Side;
  onChange: (side: Side) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-2 shadow-default sm:flex-row sm:items-center">
      <select
        aria-label={`${label} platform`}
        value={side.platform}
        onChange={(event) => onChange({ ...side, platform: event.target.value as Platform })}
        className="h-11 shrink-0 cursor-pointer rounded-button border border-border bg-surface px-3 text-sm font-medium text-primary sm:w-36"
      >
        {PLATFORMS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      <Input
        value={side.username}
        onChange={(event) => onChange({ ...side, username: event.target.value })}
        placeholder={`${label} — username or profile link`}
        aria-label={`${label} username or profile link`}
        autoComplete="off"
        className="flex-1"
      />
    </div>
  );
}

function ResultColumn({ label, side }: { label: string; side: SideResult | null }) {
  if (!side) return <div className="flex-1 rounded-card border border-dashed border-border-strong p-5 text-sm text-muted">{label}</div>;
  if (side.error || !side.result) {
    return (
      <div className="flex-1 rounded-card border border-border bg-surface p-5">
        <p className="text-sm font-medium text-primary">{label}</p>
        <p className="mt-2 text-sm text-danger">{copyForReason(side.error?.reason)}</p>
      </div>
    );
  }
  const result = side.result;
  return (
    <div className="flex-1 rounded-card border border-border bg-surface p-5">
      <p className="text-sm font-medium text-primary">
        {label} — @{result.username}
      </p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-semibold text-primary">{result.engagementRatePercent.toFixed(2)}%</span>
        <span className="text-sm text-muted">engagement</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-muted">Followers</div>
          <div className="font-semibold text-primary">{result.followerCount.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-muted">Posts sampled</div>
          <div className="font-semibold text-primary">{result.sampleSize}</div>
        </div>
        <div>
          <div className="text-muted">Avg. likes</div>
          <div className="font-semibold text-primary">{Math.round(result.avgLikes).toLocaleString()}</div>
        </div>
        <div>
          <div className="text-muted">Avg. comments</div>
          <div className="font-semibold text-primary">{Math.round(result.avgComments).toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}

export function CompetitorAnalyzerWidget() {
  const [a, setA] = useState<Side>({ platform: "instagram", username: "" });
  const [b, setB] = useState<Side>({ platform: "instagram", username: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ a: SideResult; b: SideResult } | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const handleA = extractUsername(a.username, a.platform);
    const handleB = extractUsername(b.username, b.platform);
    if (!handleA || !handleB) {
      setError("Enter a full username or a valid profile link for both profiles.");
      setResults(null);
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch("/api/v1/competitor-analyzer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ a: { platform: a.platform, username: handleA }, b: { platform: b.platform, username: handleB } }),
      });
      const data: { a?: SideResult; b?: SideResult; error?: unknown } | null = await res.json().catch(() => null);
      if (res.status === 400) {
        setError(typeof data?.error === "string" ? data.error : GENERIC_COMPARE_ERROR);
        return;
      }
      if (res.status === 429) {
        // Rate limited before either profile was analyzed: both boxes say so.
        const limited: SideResult = { error: { reason: "rate_limited" } };
        setResults({ a: limited, b: limited });
        return;
      }
      if (!data?.a || !data?.b) {
        // Not a comparison payload (for example a gateway error page). Both boxes
        // get a generic message; the response body is never displayed.
        const failed: SideResult = { error: { reason: "engagement_failed" } };
        setResults({ a: failed, b: failed });
        return;
      }
      setResults({ a: data.a, b: data.b });
    } catch {
      setError(GENERIC_COMPARE_ERROR);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <ProfileInput label="Profile A" side={a} onChange={setA} />
        <ProfileInput label="Profile B" side={b} onChange={setB} />
        <Button type="submit" loading={loading} className="self-start">
          Compare
        </Button>
      </form>

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      {results ? (
        <div className="mt-6 flex flex-col gap-4 sm:flex-row">
          <ResultColumn label="Profile A" side={results.a} />
          <ResultColumn label="Profile B" side={results.b} />
        </div>
      ) : null}
    </div>
  );
}
