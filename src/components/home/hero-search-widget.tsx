"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Captions, Music2, Facebook, Instagram, BarChart3, AtSign, Hash, Download, History, Users } from "lucide-react";
import { z } from "zod";

import type { Platform } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { HistorySuggestionsList, useHistorySuggestions } from "@/components/ui/history-suggestions";
import { Input } from "@/components/ui/input";
import { PasteButton } from "@/components/ui/paste-button";
import { AdGateOverlay, useAdGate } from "@/components/ads/ad-gate";
import { copy } from "@/lib/copy";
import { extractUsername } from "@/lib/profile-link";
import { useInputHistory } from "@/lib/use-input-history";
import { cn } from "@/lib/utils";

const usernameSchema = z.string().min(1, "Enter a username or profile link");

/**
 * Positions a liquid-glass indicator by its left/right edges (instead of
 * a fixed width + translateX) and gives each edge its own transition
 * delay based on travel direction — the leading edge moves immediately,
 * the trailing edge waits `edgeDelayMs`, so the pill visibly stretches
 * toward its destination before catching up and settling. That stagger
 * is what reads as a liquid drag rather than a rigid slide.
 */
function useLiquidGlassEdgeStyle(index: number, count: number, edgeDelayMs = 90): React.CSSProperties {
  // The "adjust state during render" pattern (not an effect): comparing
  // against last render's committed index, with no ref read during
  // render, is what tells us which way the indicator is travelling.
  const [prevIndex, setPrevIndex] = useState(index);
  const [direction, setDirection] = useState(0);
  if (index !== prevIndex) {
    setDirection(index > prevIndex ? 1 : -1);
    setPrevIndex(index);
  }

  return {
    left: `calc(4px + (100% - 8px) * ${index} / ${count})`,
    right: `calc(4px + (100% - 8px) * ${count - 1 - index} / ${count})`,
    "--edge-delay-left": direction === 1 ? `${edgeDelayMs}ms` : "0ms",
    "--edge-delay-right": direction === -1 ? `${edgeDelayMs}ms` : "0ms",
  } as React.CSSProperties;
}

type Mode = "profile" | "transcribe";

const MODES: { id: Mode; label: string; icon: typeof Search }[] = [
  { id: "profile", label: "Profile search", icon: Search },
  { id: "transcribe", label: "Video transcribe", icon: Captions },
];

const SOCIAL_PLATFORMS: { id: Platform; label: string; icon: typeof Search; placeholder: string; profilePath: (u: string) => string }[] = [
  { id: "instagram", label: "Instagram", icon: Instagram, placeholder: copy.home.searchPlaceholder, profilePath: (u) => `/profile/${u}` },
  { id: "tiktok", label: "TikTok", icon: Music2, placeholder: "@username or tiktok.com/@username", profilePath: (u) => `/profile/tiktok/${u}` },
  { id: "facebook", label: "Facebook", icon: Facebook, placeholder: "Page name or facebook.com/page", profilePath: (u) => `/profile/facebook/${u}` },
];

/**
 * A curated quick-launch strip, not a second `/tools` grid inline — six
 * tools chosen from this session's own competitor research into what
 * visitors search for most; the full list is one click away via "See all
 * tools" (and via primary nav, src/components/layout/site-header.tsx).
 * Renders identically regardless of `mode`/`platform` above — it's not
 * part of either form, so switching tabs never disturbs it.
 */
const QUICK_TOOLS: { href: string; label: string; icon: typeof Search }[] = [
  { href: "/tools/instagram-engagement-calculator", label: "Engagement calculator", icon: BarChart3 },
  { href: "/tools/username-availability-checker", label: "Username checker", icon: AtSign },
  { href: "/tools/hashtag-generator", label: "Hashtag generator", icon: Hash },
  { href: "/tools/video-downloader", label: "Video downloader", icon: Download },
  { href: "/tools/instagram-bio-history", label: "Bio history", icon: History },
  { href: "/tools/instagram-follower-checker", label: "Follower checker", icon: Users },
];

export function HeroSearchWidget() {
  const [mode, setMode] = useState<Mode>("profile");
  const router = useRouter();

  const [platform, setPlatform] = useState<Platform>("instagram");
  // One shared value for both modes' input box — typing a link/username in
  // either "Profile search" or "Video transcribe" and switching tabs keeps
  // it there instead of clearing the other box. Each mode still validates
  // and submits it its own way (extractUsername vs. a bare URL check).
  const [inputValue, setInputValue] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const { pending, navigate, continueNavigation } = useAdGate();

  const [videoError, setVideoError] = useState<string | null>(null);

  const activePlatform = SOCIAL_PLATFORMS.find((p) => p.id === platform)!;
  const activePlatformIndex = SOCIAL_PLATFORMS.findIndex((p) => p.id === platform);
  const modeIndex = MODES.findIndex((m) => m.id === mode);
  const modeEdgeStyle = useLiquidGlassEdgeStyle(modeIndex, MODES.length);
  const platformEdgeStyle = useLiquidGlassEdgeStyle(activePlatformIndex, SOCIAL_PLATFORMS.length);
  const { history: usernameHistory, addToHistory: addUsernameToHistory } = useInputHistory(`hero-username-${platform}`);
  const {
    containerRef: usernameHistoryContainerRef,
    isOpen: isUsernameHistoryOpen,
    setIsOpen: setIsUsernameHistoryOpen,
    matches: usernameHistoryMatches,
  } = useHistorySuggestions(usernameHistory, inputValue);
  const { history: videoHistory, addToHistory: addVideoToHistory } = useInputHistory("hero-video-url");
  const {
    containerRef: videoHistoryContainerRef,
    isOpen: isVideoHistoryOpen,
    setIsOpen: setIsVideoHistoryOpen,
    matches: videoHistoryMatches,
  } = useHistorySuggestions(videoHistory, inputValue);

  function switchMode(next: Mode) {
    setMode(next);
    // Clear whichever mode's error is stale — the shared value carries over
    // on purpose, but an old "paste a video link" message shouldn't linger
    // once you've switched to Profile search, and vice versa.
    setUsernameError(null);
    setVideoError(null);
  }

  function handleProfileSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = usernameSchema.safeParse(inputValue);
    if (!result.success) {
      setUsernameError(result.error.issues[0]?.message ?? "Enter a username or profile link");
      return;
    }
    const handle = extractUsername(result.data, platform);
    if (!handle) {
      setUsernameError(`Enter a full username or a valid ${activePlatform.label} profile link`);
      return;
    }
    setUsernameError(null);
    addUsernameToHistory(result.data);
    const path = activePlatform.profilePath(encodeURIComponent(handle));
    navigate(path, `profile:${platform}:${handle.toLowerCase()}`);
  }

  function handleVideoSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!inputValue.trim()) {
      setVideoError("Paste a video link");
      return;
    }
    setVideoError(null);
    addVideoToHistory(inputValue.trim());
    router.push(`/transcribe?url=${encodeURIComponent(inputValue.trim())}`);
  }

  return (
    <div className="w-full max-w-lg">
      {pending ? <AdGateOverlay onContinue={continueNavigation} /> : null}

      <div className="liquid-glass-track relative inline-grid grid-cols-2 rounded-full p-1">
        <span aria-hidden="true" className="liquid-glass-indicator" style={modeEdgeStyle} />
        {MODES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => switchMode(id)}
            aria-pressed={mode === id}
            className={cn(
              "relative z-10 flex min-h-[36px] items-center justify-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors",
              mode === id ? "text-brand-strong" : "text-secondary hover:text-primary",
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
            <div className="liquid-glass-track-sm mb-2 grid grid-cols-3 rounded-full p-1">
              <span aria-hidden="true" className="liquid-glass-indicator-sm" style={platformEdgeStyle} />
              {SOCIAL_PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPlatform(p.id);
                    setUsernameError(null);
                  }}
                  aria-pressed={platform === p.id}
                  className={cn(
                    "relative z-10 flex items-center justify-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    platform === p.id ? "text-primary" : "text-muted hover:text-secondary",
                  )}
                >
                  <p.icon className="size-3.5" aria-hidden="true" />
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-2 shadow-default sm:flex-row sm:items-center">
              <div className="relative flex-1" ref={usernameHistoryContainerRef}>
                <activePlatform.icon
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                  aria-hidden="true"
                />
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onFocus={() => setIsUsernameHistoryOpen(true)}
                  placeholder={activePlatform.placeholder}
                  aria-label={`${activePlatform.label} username or profile link`}
                  autoComplete="off"
                  className="border-0 pl-9 pr-20 shadow-none focus-visible:border-0 focus-visible:ring-0"
                />
                <PasteButton onPaste={setInputValue} />
                {isUsernameHistoryOpen ? (
                  <HistorySuggestionsList
                    items={usernameHistoryMatches}
                    onSelect={(item) => {
                      setInputValue(item);
                      setIsUsernameHistoryOpen(false);
                    }}
                  />
                ) : null}
              </div>
              <Button type="submit" className="sm:w-auto">
                {copy.home.searchCta}
              </Button>
            </div>
            {usernameError ? <p className="mt-2 text-sm text-danger">{usernameError}</p> : null}
            <p className="mt-3 text-sm text-muted">{copy.home.noAccountNote}</p>
            {platform === "instagram" ? (
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
            ) : null}
          </form>
        ) : (
          <form onSubmit={handleVideoSubmit}>
            <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-2 shadow-default sm:flex-row sm:items-center">
              <div className="relative flex-1" ref={videoHistoryContainerRef}>
                <Captions
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                  aria-hidden="true"
                />
                <Input
                  type="url"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onFocus={() => setIsVideoHistoryOpen(true)}
                  placeholder={copy.transcriber.urlPlaceholder}
                  aria-label="Video URL"
                  autoComplete="off"
                  className="border-0 pl-9 pr-20 shadow-none focus-visible:border-0 focus-visible:ring-0"
                />
                <PasteButton onPaste={setInputValue} />
                {isVideoHistoryOpen ? (
                  <HistorySuggestionsList
                    items={videoHistoryMatches}
                    onSelect={(item) => {
                      setInputValue(item);
                      setIsVideoHistoryOpen(false);
                    }}
                  />
                ) : null}
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

      <div className="mt-6 border-t border-border pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">More tools</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {QUICK_TOOLS.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="flex items-center gap-1.5 rounded-button border border-border bg-surface px-2.5 py-2 text-xs font-medium text-secondary transition-colors hover:border-primary/40 hover:text-primary"
            >
              <tool.icon className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{tool.label}</span>
            </Link>
          ))}
        </div>
        <Link href="/tools" className="mt-2 inline-block text-xs font-medium text-brand-strong hover:underline">
          See all tools →
        </Link>
      </div>
    </div>
  );
}
