import { requireProfile } from "@/lib/server/profile";
import { safeProviderCall } from "@/lib/server/safe-provider-call";
import { provider } from "@/lib/providers";
import { NotAvailable } from "@/components/profile/not-available";
import { TaggedPostGrid } from "@/components/profile/tagged-post-grid";

export default async function ProfileTaggedPage({ params }: { params: { username: string } }) {
  const profile = await requireProfile(params.username);

  if (!provider.capabilities.taggedPosts) {
    return <NotAvailable detail="Tagged post lookup is not enabled for the current data provider." />;
  }

  const posts = await safeProviderCall(() => provider.getTaggedPosts(profile.id));
  if (!posts) {
    return <NotAvailable detail="Couldn't load tagged posts right now — the data source hit an error. Try again shortly." />;
  }
  return <TaggedPostGrid posts={posts} />;
}
