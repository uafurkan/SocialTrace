import { requireProfile } from "@/lib/server/profile";
import { provider } from "@/lib/providers";
import { NotAvailable } from "@/components/profile/not-available";
import { StoryStrip } from "@/components/profile/story-strip";

export default async function ProfileStoriesPage({ params }: { params: { username: string } }) {
  const profile = await requireProfile(params.username);

  if (!provider.capabilities.stories) {
    return <NotAvailable detail="Public story viewing is not enabled for the current data provider." />;
  }

  const stories = await provider.getStories(profile.id);
  return <StoryStrip stories={stories} />;
}
