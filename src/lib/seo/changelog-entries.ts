export interface ChangelogEntry {
  date: string;
  title: string;
  description: string;
  highlights: string[];
}

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    date: "2026-09-04",
    title: "Saved searches",
    description:
      "Save a query over a profile's followers or following list, and see matching new or removed accounts between the two most recent snapshots.",
    highlights: [
      "New \"Save search\" button on the Followers and Following pages.",
      "A Saved searches section on the /tracking dashboard.",
      "Built on the follower comparison reconstruction — same coverage rule applies.",
    ],
  },
  {
    date: "2026-09-04",
    title: "Follower comparison",
    description:
      "Pick any two snapshots of a profile and see who was gained or lost between them, computed on demand from the membership history.",
    highlights: [
      "\"Compare snapshots\" on the profile header now opens a real page.",
      "Works for any pair of snapshots, not only the most recent two.",
      "Withheld below 99.5% coverage on either side.",
    ],
  },
  {
    date: "2026-09-04",
    title: "Production hardening",
    description:
      "Error boundaries, baseline security headers, a database-aware health check, and best-effort in-process rate limiting on write routes.",
    highlights: [
      "Segment-level and root-level error boundaries.",
      "/api/health verifies real database connectivity, not just configuration.",
      "Snapshot capture, export, and track routes rate-limited per client IP.",
    ],
  },
  {
    date: "2026-09-04",
    title: "Tracking dashboard",
    description:
      "Track any profile from its page and it appears on /tracking with its follower delta since the previous snapshot.",
    highlights: [
      "Anonymous browser identity via a first-party cookie (no accounts).",
      "One click to track, one click to untrack.",
    ],
  },
  {
    date: "2026-09-04",
    title: "Automatic diff engine",
    description:
      "Capturing a new snapshot now writes the added/removed followers and changed profile fields relative to the previous snapshot into change_events, gated by a 99.5% coverage threshold on both sides.",
    highlights: [
      "Changes tab on the profile lists every recorded change with the account behind it.",
      "Below the coverage threshold, the diff is withheld rather than fabricated.",
    ],
  },
  {
    date: "2026-09-04",
    title: "Snapshot engine",
    description:
      "Capture a snapshot of a profile from its History tab. The snapshot records counts, coverage, and up to 500 followers plus 500 following identities.",
    highlights: [
      "Snapshots write real rows to profiles, social_users, memberships, and profile_snapshots.",
      "Coverage bounds are recorded per snapshot and displayed honestly.",
    ],
  },
  {
    date: "2026-09-04",
    title: "Real Apify provider",
    description:
      "An opt-in Apify provider fetches real Instagram data, with a fallback chain across follower-scraper actors when one fails.",
    highlights: [
      "The mock provider stays the default so nothing costs money unintentionally.",
      "Enable with SOCIAL_PROVIDER=apify and APIFY_API_TOKEN.",
    ],
  },
  {
    date: "2026-09-04",
    title: "Postgres schema",
    description:
      "Drizzle ORM schema and initial migration matching spec §31 — profiles, social users, memberships, media items, snapshots, and change events.",
    highlights: [
      "Neon HTTP driver, right shape for serverless deployment.",
      "Schema only in this entry — later entries wire it up.",
    ],
  },
  {
    date: "2026-09-04",
    title: "Frontend scaffold and design system",
    description:
      "Homepage, profile page, followers/following browsing, tools index, legal pages, and the design tokens the rest of the product is built on.",
    highlights: [
      "Coverage badges live on the profile and followers headers from day one.",
      "Mock provider serves the UI so the app is navigable end to end.",
    ],
  },
];
