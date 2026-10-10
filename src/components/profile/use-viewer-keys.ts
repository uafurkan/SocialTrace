"use client";

import { useEffect, useRef } from "react";

interface ViewerKeysOptions {
  /** True while the viewer is on screen. Key listeners are attached only while open. */
  open: boolean;
  onClose: () => void;
  /** ArrowLeft. The caller decides the bounds (stop at the first item). */
  onPrevious: () => void;
  /** ArrowRight. The caller decides the bounds (stop at the last item). */
  onNext: () => void;
}

/**
 * Keyboard controls for a full-screen viewer: Escape closes, ArrowLeft and ArrowRight
 * step between items, and focus returns to the element that had it when the viewer opened.
 * Listeners are removed when the viewer closes and when the component unmounts.
 */
export function useViewerKeys({ open, onClose, onPrevious, onNext }: ViewerKeysOptions): void {
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    openerRef.current = active instanceof HTMLElement ? active : null;
    return () => {
      openerRef.current?.focus();
      openerRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // Leave browser shortcuts such as Alt+ArrowLeft (history back) alone.
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft") onPrevious();
      else if (event.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, onPrevious, onNext]);
}
