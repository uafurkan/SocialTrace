"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

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
 * `useHistorySuggestions` owns the open/close state, the click-outside
 * listener and Escape (same pattern the old `ExportMenu` used) so every call
 * site shares identical behavior instead of five hand-rolled copies of it.
 * `HistorySuggestionsList` handles ArrowUp/ArrowDown and Enter, because the
 * input's keydown events bubble to the container both are attached to, so
 * the call sites need no keyboard wiring.
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

  // Escape closes an open list. The listener is only attached while the list
  // is open, so Escape keeps its normal meaning everywhere else.
  useEffect(() => {
    if (!isOpen) return;
    const container = containerRef.current;
    if (!container) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setIsOpen(false);
    }
    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Hide an entry once it exactly matches what's already typed — showing
  // "the same thing you just typed" as a suggestion is noise, not help —
  // and narrow the list as the visitor types, same as datalist would have.
  const trimmed = value.trim().toLowerCase();
  const matches = history.filter((item) => item.toLowerCase() !== trimmed && (!trimmed || item.toLowerCase().includes(trimmed)));

  return { containerRef, isOpen, setIsOpen, matches };
}

interface HistorySuggestionsListProps {
  items: string[];
  onSelect: (value: string) => void;
  /**
   * Optional. When given, a "clear" row is shown under the items. Call sites
   * that want it pass `clearHistory` from `useInputHistory`.
   */
  onClear?: () => void;
}

export function HistorySuggestionsList({ items, onSelect, onClear }: HistorySuggestionsListProps) {
  const listRef = useRef<HTMLUListElement>(null);

  // The highlight belongs to one set of items. Typing narrows the list, so a
  // new set starts with nothing highlighted. Storing the key with the index
  // avoids resetting state in an effect.
  const itemsKey = JSON.stringify(items);
  const [highlight, setHighlight] = useState({ itemsKey, index: -1 });
  const activeIndex = highlight.itemsKey === itemsKey ? highlight.index : -1;

  // Keys typed in the input bubble to the container that holds both the
  // input and this list (true at every call site), so listen there. Only the
  // input's keys count: Enter on the paste button or the clear row must keep
  // its own meaning.
  useEffect(() => {
    const container = listRef.current?.parentElement;
    if (!container || items.length === 0) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.isComposing || !(event.target instanceof HTMLInputElement)) return;

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const count = items.length;
        const next =
          event.key === "ArrowDown" ? (activeIndex + 1) % count : activeIndex <= 0 ? count - 1 : activeIndex - 1;
        setHighlight({ itemsKey, index: next });
        return;
      }

      if (event.key === "Enter") {
        const item = items[activeIndex];
        if (item === undefined) return;
        // Enter picks the highlighted entry instead of submitting the form.
        event.preventDefault();
        onSelect(item);
      }
    }

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [items, itemsKey, activeIndex, onSelect]);

  // Keep the highlighted entry visible inside the scrolling list.
  useEffect(() => {
    if (activeIndex >= 0) listRef.current?.children[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (items.length === 0) return null;
  return (
    <ul
      ref={listRef}
      className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded-card border border-border bg-surface py-1 shadow-elevated"
    >
      {items.map((item, index) => (
        <li key={item}>
          <button
            type="button"
            // Fires before the input's blur, keeping focus (and the
            // caret) in the input rather than yanking it away — the same
            // "feels like a real combobox, not a page navigation" detail
            // native <select>/<datalist> popups get for free.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSelect(item)}
            data-active={index === activeIndex ? "true" : undefined}
            className={cn(
              "block w-full truncate px-3 py-2 text-left text-sm hover:bg-surface-subtle hover:text-primary",
              index === activeIndex ? "bg-surface-subtle text-primary" : "text-secondary",
            )}
          >
            {item}
          </button>
        </li>
      ))}
      {onClear ? (
        <li className="mt-1 border-t border-border">
          <button
            type="button"
            aria-label="Clear input history"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClear}
            className="block w-full px-3 py-2 text-left text-xs text-muted hover:bg-surface-subtle hover:text-primary"
          >
            Clear input history
          </button>
        </li>
      ) : null}
    </ul>
  );
}
