import type { Metadata } from "next";

import { getProfileByUsername, requireProfile } from "@/lib/server/profile";
import { isDbConfigured } from "@/lib/db";
import { resolveIdentityReadOnly } from "@/lib/auth/identity";
import { isProfileTracked } from "@/lib/tracking/watchlist";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfileTabs } from "@/components/profile/profile-tabs";
import { AdSlot } from "@/components/ads/ad-slot";

interface ProfileLayoutProps {
  children: React.ReactNode;
  params: { username: string };
}

export async function generateMetadata({ params }: { params: { username: string } }): Promise<Metadata> {
  const profile = await getProfileByUsername(params.username);
  if (!profile) return { title: "Profile not found" };
  return {
    title: `@${profile.username}`,
    description: `Public profile data for @${profile.username} on SocialTrace: followers, following, posts and history.`,
  };
}

export default async function ProfileLayout({ children, params }: ProfileLayoutProps) {
  const profile = await requireProfile(params.username);

  const dbAvailable = isDbConfigured();
  const initialTracked = dbAvailable
    ? await isProfileTracked(profile.username, (await resolveIdentityReadOnly()).scopeId)
    : false;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <ProfileHeader profile={profile} initialTracked={initialTracked} dbAvailable={dbAvailable} />
      <div className="mt-8">
        <ProfileTabs username={profile.username} />
        <div className="pt-6">{children}</div>
      </div>

      {/* Below every tab's own content — never interrupts data mid-scroll or sits above the tab bar. */}
      <AdSlot placementId={103} className="mt-12" />
    </div>
  );
}
