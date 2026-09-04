import { requireProfile } from "@/lib/server/profile";
import { isDbConfigured } from "@/lib/db";
import { listSnapshots } from "@/lib/snapshot/capture";
import { NotAvailable } from "@/components/profile/not-available";
import { SnapshotComparer } from "@/components/profile/snapshot-comparer";

export default async function ProfileComparePage({ params }: { params: { username: string } }) {
  const profile = await requireProfile(params.username);

  if (!isDbConfigured()) {
    return (
      <NotAvailable detail="Comparing snapshots requires a configured database, which this deployment does not have (DATABASE_URL is unset)." />
    );
  }

  const snapshots = await listSnapshots(profile.username, 50);

  if (snapshots.length < 2) {
    return (
      <NotAvailable detail="You need at least two captured snapshots to compare. Capture one from the History tab, wait for something to change, then capture another." />
    );
  }

  return <SnapshotComparer profileId={profile.id} username={profile.username} snapshots={snapshots} />;
}
