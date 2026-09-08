"use client";

import { ChevronDown, Download } from "lucide-react";

import { copy } from "@/lib/copy";

const OPTIONS = [
  { label: "Full profile — JSON", format: "json" as const },
  { label: "Full profile — XML", format: "xml" as const },
  { label: "Followers — CSV", format: "csv" as const, resource: "followers" },
  { label: "Following — CSV", format: "csv" as const, resource: "following" },
  { label: "Posts — CSV", format: "csv" as const, resource: "posts" },
  { label: "Reels — CSV", format: "csv" as const, resource: "reels" },
];

/**
 * Was a hand-built `<ul>`/`<li>` popup (absolute-positioned div, manual
 * click-outside listener, manual open/close state) styled to *look* like a
 * menu — which meant it always rendered our own CSS box on every platform,
 * never the OS's own picker chrome. A plain `<select>` is the right native
 * element for "pick one of these, then act on it": every browser already
 * ships a correct, OS-idiomatic popup for it for free — macOS/iOS Safari's
 * translucent vibrancy list with a checkmark, Windows' own flat combo
 * list, Android Chrome's Material bottom sheet — with zero platform
 * branching in this file. `appearance-none` plus the overlaid icons below
 * only restyle the *closed* control to match this app's button look; the
 * instant it's opened, rendering is entirely up to the OS, which is
 * exactly the point — there is no cross-platform equivalent to build,
 * because the browser already is one.
 *
 * Repurposed as an action list rather than a persistent value picker: the
 * first, disabled option is the visible "Export" label, picking a real
 * option fires the same navigation the old `<a href>` did (the export
 * route's own Content-Disposition header is what turns that into a
 * download, unchanged), and the control is reset back to the placeholder
 * immediately after — so it always reads "Export" again, ready to be
 * reopened, the same idle appearance the old button had.
 */
export function ExportMenu({ profileId, username }: { profileId: string; username: string }) {
  function hrefFor(option: (typeof OPTIONS)[number]): string {
    const params = new URLSearchParams({ username, format: option.format });
    if ("resource" in option && option.resource) params.set("resource", option.resource);
    return `/api/v1/profiles/${profileId}/export?${params.toString()}`;
  }

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const index = Number(event.target.value);
    event.target.selectedIndex = 0;
    const option = OPTIONS[index];
    if (!option) return;
    window.location.assign(hrefFor(option));
  }

  return (
    <div className="relative w-full">
      <Download className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-primary" aria-hidden="true" />
      <select
        aria-label={copy.profile.exportCta}
        defaultValue=""
        onChange={handleChange}
        // Matches the bordered `secondary` Button variant used by the
        // Track/Compare buttons this sits next to (buttonVariants in
        // components/ui/button.tsx isn't reused directly — a native
        // <select>'s own text layout doesn't take the flex/gap classes
        // that variant assumes for its icon+label children).
        className="h-11 w-full min-w-0 cursor-pointer appearance-none rounded-button border border-border bg-surface py-0 pl-10 pr-9 text-sm font-medium text-primary transition-colors hover:border-border-strong hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
      >
        <option value="" disabled>
          {copy.profile.exportCta}
        </option>
        {OPTIONS.map((option, index) => (
          <option key={option.label} value={index}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-secondary" aria-hidden="true" />
    </div>
  );
}
