"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Captions } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdGateOverlay, useAdGate } from "@/components/ads/ad-gate";
import { copy } from "@/lib/copy";
import { extractUsername } from "@/lib/profile-link";
import { cn } from "@/lib/utils";

const usernameSchema = z.string().min(1, "Enter a username or profile link");

type Mode = "profile" | "transcribe";

const MODES: { id: Mode; label: string; icon: typeof Search }[] = [
  { id: "profile", label: "Profile search", icon: Search },
  { id: "transcribe", label: "Video transcribe", icon: Captions },
];

export function HeroSearchWidget() {
  const [mode, setMode] = useState<Mode>("profile");
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const { pending, navigate, continueNavigation } = useAdGate();

  const [videoUrl, setVideoUrl] = useState("");
  const [videoError, setVideoError] = useState<string | null>(null);

  function handleProfileSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = usernameSchema.safeParse(username);
    if (!result.success) {
      setUsernameError(result.error.issues[0]?.message ?? "Enter a username or profile link");
      return;
    }
    const handle = extractUsername(result.data);
    if (!handle) {
      setUsernameError("Enter a full username (e.g. nike) or a profile link (e.g. instagram.com/nike)");
      return;
    }
    setUsernameError(null);
    navigate(`/profile/${encodeURIComponent(handle)}`, `profile:${handle.toLowerCase()}`);
  }

  function handleVideoSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!videoUrl.trim()) {
      setVideoError("Paste a video link");
      return;
    }
    setVideoError(null);
    router.push(`/transcribe?url=${encodeURIComponent(videoUrl.trim())}`);
  }

  return (
    <div className="w-full max-w-lg">
      {pending ? <AdGateOverlay onContinue={continueNavigation} /> : null}

      <div className="inline-flex rounded-full border border-border bg-surface-subtle p-1">
        {MODES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            aria-pressed={mode === id}
            className={cn(
              "flex min-h-[36px] items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors",
              mode === id ? "bg-surface text-brand-strong shadow-default" : "text-secondary hover:text-primary",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {mode === "profile" ? (
          <form onSubmit={handleProfileSubmit}>
            <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-2 shadow-default sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                  aria-hidden="true"
                />
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={copy.home.searchPlaceholder}
                  aria-label="Instagram username or profile link"
                  autoComplete="off"
                  className="border-0 pl-9 shadow-none focus-visible:border-0 focus-visible:ring-0"
                />
              </div>
              <Button type="submit" className="sm:w-auto">
                {copy.home.searchCta}
              </Button>
            </div>
            {usernameError ? <p className="mt-2 text-sm text-danger">{usernameError}</p> : null}
            <p className="mt-3 text-sm text-muted">{copy.home.noAccountNote}</p>
            <p className="mt-1 text-sm text-muted">
              Try{" "}
              <Link href="/profile/nike" className="text-brand-strong underline underline-offset-2">
                @nike
              </Link>{" "}
              or{" "}
              <Link href="/profile/smallcreator" className="text-brand-strong underline underline-offset-2">
                @smallcreator
              </Link>
              .
            </p>
          </form>
        ) : (
          <form onSubmit={handleVideoSubmit}>
            <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-2 shadow-default sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Captions
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                  aria-hidden="true"
                />
                <Input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder={copy.transcriber.urlPlaceholder}
                  aria-label="Video URL"
                  autoComplete="off"
                  className="border-0 pl-9 shadow-none focus-visible:border-0 focus-visible:ring-0"
                />
              </div>
              <Button type="submit" className="sm:w-auto">
                {copy.transcriber.submitCta}
              </Button>
            </div>
            {videoError ? <p className="mt-2 text-sm text-danger">{videoError}</p> : null}
            <p className="mt-3 text-sm text-muted">YouTube, TikTok, Instagram, or Facebook — free, no sign-up required.</p>
          </form>
        )}
      </div>
    </div>
  );
}
