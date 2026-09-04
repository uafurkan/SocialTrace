import { requireProfile } from "@/lib/server/profile";
import { NotAvailable } from "@/components/profile/not-available";

export default async function ProfileHistoryPage({ params }: { params: { username: string } }) {
  await requireProfile(params.username);
  return (
    <NotAvailable detail="Profile history requires the snapshot engine, which is not part of this build." />
  );
}
