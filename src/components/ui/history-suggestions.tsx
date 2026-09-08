"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Replaces the browser's native `<datalist>` for the per-device paste-
 * history feature (`useInputHistory`). `<datalist>`, unlike `<select>`,
 * isn't a real cross-platform native control — confirmed live: Chrome
 * renders its suggestion popup as an unstyled floating box that isn't
 * even anchored to the input's own box (it can visually overlap
 * unrelated page content below it), and Safari — especially iOS, this
 * project's own priority platform — largely doesn't render datalist
 * suggestions for a text input at all. There's no "let the OS handle it"
 * option here the way there is for `<select>`, so this is a small,
 * purpose-built dropdown instead: styled with the same tokens as every
 * other popover on the site (bg-surface/border/shadow-elevated) and
 * anchored correctly under the input on every platform, including iOS.
 *
 * `useHistorySuggestions` owns the open/close state and the click-outside
 * listener (same pattern the old `ExportMenu` used) so every call site
 * shares identical behavior instead of five hand-rolled copies of it.
 */
export function useHistorySuggestions(history: string[], value: string) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Hide an entry once it exactly matches what's already typed — showing
  // "the same thing you just typed" as a suggestion is noise, not help —
  // and narrow the list as the visitor types, same as datalist would have.
  const trimmed = value.trim().toLowerCase();
  const matches = history.filter((item) => item.toLowerCase() !== trimmed && (!trimmed || item.toLowerCase().includes(trimmed)));

  return { containerRef, isOpen, setIsOpen, matches };
}

export function HistorySuggestionsList({ items, onSelect }: { items: string[]; onSelect: (value: string) => void }) {
  if (items.length === 0) return null;
  return (
    <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded-card border border-border bg-surface py-1 shadow-elevated">
      {items.map((item) => (
        <li key={item}>
          <button
            type="button"
            // Fires before the input's blur, keeping focus (and the
            // caret) in the input rather than yanking it away — the same
            // "feels like a real combobox, not a page navigation" detail
            // native <select>/<datalist> popups get for free.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSelect(item)}
            className="block w-full truncate px-3 py-2 text-left text-sm text-secondary hover:bg-surface-subtle hover:text-primary"
          >
            {item}
          </button>
        </li>
      ))}
    </ul>
  );
}
