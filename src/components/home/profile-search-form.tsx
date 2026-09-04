"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";

const USERNAME_PATTERN = /^[a-z0-9._]{1,30}$/i;

const INSTAGRAM_HOST_PATTERN = /^(?:www\.)?instagram\.com$/i;

/**
 * Non-profile Instagram URL segments — if the first path part after the
 * host is one of these, the input isn't a profile link (spec §1.3: we
 * only resolve real, addressable profiles, never guess from ambiguous
 * input).
 */
const RESERVED_PATH_SEGMENTS = new Set(["p", "reel", "reels", "stories", "explore", "accounts", "direct", "tv"]);

/**
 * No search-as-you-type here on purpose — a live suggestions box means a
 * network call (and, once a real provider is enabled, a billed API call)
 * on every keystroke. Instead this requires the full username or a
 * profile link, then does exactly one lookup on submit — the same single
 * request that loading the profile page would make anyway.
 */
function extractUsername(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const withoutAt = trimmed.replace(/^@/, "");
  if (USERNAME_PATTERN.test(withoutAt)) return withoutAt;

  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (!INSTAGRAM_HOST_PATTERN.test(url.hostname)) return null;

    const [firstSegment] = url.pathname.split("/").filter(Boolean);
    if (!firstSegment || RESERVED_PATH_SEGMENTS.has(firstSegment.toLowerCase())) return null;
    return USERNAME_PATTERN.test(firstSegment) ? firstSegment : null;
  } catch {
    return null;
  }
}

const inputSchema = z.string().min(1, "Enter a username or profile link");

export function ProfileSearchForm({ size = "default" }: { size?: "default" | "compact" }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

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
    router.push(`/profile/${encodeURIComponent(username)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className={size === "compact" ? "flex gap-2" : "flex flex-col gap-3 sm:flex-row"}>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={copy.home.searchPlaceholder}
          aria-label="Instagram username or profile link"
          autoComplete="off"
          className="flex-1"
        />
        <Button type="submit" className="sm:w-auto">
          {copy.home.searchCta}
        </Button>
      </div>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </form>
  );
}
