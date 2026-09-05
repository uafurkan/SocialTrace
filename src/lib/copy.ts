/**
 * Centralized English copy (spec §1.7). Components should read from here
 * rather than embedding literal strings, so a future localization layer
 * only touches this file.
 */
export const copy = {
  brand: {
    name: "SocialTrace",
    tagline: "Trace what changes.",
    descriptor: "Public Social Intelligence",
  },
  nav: {
    explore: "Explore",
    track: "Track",
    compare: "Compare",
    reports: "Reports",
    pricing: "Pricing",
    signIn: "Sign in",
    signUp: "Sign up",
    account: "Account",
    signOut: "Sign out",
  },
  auth: {
    loginTitle: "Sign in",
    loginSubtitle: "Sign in to sync tracked profiles and saved searches across devices.",
    signupTitle: "Create an account",
    signupSubtitle: "An account isn't required to explore or track — it only carries your tracked profiles and saved searches across browsers and devices.",
    emailLabel: "Email",
    passwordLabel: "Password",
    loginCta: "Sign in",
    signupCta: "Create account",
    noAccountPrompt: "Don't have an account?",
    hasAccountPrompt: "Already have an account?",
  },
  home: {
    heroHeadline: "Trace what changes.",
    heroSubhead:
      "Explore public social profiles, search available audience data, compare snapshots, and export structured datasets.",
    searchPlaceholder: "@username or instagram.com/username",
    searchCta: "Explore",
    noAccountNote: "No account required for basic public exploration.",
    valueCards: [
      {
        title: "Explore",
        body: "Public profiles, posts, reels, stories and highlights where available.",
      },
      {
        title: "Search",
        body: "Search eligible follower and following datasets instead of stopping at a tiny recent list.",
      },
      {
        title: "Trace",
        body: "Save snapshots and see meaningful changes over time.",
      },
    ],
    proofStatement:
      "SocialTrace organizes publicly accessible profile data into a searchable, historical workspace.",
  },
  profile: {
    trackCta: "Track profile",
    trackedCta: "Tracking active",
    compareCta: "Compare snapshots",
    exportCta: "Export",
    comingSoon: "Coming soon",
    dataStatusLabel: "Data status",
    lastCheckedLabel: "Last checked",
    coverageLabel: "Coverage",
  },
  followers: {
    title: "Followers",
    followingTitle: "Following",
    searchPlaceholder: "Search followers...",
    searchPlaceholderFollowing: "Search following...",
    indexedLabel: "Indexed",
    coverageLabel: "Coverage",
    filters: { all: "All", verified: "Verified", new: "New", removed: "Removed" },
    filterUnavailableTooltip: "Requires the diff engine (not available in this build).",
  },
  partialData: {
    title: "Partial follower data",
    body: (percent: number) =>
      `SocialTrace currently has ${percent}% coverage for this profile. Results are searchable within the indexed dataset.`,
  },
  emptyStates: {
    notAvailable: "Not available in this build.",
    noResults: "No results match your search.",
  },
  faq: [
    {
      question: "Can SocialTrace show every follower?",
      answer:
        "SocialTrace displays the follower data that its configured data sources can reliably obtain. Some profiles may have complete indexed datasets while others may only have partial coverage.",
    },
    {
      question: "Can I search a follower list?",
      answer:
        "Yes, when a searchable follower dataset is available. Search is performed against the indexed dataset rather than requiring the browser to download the entire list.",
    },
    {
      question: "Can I export follower data?",
      answer:
        "Eligible indexed data can be exported in supported formats such as XML, JSON and CSV. Large exports are prepared as background jobs.",
    },
    {
      question: "Can I track changes?",
      answer:
        "Tracked profiles can be captured as historical snapshots. SocialTrace can compare snapshots to identify supported changes.",
    },
  ],
};
