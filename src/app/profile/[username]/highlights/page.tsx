import { requireProfile } from "@/lib/server/profile";
import { NotAvailable } from "@/components/profile/not-available";

export default async function ProfileHighlightsPage({ params }: { params: { username: string } }) {
  await requireProfile(params.username);
  return <NotAvailable detail="Highlights are not enabled in this build's mock data provider." />;
}
