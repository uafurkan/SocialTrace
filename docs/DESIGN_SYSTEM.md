# Design System

Spec §7–§10. Tokens live in `src/styles/tokens.css` as CSS custom
properties and are exposed to Tailwind via semantic color/radius/shadow
names in `tailwind.config.ts` — components must reference
`bg-brand`/`text-secondary`/`rounded-card`/etc., never a raw hex value or
pixel radius.

## Color

`--background`, `--surface(-subtle|-elevated)`, `--border(-strong)`,
`--text-primary/secondary/muted/inverse`, `--brand(-strong|-soft)`,
`--success/warning/danger/info(-soft)` — exact values from spec §7.2.
Brand (indigo/violet) is reserved for primary actions (Explore, Track,
Compare, Export, Upgrade) per §7.3; secondary actions stay neutral.

## Typography

Inter via `next/font/google`, exposed as the `font-sans` Tailwind family
with a system-font fallback stack. `font-mono` (`ui-monospace`) is
reserved for technical values — IDs, export filenames — not general UI
text (spec §7.4).

## Spacing / radius / shadow

8pt spacing scale (Tailwind defaults already follow this). Radius:
`rounded-sm` (8px, small controls), `rounded-button` (10px),
`rounded-card` (14px), `rounded-panel` (18px), `rounded-modal` (20px).
Shadows: `shadow-default` (barely-there resting shadow) and
`shadow-elevated` (hero chart, modals) — both intentionally subtle per
spec §7.7.

## Buttons (spec §8)

`src/components/ui/button.tsx` implements `primary` / `secondary` /
`tertiary` / `destructive` variants. All variants: 44px minimum height
(WCAG touch target), visible focus ring (global `:focus-visible` style in
`globals.css`), `disabled` state keeps text legible instead of just fading
to near-invisible, and `loading` renders a spinner inline without changing
the button's box size (no layout shift).

## Components

`src/components/ui/` holds the shadcn-style primitives (button, badge,
input, card, tabs) built directly on Radix + `class-variance-authority` +
`tailwind-merge`, matching the shadcn/ui pattern from spec §247 without
pulling in the CLI scaffolding tool itself.

## Motion

Framer Motion is used in exactly one place — the homepage hero sparkline
(`src/components/home/hero-chart.tsx`) — and reads
`useReducedMotion()` to skip the draw-in animation entirely when the user
has `prefers-reduced-motion` set, per spec §6.2. Reduced-motion is also
enforced globally in `globals.css` as a defense-in-depth media query.

## Logo

`src/components/layout/logo.tsx` is a placeholder mark (lens + path
through two nodes, per spec §9.3's concept) sized for the 24-32px navbar
context. The full asset set from spec §9.4 (favicon variants, OG image,
monochrome version) is not produced in this build.

### Two identities, one lens

The site is two products under one roof — Instagram analytics and the
video transcriber — so the mark says which one you are currently standing
in. `src/components/layout/brand-mark.tsx` picks the identity from the
pathname (the header is the only thing that needs to know, so no route's
layout has to thread a prop down):

| Where | Glyph | Wordmark |
| --- | --- | --- |
| `/transcribe`, `/transcribe/*` | **Scribe** — a voice waveform resolving into two transcript lines | `SOCIAL`**`SCRIBE`** |
| `/` (home) | both, alternating every 5s | alternating |
| everything else | **Trace** — the original lens-and-trend mark | `SOCIAL`**`TRACE`** |

Home alternates because it is the one page that belongs to neither
product. Everywhere else the mark is static: someone reading
`/profile/nike` never has the wordmark change out from under them.

Three things make the alternation read as one brand rather than two logos
flickering, and are worth preserving if this is ever redesigned:

- **The lens ring is shared.** It is drawn once, outside either glyph, and
  never re-animates. What the eye sees is the *contents* of a fixed lens
  changing — not one logo replaced by another.
- **Only the suffix moves.** `SOCIAL` is a static prefix; `TRACE`/`SCRIBE`
  are two stacked faces sized by an invisible copy of the longer word, so
  the swap is pixel-stable (verified: the mobile header's centred mark
  holds the same centre and width in both states).
- **Both faces travel the same direction.** `TRACE` parks above and
  `SCRIBE` below, so each swap rolls the pair up or back down like a
  counter. Give them a shared "inactive" offset instead and they cross
  through each other in opposite directions, which is the janky version.

Both glyphs draw themselves on once and resolve to a static resting state,
and both answer a hover in their own vocabulary (the trace line re-traces;
the waveform "listens" and the transcript lines re-write). Under
`prefers-reduced-motion: reduce` the cycle never starts at all — the home
page just keeps the Trace identity — which is a stronger guarantee than
the global duration-collapsing rule, and the right call for a mark that
would otherwise animate indefinitely.

The glyph cross-fade and the wordmark roll are CSS *transitions*, not
keyframe animations, on purpose: a transition re-runs every time the
property changes, whereas an animation bound to a class only plays on
mount and would need a remount hack to replay.
