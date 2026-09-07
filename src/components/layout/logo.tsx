/**
 * SocialTrace icon mark (spec §9.3): a rounded lens containing a path
 * through two nodes — "lens = observe, path = trace, nodes = change over
 * time". Placeholder mark for this scaffold; a full asset set (§9.4)
 * belongs in a dedicated design pass.
 *
 * `pathLength={1}` normalizes each stroke's length to 1 so the draw-on
 * animation in globals.css can dash them without hardcoded geometry.
 *
 * The lens ring is deliberately drawn once, outside either glyph: the two
 * product identities (analytics "Trace" and transcriber "Scribe") share
 * one container and only swap what's inside it, so the morph on the home
 * page reads as the same brand looking at a different thing rather than
 * two logos flickering.
 *
 * `morph` false (the default) puts only the glyph named by `variant` in
 * the DOM — that's every page that belongs to one product or the other.
 * Only the home page, which belongs to both, pays for two glyphs and the
 * cross-fade between them. See brand-mark.tsx.
 */
export function Logo({
  className,
  variant = "trace",
  morph = false,
}: {
  className?: string;
  variant?: "trace" | "scribe";
  morph?: boolean;
}) {
  const showTrace = morph || variant === "trace";
  const showScribe = morph || variant === "scribe";

  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="9"
        pathLength={1}
        stroke="var(--brand)"
        strokeWidth="2"
        className="logo-lens"
      />

      {showTrace ? (
        <g className="logo-glyph" data-active={variant === "trace"}>
          <path
            d="M8 20L13.5 13L19 17L24 10"
            pathLength={1}
            stroke="var(--brand)"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="logo-trace"
          />
          <circle
            cx="13.5"
            cy="13"
            r="2"
            fill="var(--brand)"
            className="logo-node logo-node-first"
          />
          <circle
            cx="19"
            cy="17"
            r="2"
            fill="var(--brand)"
            className="logo-node logo-node-second"
          />
        </g>
      ) : null}

      {showScribe ? (
        <g className="logo-glyph" data-active={variant === "scribe"}>
          {/* Voice: four bars of a waveform, all centred on y=12 so the
           * silhouette reads as sound rather than a bar chart. */}
          <g stroke="var(--brand)" strokeWidth="2.25" strokeLinecap="round">
            <line
              x1="10"
              y1="9.5"
              x2="10"
              y2="14.5"
              className="logo-wave logo-wave-1"
            />
            <line
              x1="14"
              y1="6"
              x2="14"
              y2="18"
              className="logo-wave logo-wave-2"
            />
            <line
              x1="18"
              y1="8"
              x2="18"
              y2="16"
              className="logo-wave logo-wave-3"
            />
            <line
              x1="22"
              y1="10"
              x2="22"
              y2="14"
              className="logo-wave logo-wave-4"
            />
          </g>
          {/* Transcript: the sound resolved into two lines of text, the
           * second short the way a paragraph's last line always is. */}
          <path
            d="M10 22H22"
            pathLength={1}
            stroke="var(--brand)"
            strokeWidth="1.9"
            strokeLinecap="round"
            className="logo-script logo-script-first"
          />
          <path
            d="M10 25.5H17"
            pathLength={1}
            stroke="var(--brand)"
            strokeWidth="1.9"
            strokeLinecap="round"
            className="logo-script logo-script-second"
          />
        </g>
      ) : null}
    </svg>
  );
}
