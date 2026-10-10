export interface FaqEntry {
  question: string;
  answer: string;
}

export const FAQ_ENTRIES: FaqEntry[] = [
  {
    question: "Can I search a public Instagram follower list?",
    answer:
      "Yes, on a profile's Followers page. The search filters the followers captured when the profile was loaded. Each list holds up to 200 followers, so larger accounts show a coverage badge below 100%, and the search only covers the captured part.",
  },
  {
    question: "How does SocialTrace collect public profile data?",
    answer:
      "SocialTrace reads public profile data through third-party data providers, and it shows how much of each list it captured. It does not access private accounts or content that requires a login.",
  },
  {
    question: "Can I export the available dataset?",
    answer:
      "Yes — the Export button on a profile page returns JSON or XML for the full bundle, or CSV for one resource (followers, following, posts, reels). The file is generated inside the request and streamed back, capped at 500 posts or reels and 200 followers or following accounts. There is no background job, no signed URL, and no email delivery.",
  },
  {
    question: "Do I need an account?",
    answer:
      "No. Profile lookups, exports, the tools and the transcriber work without signing in. Accounts, billing and tracking are not available in this version.",
  },
  {
    question: "What does coverage mean?",
    answer:
      "Coverage is the share of a profile's real follower or following list that SocialTrace captured. If the profile reports 12,400 followers and 200 were captured, coverage is 1.6%, and both numbers are shown.",
  },
  {
    question: "Why can some profiles have partial data?",
    answer:
      "Each list holds up to 200 followers and 200 following. Larger public profiles therefore show partial coverage, and the page says so.",
  },
  {
    question: "Can I see who liked an Instagram post?",
    answer:
      "Yes, for public Instagram posts. Open the post from the profile's Posts tab and choose Likers. Comments are shown too, and TikTok and Facebook posts show comments.",
  },
];
