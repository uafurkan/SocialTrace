import { requireProfile } from "@/lib/server/profile";
import { isDbConfigured } from "@/lib/db";
import { listSnapshots } from "@/lib/snapshot/capture";
import { NotAvailable } from "@/components/profile/not-available";
import { SnapshotHistory } from "@/components/profile/snapshot-history";

export default async function ProfileHistoryPage(props: { params: Promise<{ username: string }> }) {
  const params = await props.params;
  const profile = await requireProfile(params.username);

  if (!isDbConfigured()) {
    return (
      <NotAvailable detail="Profile history requires a configured database, which this deployment does not have (DATABASE_URL is unset)." />
    );
  }

  const snapshots = await listSnapshots(profile.username);
  return <SnapshotHistory profileId={profile.id} username={profile.username} initialSnapshots={snapshots} />;
}
