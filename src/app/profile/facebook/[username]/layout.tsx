import type { Metadata } from "next";

import { getProfileByUsername, requireProfile } from "@/lib/server/profile";
import { PlatformProfileHeader } from "@/components/profile/platform-profile-header";
import { AdSlot } from "@/components/ads/ad-slot";
import { pageMetadata } from "@/lib/seo/metadata";

export const maxDuration = 60;

interface FacebookProfileLayoutProps {
  children: React.ReactNode;
  params: Promise<{ username: string }>;
}

export async function generateMetadata(props: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const params = await props.params;
  const profile = await getProfileByUsername(params.username, "facebook");
  if (!profile) return { title: "Page not found" };
  return pageMetadata({
    title: `${profile.displayName} — Facebook`,
    description: `Public Facebook Page data for ${profile.displayName} on SocialTrace: followers and posts.`,
    path: `/profile/facebook/${profile.username}`,
  });
}

export default async function FacebookProfileLayout(props: FacebookProfileLayoutProps) {
  const { children } = props;
  const params = await props.params;
  const profile = await requireProfile(params.username, "facebook");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PlatformProfileHeader profile={profile} />
      {/* No tab bar: Facebook Pages only support a posts feed in this
          build — no follower/following list exists to fetch (Meta
          doesn't expose one publicly), see docs/PROVIDER_CONTRACT.md. */}
      <div className="mt-8">{children}</div>
      <AdSlot placementId={103} className="mt-12" />
    </div>
  );
}
