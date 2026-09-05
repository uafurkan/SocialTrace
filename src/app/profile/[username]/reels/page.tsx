import { requireProfile } from "@/lib/server/profile";
import { safeProviderCall } from "@/lib/server/safe-provider-call";
import { provider } from "@/lib/providers";
import { PostGrid } from "@/components/profile/post-grid";
import { NotAvailable } from "@/components/profile/not-available";

export const maxDuration = 60;

export default async function ProfileReelsPage(props: { params: Promise<{ username: string }> }) {
  const params = await props.params;
  const profile = await requireProfile(params.username);
  const page = await safeProviderCall(() => provider.getReels(profile.id, undefined, 24));
  if (!page) {
    return <NotAvailable detail="Couldn't load reels right now — the data source hit an error. Try again shortly." />;
  }
  return <PostGrid posts={page.items} />;
}
