import { isPathEnabled } from "@/lib/features";

export interface HelpArticle {
  slug: string;
  section: string;
  title: string;
  description: string;
  datePublished: string;
  body: string;
}

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: "getting-started",
    section: "Getting Started",
    title: "Getting started with SocialTrace",
    description:
      "Search a public Instagram profile, read the coverage badge honestly, and understand what this build does and does not do.",
    datePublished: "2026-09-04",
    body: `SocialTrace is a public profile explorer. Type a username on the homepage, or open \`/profile/<username>\` directly, and the profile page loads the same data the account exposes publicly on Instagram — display name, bio, verified state, follower/following counts, posts, and reels.

Every dataset that can be partial (followers, following) shows a coverage badge. If it reads "Coverage: 92%", the number below it is that fraction of the real dataset — not the total. This is the honesty rule the whole product is built on: no dataset is displayed as if it were complete unless it actually is.

Search a public @username on the homepage, open its profile, and browse its tabs. Exports and the transcriber work without an account.

Accounts, billing, tracking and saved searches are not available in this version.`,
  },
  {
    slug: "snapshots",
    section: "Snapshots",
    title: "How snapshots work",
    description:
      "A snapshot is one recorded pass of a profile's public counts and profile fields at a moment in time. Snapshots do not record follower or following lists.",
    datePublished: "2026-09-04",
    body: `A snapshot records the profile's public counts and profile fields at the moment it runs. Each capture updates the stored profile row, writes one snapshot row, and records a change event for every profile field that differs from the stored row.

Snapshots do not record follower or following lists. Each one stores its indexed member counts and member coverage as 0, so no member list is claimed as captured. Comparisons that depend on member lists therefore report unavailable.

Capture one from the History tab of any profile.

There is no scheduler in this build. A profile you're tracking only gets a new snapshot when someone opens its History tab and captures one manually.`,
  },
  {
    slug: "coverage",
    section: "Methodology",
    title: "What coverage means",
    description:
      "Coverage is the fraction of a profile's real follower or following list that SocialTrace actually captured. Follower and following lists are requested up to 200 accounts each, so larger lists show partial coverage.",
    datePublished: "2026-09-04",
    body: `Coverage is not a quality score — it's a measurement. If a profile reports 12,400 followers and SocialTrace captured 200 of them, the coverage badge reads 1.6% and shows both numbers: "Indexed 200 of 12,400 — Coverage 1.6%". Never 12,400 as if 200 were the whole set.

Searching a list or exporting it only covers the part that was captured. A name that isn't in the captured part may simply be outside it, so check the coverage figure on the list before treating a missing name as a real absence.`,
  },
  {
    slug: "tracking",
    section: "Tracking",
    title: "Tracking profiles",
    description:
      "Tracking adds a profile to your visitor dashboard. This build identifies you by an anonymous browser cookie, not an account.",
    datePublished: "2026-09-04",
    body: `Click Track on any profile page and the profile joins the \`/tracking\` dashboard for this browser. There is no sign-in — a first-party \`st_visitor\` cookie is issued the first time you track something and identifies you thereafter. Clear cookies or switch browsers and the list is gone; there is no cross-device sync and no recovery.

The tracking dashboard shows, per profile, the follower delta since its previous snapshot. It does not run captures for you: those are still manual, from the History tab. When a scheduler eventually exists, tracked profiles are what it will run against.`,
  },
  {
    slug: "compare",
    section: "Comparisons",
    title: "Comparing two snapshots",
    description:
      "Comparing two snapshots is currently limited. Member comparisons report unavailable, because snapshots no longer record follower or following lists.",
    datePublished: "2026-09-04",
    body: `Open a profile's Compare snapshots view. It lists every snapshot the profile has and lets you pick two. The view is currently limited. The snapshots feature is switched off in this build, and snapshots no longer record follower or following lists: each new snapshot records member coverage as 0, so a comparison of two of them is withheld and reports unavailable rather than listing accounts that were gained or lost.

This article does not promise a list of gained or lost members. Where a comparison is available, the coverage rule still applies: below 99.5% coverage on either side, the comparison is withheld and the page says so, for the same reason described in "What coverage means".`,
  },
  {
    slug: "saved-searches",
    section: "Comparisons",
    title: "Saved searches",
    description:
      "Save a query over a profile's followers or following. While snapshots record no member lists, the dashboard reports the comparison as unavailable instead of showing gained or lost matches.",
    datePublished: "2026-09-04",
    body: `On the Followers or Following page, type a search and click Save search. The query is stored against the current browser (same anonymous cookie as tracking) and appears on the \`/tracking\` dashboard under Saved searches.

The dashboard runs the comparison described in "Comparing two snapshots" between the profile's two most recent snapshots, and filters it by your query. Because snapshots currently record no member lists, that comparison is unavailable, and the dashboard shows the reason instead of which matching accounts joined or left. The coverage rule is unchanged: below 99.5% coverage on either side, the comparison is withheld rather than shown as a number.`,
  },
  {
    slug: "exports",
    section: "Exports",
    title: "Exporting profile data",
    description:
      "The Export dropdown returns a JSON, XML, or CSV file of the currently visible dataset, generated inside the request and capped at 500 items per list.",
    datePublished: "2026-09-04",
    body: `The Export button on a profile page opens a dropdown with the currently available formats: JSON or XML for the full profile bundle, CSV for one resource at a time (followers, following, posts, reels). The file is generated synchronously inside the request and streamed back — there is no background job, no signed URL, and no email delivery.

Each list is capped at 500 items per format. The profile page shows the coverage figure for each list, so you can see what fraction of the real list an export represents.`,
  },
];

export function getHelpArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((article) => article.slug === slug);
}

export function helpArticlesBySection(): Array<{ section: string; articles: HelpArticle[] }> {
  const map = new Map<string, HelpArticle[]>();
  for (const article of HELP_ARTICLES) {
    // Articles about switched-off features (src/lib/features.ts) are not listed.
    if (!isPathEnabled(`/help/${article.slug}`)) continue;
    const existing = map.get(article.section) ?? [];
    existing.push(article);
    map.set(article.section, existing);
  }
  return Array.from(map.entries()).map(([section, articles]) => ({ section, articles }));
}
