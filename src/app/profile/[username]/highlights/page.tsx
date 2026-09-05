import { requireProfile } from "@/lib/server/profile";
import { provider } from "@/lib/providers";
import { NotAvailable } from "@/components/profile/not-available";
import { HighlightGrid } from "@/components/profile/highlight-grid";

export default async function ProfileHighlightsPage({ params }: { params: { username: string } }) {
  const profile = await requireProfile(params.username);

  if (!provider.capabilities.highlights) {
    return <NotAvailable detail="Highlights are not enabled for the current data provider." />;
  }

  const highlights = await provider.getHighlights(profile.id);
  return <HighlightGrid highlights={highlights} />;
}
