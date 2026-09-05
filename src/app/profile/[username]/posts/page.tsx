import { requireProfile } from "@/lib/server/profile";
import { safeProviderCall } from "@/lib/server/safe-provider-call";
import { provider } from "@/lib/providers";
import { PostGrid } from "@/components/profile/post-grid";
import { NotAvailable } from "@/components/profile/not-available";

export default async function ProfilePostsPage({ params }: { params: { username: string } }) {
  const profile = await requireProfile(params.username);
  const page = await safeProviderCall(() => provider.getPosts(profile.id, undefined, 24));
  if (!page) {
    return <NotAvailable detail="Couldn't load posts right now — the data source hit an error. Try again shortly." />;
  }
  return <PostGrid posts={page.items} />;
}
