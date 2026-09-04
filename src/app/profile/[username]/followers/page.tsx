import { requireProfile } from "@/lib/server/profile";
import { DatasetHeader } from "@/components/followers/dataset-header";
import { MemberList } from "@/components/followers/member-list";
import { copy } from "@/lib/copy";

export default async function ProfileFollowersPage({ params }: { params: { username: string } }) {
  const profile = await requireProfile(params.username);
  return (
    <div>
      <DatasetHeader title={copy.followers.title} coverage={profile.followerCoverage} />
      <MemberList profileId={profile.id} kind="followers" />
    </div>
  );
}
