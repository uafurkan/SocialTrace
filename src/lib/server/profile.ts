import { cache } from "react";
import { notFound } from "next/navigation";

import { getCachedProfile } from "@/lib/cache/profile-cache";
import { ProfileNotFoundError } from "@/lib/providers";

export const getProfileByUsername = cache(async (username: string) => {
  try {
    const { profile } = await getCachedProfile(username);
    return profile;
  } catch (error) {
    if (error instanceof ProfileNotFoundError) return null;
    throw error;
  }
});

export async function requireProfile(username: string) {
  const profile = await getProfileByUsername(username);
  if (!profile) notFound();
  return profile;
}
