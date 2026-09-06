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
export function PasteButton({ onPaste, className }: { onPaste: (text: string) => void; className?: string }) {
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
        "absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-full border border-border bg-surface-subtle px-2 py-1 text-xs font-medium text-secondary transition-colors hover:bg-surface hover:text-brand-strong",
        className,
      )}
    >
      <ClipboardPaste className="size-3.5" aria-hidden="true" />
      Paste
    </button>
  );
}
