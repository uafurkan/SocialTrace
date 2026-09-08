"use client";

import { useState } from "react";
import { Check, HelpCircle, X } from "lucide-react";

import type { AvailabilityPlatform, AvailabilityResult } from "@/lib/username-availability/check";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PLATFORM_LABELS: Record<AvailabilityPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  youtube: "YouTube",
};

const STATUS_STYLES: Record<AvailabilityResult["status"], { label: string; className: string; icon: typeof Check }> = {
  available: { label: "Available", className: "bg-success-soft text-success", icon: Check },
  taken: { label: "Taken", className: "bg-danger-soft text-danger", icon: X },
  unknown: { label: "Couldn't check", className: "bg-surface-subtle text-muted", icon: HelpCircle },
};

export function UsernameAvailabilityWidget() {
  const [handle, setHandle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<AvailabilityResult[] | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = handle.trim().replace(/^@/, "");
    if (!trimmed) {
      setError("Enter a handle to check.");
      setResults(null);
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch(`/api/v1/username-availability?handle=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong checking that handle.");
        return;
      }
      setResults(data.results as AvailabilityResult[]);
    } catch {
      setError("Something went wrong checking that handle. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-2 shadow-default sm:flex-row sm:items-center">
        <Input
          value={handle}
          onChange={(event) => setHandle(event.target.value)}
          placeholder="Handle to check (without @)"
          aria-label="Handle to check"
          autoComplete="off"
          className="flex-1"
        />
        <Button type="submit" loading={loading} className="sm:w-auto">
          Check
        </Button>
      </form>

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      {results ? (
        <ul className="mt-6 overflow-hidden rounded-card border border-border">
          {results.map((result) => {
            const style = STATUS_STYLES[result.status];
            const Icon = style.icon;
            return (
              <li key={result.platform} className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-0">
                <span className="text-sm font-medium text-primary">{PLATFORM_LABELS[result.platform]}</span>
                <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", style.className)}>
                  <Icon className="size-3.5" aria-hidden="true" />
                  {style.label}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
