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
