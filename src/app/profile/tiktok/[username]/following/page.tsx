import { requireProfile } from "@/lib/server/profile";
import { isDbConfigured } from "@/lib/db";
import { DatasetHeader } from "@/components/followers/dataset-header";
import { MemberList } from "@/components/followers/member-list";
import { copy } from "@/lib/copy";

export const maxDuration = 60;

export default async function TikTokFollowingPage(props: { params: Promise<{ username: string }> }) {
  const params = await props.params;
  const profile = await requireProfile(params.username, "tiktok");
  return (
    <div>
      <DatasetHeader title={copy.followers.followingTitle} coverage={profile.followingCoverage} />
      <MemberList
        profileId={profile.id}
        username={profile.username}
        kind="following"
        dbAvailable={isDbConfigured()}
        apiBasePath="/api/v1/tiktok/profiles"
        supportsSavedSearch={false}
      />
    </div>
  );
}
