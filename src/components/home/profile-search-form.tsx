"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdGateOverlay, useAdGate } from "@/components/ads/ad-gate";
import { copy } from "@/lib/copy";
import { extractUsername } from "@/lib/profile-link";

const inputSchema = z.string().min(1, "Enter a username or profile link");

export function ProfileSearchForm({ size = "default" }: { size?: "default" | "compact" }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { pending, navigate, continueNavigation } = useAdGate();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const result = inputSchema.safeParse(value);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Enter a username or profile link");
      return;
    }

    const username = extractUsername(result.data);
    if (!username) {
      setError("Enter a full username (e.g. nike) or a profile link (e.g. instagram.com/nike)");
      return;
    }

    setError(null);
    // Gated (once per username per session) — see src/components/ads/ad-gate.tsx.
    navigate(`/profile/${encodeURIComponent(username)}`, `profile:${username.toLowerCase()}`);
  }

  const isCompact = size === "compact";

  return (
    <form onSubmit={handleSubmit} className="w-full">
      {pending ? <AdGateOverlay onContinue={continueNavigation} /> : null}
      <div
        className={
          isCompact
            ? "flex gap-2"
            : "flex flex-col gap-2 rounded-card border border-border bg-surface p-2 shadow-default sm:flex-row sm:items-center"
        }
      >
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={copy.home.searchPlaceholder}
            aria-label="Instagram username or profile link"
            autoComplete="off"
            className={isCompact ? "pl-9" : "border-0 pl-9 shadow-none focus-visible:border-0 focus-visible:ring-0"}
          />
        </div>
        <Button type="submit" className="sm:w-auto">
          {copy.home.searchCta}
        </Button>
      </div>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </form>
  );
}
