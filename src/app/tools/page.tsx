import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Tools",
  description: "SocialTrace public profile tools.",
};

const TOOLS = [
  { title: "Story viewer", description: "View publicly available story media." },
  { title: "Profile viewer", description: "Explore a public profile's available data." },
  { title: "Profile analyzer", description: "Summaries derived from observed public data." },
  { title: "Follower checker", description: "Search an indexed follower dataset." },
  { title: "Following checker", description: "Search an indexed following dataset." },
  { title: "Follower compare", description: "Compare follower snapshots over time." },
  { title: "Following compare", description: "Compare following snapshots over time." },
  { title: "Growth tracker", description: "Track follower growth across snapshots." },
  { title: "Username history", description: "See recorded username changes." },
  { title: "Bio history", description: "See recorded bio changes." },
  { title: "Engagement calculator", description: "Estimate engagement from observed metrics." },
  { title: "Influencer analyzer", description: "Analyze public creator accounts." },
  { title: "Competitor analyzer", description: "Compare public brand accounts." },
];

export default function ToolsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold text-primary">Tools</h1>
      <p className="mt-2 max-w-2xl text-secondary">
        Individual tool pages are being built out. Profile, posts, reels, followers and following
        exploration are already available from any profile page.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => (
          <Card key={tool.title}>
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <CardTitle>{tool.title}</CardTitle>
              <Badge variant="neutral">Coming soon</Badge>
            </CardHeader>
            <CardContent className="text-sm text-secondary">{tool.description}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
