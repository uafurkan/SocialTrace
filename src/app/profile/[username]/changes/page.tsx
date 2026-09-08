import { requireProfile } from "@/lib/server/profile";
import { isDbConfigured } from "@/lib/db";
import { listChanges } from "@/lib/diff/changes";
import { NotAvailable } from "@/components/profile/not-available";
import { ChangesList } from "@/components/profile/changes-list";

export const maxDuration = 60;

const FIELD_EMPTY_LABELS: Record<string, string> = {
  bio: "No bio changes recorded yet for this profile.",
  username: "No username changes recorded yet for this profile.",
};

export default async function ProfileChangesPage(props: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ field?: string }>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const profile = await requireProfile(params.username);

  if (!isDbConfigured()) {
    return (
      <NotAvailable detail="Change detection requires a configured database, which this deployment does not have (DATABASE_URL is unset)." />
    );
  }

  const changes = await listChanges(profile.username);
  const field = searchParams.field;
  const filtered = field ? changes.filter((change) => change.field === field) : changes;
  return <ChangesList changes={filtered} emptyLabel={field ? FIELD_EMPTY_LABELS[field] : undefined} />;
}
