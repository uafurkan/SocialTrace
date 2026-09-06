import { cache } from "react";
import { notFound } from "next/navigation";

import type { Platform } from "@/lib/domain/types";
import { getCachedProfile } from "@/lib/cache/profile-cache";
import { ProfileNotFoundError } from "@/lib/providers";

export const getProfileByUsername = cache(async (username: string, platform: Platform = "instagram") => {
  try {
    const { profile } = await getCachedProfile(username, platform);
    return profile;
  } catch (error) {
    if (error instanceof ProfileNotFoundError) return null;
    throw error;
  }
});

export async function requireProfile(username: string, platform: Platform = "instagram") {
  const profile = await getProfileByUsername(username, platform);
  if (!profile) notFound();
  return profile;
}
