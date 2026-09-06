import type { Metadata } from "next";
import Link from "next/link";

import { getProfileByUsername, requireProfile } from "@/lib/server/profile";
import { PlatformProfileHeader } from "@/components/profile/platform-profile-header";
import { NotAvailable } from "@/components/profile/not-available";
import { AdSlot } from "@/components/ads/ad-slot";
import { pageMetadata } from "@/lib/seo/metadata";

// Apify actor calls can take well past Vercel's default serverless
// timeout on large accounts — same reasoning as the Instagram profile
// layout (docs/PROVIDER_CONTRACT.md).
export const maxDuration = 60;

interface TikTokProfileLayoutProps {
  children: React.ReactNode;
  params: Promise<{ username: string }>;
}

export async function generateMetadata(props: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const params = await props.params;
  const profile = await getProfileByUsername(params.username, "tiktok");
  if (!profile) return { title: "Profile not found" };
  return pageMetadata({
    title: `@${profile.username} — TikTok`,
    description: `Public TikTok profile data for @${profile.username} on SocialTrace: followers, following, and videos.`,
    path: `/profile/tiktok/${profile.username}`,
  });
}

const TABS = [
  { href: "", label: "Videos" },
  { href: "/followers", label: "Followers" },
  { href: "/following", label: "Following" },
];

export default async function TikTokProfileLayout(props: TikTokProfileLayoutProps) {
  const { children } = props;
  const params = await props.params;
  const profile = await requireProfile(params.username, "tiktok");
  const base = `/profile/tiktok/${profile.username}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PlatformProfileHeader profile={profile} />

      {profile.isPrivate ? (
        <div className="mt-8">
          <NotAvailable detail="This account is private on TikTok — only its approved followers can see its content, and that's respected here." />
        </div>
      ) : (
        <div className="mt-8">
          <div className="flex gap-1 border-b border-border">
            {TABS.map((tab) => (
              <Link
                key={tab.label}
                href={`${base}${tab.href}`}
                className="min-h-[44px] shrink-0 border-b-2 border-transparent px-3.5 py-3 text-sm font-medium text-secondary transition-colors hover:text-primary"
              >
                {tab.label}
              </Link>
            ))}
          </div>
          <div className="pt-6">{children}</div>
        </div>
      )}

      <AdSlot placementId={103} className="mt-12" />
    </div>
  );
}
