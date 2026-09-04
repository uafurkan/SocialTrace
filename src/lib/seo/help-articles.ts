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

If you want to keep tabs on a profile, click Track. If you want to see how something changed between two moments in time, capture a snapshot from the History tab and then compare from the Changes tab or the Compare snapshots view.

What this build does not do: sign-in, billing, notifications, or scheduled captures. Snapshots only update when you (or someone else) manually capture one.`,
  },
  {
    slug: "snapshots",
    section: "Snapshots",
    title: "How snapshots work",
    description:
      "A snapshot is one indexed pass of a profile at a moment in time — its counts, its follower/following lists, and how completely those lists were captured.",
    datePublished: "2026-09-04",
    body: `A snapshot records the profile's counts and up to 500 follower and 500 following identities at the moment it runs. The 500-per-list cap is a real bound: for larger accounts the snapshot's follower list is genuinely partial, and the coverage badge shows exactly what fraction it captured.

Capture one from the History tab of any profile. Each snapshot writes its own row, plus membership rows for every identity it saw. Two consecutive snapshots' membership rows are what the diff engine reads.

There is no scheduler in this build. A profile you're tracking only gets a new snapshot when someone opens its History tab and captures one manually.`,
  },
  {
    slug: "coverage",
    section: "Methodology",
    title: "What coverage means",
    description:
      "Coverage is the fraction of a profile's real follower or following list that a snapshot actually captured. Below 99.5%, diffs are withheld.",
    datePublished: "2026-09-04",
    body: `Coverage is not a quality score — it's a measurement. If a profile reports 12,400 followers and a snapshot captured 500 of them, the coverage badge reads 4% and shows both numbers: "Indexed 500 of 12,400 — Coverage 4%". Never 12,400 as if 500 were the whole set.

The diff engine — the thing that decides "these accounts followed" and "these accounts unfollowed" between two snapshots — refuses to run when either snapshot is below 99.5% coverage. Below that threshold the missing accounts could easily be members the crawl just didn't reach, not real unfollows, so the honest answer is "comparison unavailable", not a fabricated list. The same rule applies to Follower Compare and to Saved Searches.`,
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
      "Pick any two snapshots and see who was gained or lost between them. Same coverage rule as the automatic diff.",
    datePublished: "2026-09-04",
    body: `Open a profile's Compare snapshots view. It lists every snapshot the profile has, and lets you pick two — not just the most recent two. New members are accounts present in the newer snapshot but not the older one; removed members are the reverse.

The comparison is reconstructed from the membership table's own \`first_seen_at\` / \`removed_at\` columns, not from a per-snapshot log. That's why arbitrary snapshot pairs work, not only adjacent ones.

Below 99.5% coverage on either side, the comparison is withheld and the page says so — for the same reason described in "What coverage means".`,
  },
  {
    slug: "saved-searches",
    section: "Comparisons",
    title: "Saved searches",
    description:
      "Save a query over a profile's followers or following, and on future snapshots see how many matching accounts were gained or lost.",
    datePublished: "2026-09-04",
    body: `On the Followers or Following page, type a search and click Save search. The query is stored against the current browser (same anonymous cookie as tracking) and appears on the \`/tracking\` dashboard under Saved searches.

Between the profile's two most recent snapshots, the dashboard shows which matching accounts joined the list and which left. This is a filtered view of the same comparison reconstruction described above, not a separate mechanism, so the same coverage rule applies: below 99.5% coverage on either side, the dashboard says the comparison is unavailable rather than showing a number.`,
  },
  {
    slug: "exports",
    section: "Exports",
    title: "Exporting profile data",
    description:
      "The Export dropdown returns a JSON, XML, or CSV file of the currently visible dataset, generated inside the request and capped at 500 items per list.",
    datePublished: "2026-09-04",
    body: `The Export button on a profile page opens a dropdown with the currently available formats: JSON or XML for the full profile bundle, CSV for one resource at a time (followers, following, posts, reels). The file is generated synchronously inside the request and streamed back — there is no background job, no signed URL, and no email delivery.

Each list is capped at 500 items per format, matching the snapshot capture bound. Coverage numbers travel with the data so a downstream reader can see what fraction of the real dataset an export represents.`,
  },
];

export function getHelpArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((article) => article.slug === slug);
}

export function helpArticlesBySection(): Array<{ section: string; articles: HelpArticle[] }> {
  const map = new Map<string, HelpArticle[]>();
  for (const article of HELP_ARTICLES) {
    const existing = map.get(article.section) ?? [];
    existing.push(article);
    map.set(article.section, existing);
  }
  return Array.from(map.entries()).map(([section, articles]) => ({ section, articles }));
}
