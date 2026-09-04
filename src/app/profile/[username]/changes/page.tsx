import { requireProfile } from "@/lib/server/profile";
import { NotAvailable } from "@/components/profile/not-available";

export default async function ProfileChangesPage({ params }: { params: { username: string } }) {
  await requireProfile(params.username);
  return (
    <NotAvailable detail="Change detection requires the diff engine, which is not part of this build." />
  );
}
