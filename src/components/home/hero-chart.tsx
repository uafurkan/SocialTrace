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
const areaPath = `${linePath} L200,72 L0,72 Z`;

const LINE_DURATION = 1.3;
const maxX = points[points.length - 1][0];

export function HeroChart() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="rounded-panel border border-border bg-surface p-6 shadow-elevated">
      <motion.p
        className="text-xs font-medium uppercase tracking-wide text-muted"
        initial={prefersReducedMotion ? false : { opacity: 0, y: -4 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        Follower history
      </motion.p>
      <svg viewBox="0 0 200 72" className="mt-4 h-32 w-full overflow-visible" role="img" aria-label="Illustrative follower growth chart">
        <defs>
          <linearGradient id="hero-chart-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path
          d={areaPath}
          fill="url(#hero-chart-fade)"
          stroke="none"
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1 }}
          transition={{ duration: 0.6, delay: LINE_DURATION * 0.5 }}
        />
        <motion.path
          d={linePath}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={prefersReducedMotion ? false : { pathLength: 0 }}
          animate={prefersReducedMotion ? undefined : { pathLength: 1 }}
          transition={{ duration: LINE_DURATION, ease: [0.65, 0, 0.35, 1] }}
        />
        {points.map(([x, y], index) => (
          <motion.circle
            key={x}
            cx={x}
            cy={y}
            r={2.5}
            fill="var(--brand)"
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, scale: 1 }}
            style={{ transformOrigin: `${x}px ${y}px` }}
            transition={{
              delay: (x / maxX) * LINE_DURATION,
              type: "spring",
              stiffness: 420,
              damping: 16,
            }}
          />
        ))}
        {!prefersReducedMotion ? (
          <motion.circle
            cx={points[points.length - 1][0]}
            cy={points[points.length - 1][1]}
            r={2.5}
            fill="var(--brand)"
            style={{ transformOrigin: `${points[points.length - 1][0]}px ${points[points.length - 1][1]}px` }}
            initial={{ opacity: 0, scale: 1 }}
            animate={{ opacity: [0, 0.5, 0], scale: [1, 2.8, 2.8] }}
            transition={{
              delay: LINE_DURATION + 0.1,
              duration: 1.6,
              repeat: Infinity,
              repeatDelay: 1.4,
              ease: "easeOut",
            }}
          />
        ) : null}
      </svg>
      <motion.div
        className="mt-2 flex justify-between text-xs text-muted"
        initial={prefersReducedMotion ? false : { opacity: 0 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1 }}
        transition={{ duration: 0.4, delay: LINE_DURATION * 0.6 }}
      >
        <span>Aug</span>
        <span>Sep</span>
        <span>Oct</span>
        <span>Nov</span>
      </motion.div>
    </div>
  );
}
