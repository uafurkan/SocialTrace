import { requireProfile } from "@/lib/server/profile";
import { NotAvailable } from "@/components/profile/not-available";

export default async function ProfileStoriesPage({ params }: { params: { username: string } }) {
  await requireProfile(params.username);
  return <NotAvailable detail="Public story viewing is not enabled in this build's mock data provider." />;
}
