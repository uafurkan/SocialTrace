"use client";

import { ClipboardPaste } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Small icon+label button meant to sit absolutely-positioned inside a
 * `relative` input wrapper, flush against the input's right edge — every
 * link/username paste box on the site gets one (user request: a themed
 * paste shortcut instead of relying on manual Ctrl/Cmd+V). Reads from the
 * clipboard directly rather than requiring focus+paste, since that's the
 * entire point of a dedicated button.
 */
export function PasteButton({
  onPaste,
  className,
  compact = false,
}: {
  onPaste: (text: string) => void;
  className?: string;
  /** Icon only, for the narrow mobile header box. The label stays on aria-label. */
  compact?: boolean;
}) {
  async function handleClick() {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) onPaste(text.trim());
    } catch {
      // Clipboard permission denied, insecure context, or unsupported
      // browser — fail silently, manual paste (Ctrl/Cmd+V) still works.
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Paste from clipboard"
      className={cn(
        "absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface-subtle text-xs font-medium text-secondary transition-colors hover:bg-surface hover:text-brand-strong",
        compact ? "size-9" : "h-9 gap-1 px-3 sm:h-auto sm:px-2 sm:py-1",
        className,
      )}
    >
      <ClipboardPaste className="size-3.5" aria-hidden="true" />
      {compact ? null : "Paste"}
    </button>
  );
}
