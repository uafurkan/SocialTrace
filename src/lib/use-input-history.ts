"use client";

import { useCallback, useEffect, useState } from "react";

const PREFIX = "socialtrace:input-history:";
const MAX_ITEMS = 8;

function readHistory(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Per-page, per-device input history (user request: every link/username
 * paste box should remember what was typed there before, so re-visiting a
 * page offers past entries without retyping). Stored in `localStorage`
 * only — never sent to the server, never shared across devices/browsers,
 * scoped by a caller-chosen `key` (e.g. "transcriber-url",
 * "profile-search-instagram") so different boxes on the same page (or
 * different platforms in the same widget) keep separate histories. Feeds a
 * native `<datalist>` via the returned `listId` — no custom dropdown UI
 * needed, and it degrades to "just an input" in browsers/contexts where
 * `localStorage` throws (private mode, disabled storage).
 */
export function useInputHistory(key: string) {
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    // `localStorage` doesn't exist during SSR, so the initial list can only
    // be read client-side after mount — re-reads on `key` change too, since
    // callers that reuse this hook across a platform switcher (one key per
    // platform) need a fresh list, not the previous platform's history.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory(readHistory(key));
  }, [key]);

  const addToHistory = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      try {
        const next = [trimmed, ...readHistory(key).filter((v) => v !== trimmed)].slice(0, MAX_ITEMS);
        window.localStorage.setItem(PREFIX + key, JSON.stringify(next));
        setHistory(next);
      } catch {
        // Storage full/unavailable — history just doesn't persist this time.
      }
    },
    [key],
  );

  return { history, addToHistory, listId: `history-${key}` };
}
