import { requireProfile } from "@/lib/server/profile";
import { safeProviderCall } from "@/lib/server/safe-provider-call";
import { provider } from "@/lib/providers";
import { NotAvailable } from "@/components/profile/not-available";
import { HighlightGrid } from "@/components/profile/highlight-grid";

export default async function ProfileHighlightsPage({ params }: { params: { username: string } }) {
  const profile = await requireProfile(params.username);

  if (!provider.capabilities.highlights) {
    return <NotAvailable detail="Highlights are not enabled for the current data provider." />;
  }

  const highlights = await safeProviderCall(() => provider.getHighlights(profile.id));
  if (!highlights) {
    return <NotAvailable detail="Couldn't load highlights right now — the data source hit an error. Try again shortly." />;
  }
  return <HighlightGrid highlights={highlights} />;
}
