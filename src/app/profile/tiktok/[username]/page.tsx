import { requireProfile } from "@/lib/server/profile";
import { safeProviderCall } from "@/lib/server/safe-provider-call";
import { getProvider } from "@/lib/providers";
import { PostGrid } from "@/components/profile/post-grid";
import { NotAvailable } from "@/components/profile/not-available";

export const maxDuration = 60;

export default async function TikTokProfilePage(props: { params: Promise<{ username: string }> }) {
  const params = await props.params;
  const profile = await requireProfile(params.username, "tiktok");
  const page = await safeProviderCall(() => getProvider("tiktok").getPosts(profile.id, undefined, 24));
  if (!page) {
    return <NotAvailable detail="Couldn't load videos right now — the data source hit an error. Try again shortly." />;
  }
  return <PostGrid posts={page.items} platform="tiktok" />;
}
