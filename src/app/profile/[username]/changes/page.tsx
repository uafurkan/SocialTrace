import { requireProfile } from "@/lib/server/profile";
import { isDbConfigured } from "@/lib/db";
import { listChanges } from "@/lib/diff/changes";
import { NotAvailable } from "@/components/profile/not-available";
import { ChangesList } from "@/components/profile/changes-list";

export const maxDuration = 60;

export default async function ProfileChangesPage(props: { params: Promise<{ username: string }> }) {
  const params = await props.params;
  const profile = await requireProfile(params.username);

  if (!isDbConfigured()) {
    return (
      <NotAvailable detail="Change detection requires a configured database, which this deployment does not have (DATABASE_URL is unset)." />
    );
  }

  const changes = await listChanges(profile.username);
  return <ChangesList changes={changes} />;
}
