import { requireProfile } from "@/lib/server/profile";
import { isDbConfigured } from "@/lib/db";
import { DatasetHeader } from "@/components/followers/dataset-header";
import { MemberList } from "@/components/followers/member-list";
import { copy } from "@/lib/copy";

export const maxDuration = 60;

export default async function TikTokFollowersPage(props: { params: Promise<{ username: string }> }) {
  const params = await props.params;
  const profile = await requireProfile(params.username, "tiktok");
  return (
    <div>
      <DatasetHeader title={copy.followers.title} coverage={profile.followerCoverage} />
      <MemberList
        profileId={profile.id}
        username={profile.username}
        kind="followers"
        dbAvailable={isDbConfigured()}
        apiBasePath="/api/v1/tiktok/profiles"
        supportsSavedSearch={false}
      />
    </div>
  );
}
