import type { Metadata } from "next";
import { cookies } from "next/headers";

import { getProfileByUsername, requireProfile } from "@/lib/server/profile";
import { isDbConfigured } from "@/lib/db";
import { isProfileTracked } from "@/lib/tracking/watchlist";
import { VISITOR_COOKIE } from "@/lib/tracking/visitor-cookie";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfileTabs } from "@/components/profile/profile-tabs";

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
  const visitorId = cookies().get(VISITOR_COOKIE)?.value;
  const initialTracked = dbAvailable && visitorId ? await isProfileTracked(profile.username, visitorId) : false;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <ProfileHeader profile={profile} initialTracked={initialTracked} dbAvailable={dbAvailable} />
      <div className="mt-8">
        <ProfileTabs username={profile.username} />
        <div className="pt-6">{children}</div>
      </div>
    </div>
  );
}
