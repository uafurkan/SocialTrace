"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { copy } from "@/lib/copy";
import { Logo } from "@/components/layout/logo";

/** How long each identity holds before handing over, on the home page. */
const DWELL_MS = 5000;

const LINK_CLASS =
  "brand-mark flex items-center justify-center gap-2 font-semibold text-primary md:justify-start";

/**
 * Which identity a given page wears. The site is two products under one
 * roof, so the mark says which one you're currently standing in:
 *
 *   /transcribe*  -> "scribe": a voice waveform resolving into transcript
 *                    lines, wordmark SOCIAL**SCRIBE**
 *   home ("/")    -> both, alternating every few seconds — it's the one
 *                    page that genuinely belongs to neither product
 *   everything    -> "trace": the original lens-and-trend mark, wordmark
 *   else             SOCIAL**TRACE**
 *
 * Deciding here from the pathname rather than threading a prop down from
 * each page keeps every route's layout untouched; the header is the only
 * thing that needs to know.
 */
function identityFor(pathname: string): "trace" | "scribe" | "both" {
  if (pathname === "/") return "both";
  if (pathname === "/transcribe" || pathname.startsWith("/transcribe/"))
    return "scribe";
  return "trace";
}

export function BrandMark() {
  const identity = identityFor(usePathname());
  const alternates = identity === "both";
  const [scribe, setScribe] = useState(false);

  useEffect(() => {
    if (!alternates) return;
    // An indefinitely self-animating logo is exactly what this media query
    // exists for — reduced-motion visitors keep the static Trace identity.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = setInterval(() => setScribe((previous) => !previous), DWELL_MS);
    return () => clearInterval(id);
  }, [alternates]);

  // Single-identity pages render one glyph and one plain wordmark — no
  // second glyph in the DOM, no stacked text, nothing to hide from screen
  // readers. On /profile/... this is byte-identical to the mark that was
  // there before any of this existed.
  if (!alternates) {
    return (
      <Link href="/" className={LINK_CLASS}>
        <Logo className="h-8 w-8" variant={identity} />
        <span className="tracking-tight">
          {copy.brand.namePrefix.toUpperCase()}
          {(identity === "scribe"
            ? copy.brand.nameSuffixScribe
            : copy.brand.nameSuffixTrace
          ).toUpperCase()}
        </span>
      </Link>
    );
  }

  return (
    <Link href="/" className={LINK_CLASS} aria-label={copy.brand.name}>
      <Logo className="h-8 w-8" morph variant={scribe ? "scribe" : "trace"} />
      {/* aria-hidden because both suffixes are in the DOM at all times
       * (that's what lets them cross-fade) and would otherwise be read as
       * "SOCIALTRACESCRIBE"; the link's aria-label carries the real name. */}
      <span className="tracking-tight" aria-hidden="true">
        {copy.brand.namePrefix.toUpperCase()}
        <span className="brand-word">
          {/* Invisible sizer: reserves the width of the longer suffix so the
           * swap never nudges the nav or the centred mobile header. */}
          <span className="invisible">
            {copy.brand.nameSuffixScribe.toUpperCase()}
          </span>
          <span
            className="brand-word-face"
            data-park="up"
            data-active={!scribe}
          >
            {copy.brand.nameSuffixTrace.toUpperCase()}
          </span>
          <span
            className="brand-word-face"
            data-park="down"
            data-active={scribe}
          >
            {copy.brand.nameSuffixScribe.toUpperCase()}
          </span>
        </span>
      </span>
    </Link>
  );
}
