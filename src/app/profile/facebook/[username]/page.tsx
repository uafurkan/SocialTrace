import { requireProfile } from "@/lib/server/profile";
import { safeProviderCall } from "@/lib/server/safe-provider-call";
import { getProvider } from "@/lib/providers";
import { PostGrid } from "@/components/profile/post-grid";
import { NotAvailable } from "@/components/profile/not-available";

// The response itself is fast again (Bright Data no longer blocks it — see
// providers/brightdata/profile.ts), but Vercel's `after()` background work
// still shares this function's execution budget, so this stays raised past
// 60 to give the Bright Data background warm a real chance to finish.
export const maxDuration = 90;

export default async function FacebookProfilePage(props: { params: Promise<{ username: string }> }) {
  const params = await props.params;
  const profile = await requireProfile(params.username, "facebook");
  const page = await safeProviderCall(() => getProvider("facebook").getPosts(profile.id, undefined, 24));
  if (!page) {
    return <NotAvailable detail="Couldn't load posts right now — the data source hit an error. Try again shortly." />;
  }
  return <PostGrid posts={page.items} platform="facebook" />;
}
