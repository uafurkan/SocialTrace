"use client";

import { useCallback, useEffect, useState } from "react";

import { clearEntries, readEntries, writeEntry, type StorageLike } from "@/lib/input-history";

/** `window.localStorage`, or null where reading it throws (blocked site data). */
function getStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Per-page, per-device input history (user request: every link/username
 * paste box should remember what was typed there before, so re-visiting a
 * page offers past entries without retyping). Stored in `localStorage`
 * only — never sent to the server, never shared across devices/browsers,
 * scoped by a caller-chosen `key` (e.g. "transcriber-url",
 * "profile-search-instagram") so different boxes on the same page (or
 * different platforms in the same widget) keep separate histories.
 *
 * Entries expire after 30 days and the list is capped; the rules live in
 * `lib/input-history.ts`. `clearHistory` empties this key's history.
 *
 * Feeds `components/ui/history-suggestions.tsx`'s custom dropdown, not a
 * native `<datalist>` (an earlier version of this hook returned a
 * `listId` for exactly that) — `<datalist>`'s rendering turned out to be
 * genuinely poor and inconsistent (an unstyled, misaligned popup in
 * Chrome; largely invisible on iOS Safari, this project's own priority
 * platform), unlike `<select>`, so this isn't a case where "let the
 * browser render it" is the right call. Degrades to "just an input" in
 * browsers/contexts where `localStorage` throws (private mode, disabled
 * storage).
 */
export function useInputHistory(key: string) {
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    // `localStorage` doesn't exist during SSR, so the initial list can only
    // be read client-side after mount — re-reads on `key` change too, since
    // callers that reuse this hook across a platform switcher (one key per
    // platform) need a fresh list, not the previous platform's history.
    const storage = getStorage();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory(storage ? readEntries(storage, key, Date.now()) : []);
  }, [key]);

  const addToHistory = useCallback(
    (value: string) => {
      const storage = getStorage();
      if (!storage) return;
      setHistory(writeEntry(storage, key, value, Date.now()));
    },
    [key],
  );

  const clearHistory = useCallback(() => {
    const storage = getStorage();
    if (storage) clearEntries(storage, key);
    setHistory([]);
  }, [key]);

  return { history, addToHistory, clearHistory };
}
