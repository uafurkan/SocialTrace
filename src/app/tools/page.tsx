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

interface Tool {
  title: string;
  description: string;
  href?: string;
}

interface ToolGroup {
  heading: string;
  tools: Tool[];
}

const TOOL_GROUPS: ToolGroup[] = [
  {
    heading: "Viewers",
    tools: [
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
      {
        title: "Story viewer",
        description: "View a public profile's currently active stories anonymously — no account, no login.",
        href: "/tools/instagram-story-viewer",
      },
    ],
  },
  {
    heading: "History & tracking",
    tools: [
      {
        title: "Follower history",
        description: "Track a profile's follower count over captured snapshots.",
        href: "/tools/instagram-follower-history",
      },
      {
        title: "Growth tracker",
        description: "One dashboard, per-profile deltas since the last snapshot.",
        href: "/tools/instagram-growth-tracker",
      },
      {
        title: "Bio history",
        description: "See recorded bio changes for a profile.",
        href: "/tools/instagram-bio-history",
      },
      {
        title: "Username history",
        description: "See recorded username changes for a profile.",
        href: "/tools/instagram-username-history",
      },
    ],
  },
  {
    heading: "Checkers & comparisons",
    tools: [
      {
        title: "Follower checker",
        description: "Search an indexed follower dataset.",
        href: "/tools/instagram-follower-checker",
      },
      {
        title: "Following checker",
        description: "Search an indexed following dataset.",
        href: "/tools/instagram-following-checker",
      },
      {
        title: "Follower compare",
        description: "Compare any two snapshots and see who joined or left.",
        href: "/tools/instagram-follower-compare",
      },
      {
        title: "Competitor analyzer",
        description: "Compare public brand accounts.",
        href: "/tools/instagram-competitor-analyzer",
      },
    ],
  },
  {
    heading: "Calculators & generators",
    tools: [
      {
        title: "Engagement calculator",
        description: "Engagement rate from a profile's most recent public posts.",
        href: "/tools/instagram-engagement-calculator",
      },
      {
        title: "Username availability checker",
        description: "Check a handle across Instagram, TikTok, Facebook, and YouTube at once.",
        href: "/tools/username-availability-checker",
      },
      {
        title: "Hashtag generator",
        description: "Get hashtag suggestions for a caption or topic.",
        href: "/tools/hashtag-generator",
      },
    ],
  },
  {
    heading: "Downloads",
    tools: [
      {
        title: "Video downloader",
        description: "Download a public TikTok, Instagram, or Facebook video, with a visible source link.",
        href: "/tools/video-downloader",
      },
    ],
  },
  {
    heading: "Coming soon",
    tools: [
      { title: "Profile analyzer", description: "Summaries derived from observed public data." },
      { title: "Following compare", description: "Compare following snapshots over time." },
    ],
  },
];

function ToolCard({ tool }: { tool: Tool }) {
  const card = (
    <Card className={tool.href ? "h-full transition hover:border-primary/40" : "h-full"}>
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
  return tool.href ? <Link href={tool.href}>{card}</Link> : card;
}

export default function ToolsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold text-primary">Tools</h1>
      <p className="mt-2 max-w-2xl text-secondary">
        Public profile exploration, snapshot history, and comparisons — search a profile from the
        homepage to reach every current tool. Tools below are organized by category; each landing
        page explains that tool in more depth.
      </p>

      <div className="mt-8 space-y-10">
        {TOOL_GROUPS.map((group) => (
          <section key={group.heading}>
            <h2 className="text-xl font-semibold text-primary">{group.heading}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.tools.map((tool) => (
                <ToolCard key={tool.title} tool={tool} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Below the full tool list — never between cards or above them. */}
      <AdSlot placementId={102} className="mt-12" />
    </div>
  );
}
