"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Lightweight data visualization for the hero (spec §6.2) instead of stock
 * imagery. Purely illustrative sample points — not a real profile.
 */
const points = [
  [0, 62],
  [40, 54],
  [80, 46],
  [120, 40],
  [160, 24],
  [200, 10],
];

const linePath = `M${points.map(([x, y]) => `${x},${y}`).join(" L")}`;

export function HeroChart() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="rounded-panel border border-border bg-surface p-6 shadow-elevated">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Follower history</p>
      <svg viewBox="0 0 200 72" className="mt-4 h-32 w-full" role="img" aria-label="Illustrative follower growth chart">
        <motion.path
          d={linePath}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={prefersReducedMotion ? false : { pathLength: 0 }}
          animate={prefersReducedMotion ? undefined : { pathLength: 1 }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
        {points.map(([x, y]) => (
          <circle key={x} cx={x} cy={y} r={2.5} fill="var(--brand)" />
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-xs text-muted">
        <span>Aug</span>
        <span>Sep</span>
        <span>Oct</span>
        <span>Nov</span>
      </div>
    </div>
  );
}
