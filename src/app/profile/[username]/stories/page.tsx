import { requireProfile } from "@/lib/server/profile";
import { safeProviderCall } from "@/lib/server/safe-provider-call";
import { provider } from "@/lib/providers";
import { NotAvailable } from "@/components/profile/not-available";
import { StoryStrip } from "@/components/profile/story-strip";

export default async function ProfileStoriesPage(props: { params: Promise<{ username: string }> }) {
  const params = await props.params;
  const profile = await requireProfile(params.username);

  if (!provider.capabilities.stories) {
    return <NotAvailable detail="Public story viewing is not enabled for the current data provider." />;
  }

  const stories = await safeProviderCall(() => provider.getStories(profile.id));
  if (!stories) {
    return <NotAvailable detail="Couldn't load stories right now — the data source hit an error. Try again shortly." />;
  }
  return <StoryStrip stories={stories} />;
}
