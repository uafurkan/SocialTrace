"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { AdSlot } from "./ad-slot";

const GATE_ENABLED =
  process.env.NEXT_PUBLIC_EZOIC_ENABLED === "true" && process.env.NEXT_PUBLIC_AD_GATE_ENABLED === "true";
const GATE_COOLDOWN_MS = 30 * 60 * 1000;
const MIN_VIEW_SECONDS = 5;
const GATE_PLACEMENT_ID = 104;

function storageKey(key: string) {
  return `ad-gate:${key}`;
}

function recentlyShown(key: string): boolean {
  try {
    const raw = sessionStorage.getItem(storageKey(key));
    return raw !== null && Date.now() - Number(raw) < GATE_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function markShown(key: string) {
  try {
    sessionStorage.setItem(storageKey(key), String(Date.now()));
  } catch {
    // sessionStorage unavailable (private browsing, etc.) — the gate just
    // shows again next time rather than failing the navigation.
  }
}

/**
 * Gates a client-side navigation behind a real, viewable ad — a
 * click-triggered "view ad, then continue" step, never an auto-redirect
 * and never overlapping the ad itself with our own "Continue" button (that
 * would risk accidental/invalid ad clicks, which every ad network's terms
 * prohibit). Shown at most once per `key` (e.g. per profile username)
 * within the cooldown window, so re-opening or switching tabs on a
 * profile already unlocked this session never re-triggers it.
 */
export function useAdGate() {
  const router = useRouter();
  const [pending, setPending] = useState<{ href: string; key: string } | null>(null);

  const navigate = useCallback(
    (href: string, key: string) => {
      if (!GATE_ENABLED || recentlyShown(key)) {
        router.push(href);
        return;
      }
      setPending({ href, key });
    },
    [router],
  );

  const continueNavigation = useCallback(() => {
    if (!pending) return;
    markShown(pending.key);
    router.push(pending.href);
    setPending(null);
  }, [pending, router]);

  return { pending, navigate, continueNavigation };
}

export function AdGateOverlay({ onContinue }: { onContinue: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(MIN_VIEW_SECONDS);

  useEffect(() => {
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Advertisement before continuing"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div className="w-full max-w-md rounded-card border border-border bg-surface p-5 shadow-lg">
        <p className="text-sm font-medium text-secondary">One quick ad, then your result loads.</p>
        <div className="mt-4">
          <AdSlot placementId={GATE_PLACEMENT_ID} />
        </div>
        <Button
          type="button"
          onClick={onContinue}
          disabled={secondsLeft > 0}
          className="mt-5 w-full"
        >
          {secondsLeft > 0 ? `Continue in ${secondsLeft}s` : "Continue"}
        </Button>
      </div>
    </div>
  );
}
