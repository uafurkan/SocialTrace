import { requireProfile } from "@/lib/server/profile";
import { provider } from "@/lib/providers";
import { PostGrid } from "@/components/profile/post-grid";

export default async function ProfileReelsPage({ params }: { params: { username: string } }) {
  const profile = await requireProfile(params.username);
  const { items } = await provider.getReels(profile.id, undefined, 24);
  return <PostGrid posts={items} />;
}
