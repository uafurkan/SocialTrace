"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";
import type { SocialUser } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const usernameSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/^@/, ""))
  .pipe(z.string().min(1, "Enter a username").max(30, "Username is too long"));

/**
 * Real search-as-you-type is not instant (~6-7s per lookup against real
 * Instagram data — see docs/PROVIDER_CONTRACT.md), so this debounces on a
 * pause in typing rather than firing per keystroke, and shows a loading
 * state while the request is in flight instead of pretending it's live.
 */
const SEARCH_DEBOUNCE_MS = 500;

export function ProfileSearchForm({ size = "default" }: { size?: "default" | "compact" }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SocialUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLFormElement>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const query = value.trim().replace(/^@/, "");
    if (!query) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const requestId = ++requestIdRef.current;
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(query)}`);
        const data = (await res.json()) as { items: SocialUser[] };
        if (requestIdRef.current === requestId) {
          setSuggestions(data.items);
          setIsOpen(true);
          setHighlightedIndex(-1);
        }
      } catch {
        if (requestIdRef.current === requestId) setSuggestions([]);
      } finally {
        if (requestIdRef.current === requestId) setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function goToProfile(username: string) {
    setIsOpen(false);
    router.push(`/profile/${encodeURIComponent(username)}`);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
      goToProfile(suggestions[highlightedIndex].username);
      return;
    }
    const result = usernameSchema.safeParse(value);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Enter a valid username");
      return;
    }
    setError(null);
    goToProfile(result.data);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (!isOpen || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, -1));
    } else if (event.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="relative w-full" ref={containerRef}>
      <div className={size === "compact" ? "flex gap-2" : "flex flex-col gap-3 sm:flex-row"}>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={copy.home.searchPlaceholder}
          aria-label="Instagram username"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          role="combobox"
          autoComplete="off"
          className="flex-1"
        />
        <Button type="submit" className="sm:w-auto">
          {copy.home.searchCta}
        </Button>
      </div>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}

      {isOpen && (isSearching || suggestions.length > 0) ? (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-card border border-border bg-surface shadow-elevated"
        >
          {isSearching && suggestions.length === 0 ? (
            <li className="px-4 py-3 text-sm text-secondary">Searching Instagram…</li>
          ) : null}
          {suggestions.map((user, index) => (
            <li key={user.id}>
              <button
                type="button"
                role="option"
                aria-selected={index === highlightedIndex}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => goToProfile(user.username)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-subtle",
                  index === highlightedIndex && "bg-surface-subtle",
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-subtle text-xs font-medium text-muted">
                  {user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatarUrl} alt="" className="size-full object-cover" />
                  ) : (
                    user.username.slice(0, 2).toUpperCase()
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-primary">@{user.username}</span>
                  <span className="block truncate text-xs text-secondary">{user.displayName}</span>
                </span>
                {user.isVerified ? <span className="shrink-0 text-xs text-info">✓</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
