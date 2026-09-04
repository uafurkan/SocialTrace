export interface FaqEntry {
  question: string;
  answer: string;
}

export const FAQ_ENTRIES: FaqEntry[] = [
  {
    question: "Can I search a public Instagram follower list?",
    answer:
      "Yes, on a profile's Followers page — but only over the subset the snapshot actually captured. Each snapshot is bounded at 500 followers per list, so larger accounts show a coverage badge below 100% and the search only returns matches inside that indexed subset. Below 99.5% coverage, comparisons (new/removed) are withheld rather than guessed.",
  },
  {
    question: "How does SocialTrace collect public profile data?",
    answer:
      "The default build uses a mock provider so nothing costs money out of the box. With SOCIAL_PROVIDER=apify and an Apify API token, an opt-in provider fetches real Instagram public data via Apify actors, with a fallback chain across five follower-scraper actors so one failing does not break capture. No private data, no login-required content, no story or highlight access.",
  },
  {
    question: "Can I export the available dataset?",
    answer:
      "Yes — the Export button on a profile page returns JSON or XML for the full bundle, or CSV for one resource (followers, following, posts, reels). The file is generated inside the request and streamed back, capped at 500 items per list. There is no background job, no signed URL, and no email delivery.",
  },
  {
    question: "How often are snapshots updated?",
    answer:
      "Only when someone captures one manually from the profile's History tab. There is no scheduler in this build. Tracked profiles show the delta since their previous snapshot, but do not auto-refresh.",
  },
  {
    question: "What does coverage mean?",
    answer:
      "Coverage is the fraction of a profile's real follower or following list that a given snapshot captured. If the profile reports 12,400 followers and the snapshot captured 500, coverage is 4% and both numbers are shown. Coverage below 99.5% blocks diffs (automatic diff engine, follower comparison, and saved searches) because missing accounts cannot be told apart from real unfollows.",
  },
  {
    question: "Why can some profiles have partial data?",
    answer:
      "Each snapshot captures up to 500 followers and 500 following identities — a hard bound to keep captures fast and bounded. Larger public profiles will therefore have partial coverage until the snapshot engine is extended to paginate through the full list.",
  },
  {
    question: "Can I track follower changes?",
    answer:
      "Yes — click Track on a profile and it joins the /tracking dashboard for the current browser (anonymous cookie identity, no sign-in). The dashboard shows the follower delta since the previous snapshot for each tracked profile. Since there is no scheduler, deltas only update when someone captures a new snapshot manually.",
  },
];
