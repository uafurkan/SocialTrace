import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdSlot } from "@/components/ads/ad-slot";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Tools",
  description: "Free Instagram tools: anonymous viewer, story viewer, follower history, follower compare, and growth tracker — no account required.",
  path: "/tools",
});

const TOOLS: Array<{ title: string; description: string; href?: string }> = [
  {
    title: "Follower history",
    description: "Track a profile's follower count over captured snapshots.",
    href: "/tools/instagram-follower-history",
  },
  {
    title: "Follower compare",
    description: "Compare any two snapshots and see who joined or left.",
    href: "/tools/instagram-follower-compare",
  },
  {
    title: "Growth tracker",
    description: "One dashboard, per-profile deltas since the last snapshot.",
    href: "/tools/instagram-growth-tracker",
  },
  {
    title: "Story viewer",
    description: "View a public profile's currently active stories anonymously — no account, no login.",
    href: "/tools/instagram-story-viewer",
  },
  {
    title: "Anonymous viewer",
    description: "Browse a public profile's posts, reels, stories, highlights, and tagged posts anonymously.",
    href: "/tools/anonymous-instagram-viewer",
  },
  {
    title: "Anonymous TikTok viewer",
    description: "Browse a public TikTok profile's videos, comments, and followers anonymously.",
    href: "/tools/anonymous-tiktok-viewer",
  },
  {
    title: "Anonymous Facebook viewer",
    description: "Browse a public Facebook Page's posts and comments anonymously.",
    href: "/tools/anonymous-facebook-viewer",
  },
  { title: "Profile analyzer", description: "Summaries derived from observed public data." },
  { title: "Follower checker", description: "Search an indexed follower dataset." },
  { title: "Following checker", description: "Search an indexed following dataset." },
  { title: "Following compare", description: "Compare following snapshots over time." },
  { title: "Username history", description: "See recorded username changes." },
  { title: "Bio history", description: "See recorded bio changes." },
  { title: "Engagement calculator", description: "Estimate engagement from observed metrics." },
  { title: "Competitor analyzer", description: "Compare public brand accounts." },
];

export default function ToolsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold text-primary">Tools</h1>
      <p className="mt-2 max-w-2xl text-secondary">
        Public profile exploration, snapshot history, and comparisons — search a profile from the
        homepage to reach every current tool. Landing pages below explain each in more depth.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => {
          const card = (
            <Card key={tool.title} className={tool.href ? "h-full transition hover:border-primary/40" : "h-full"}>
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <CardTitle>{tool.title}</CardTitle>
                {tool.href ? (
                  <Badge variant="brand">Available</Badge>
                ) : (
                  <Badge variant="neutral">Coming soon</Badge>
                )}
              </CardHeader>
              <CardContent className="text-sm text-secondary">{tool.description}</CardContent>
            </Card>
          );
          return tool.href ? (
            <Link key={tool.title} href={tool.href}>
              {card}
            </Link>
          ) : (
            card
          );
        })}
      </div>

      {/* Below the full tool grid — never between cards or above them. */}
      <AdSlot placementId={102} className="mt-12" />
    </div>
  );
}
