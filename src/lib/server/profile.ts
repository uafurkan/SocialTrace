import { cache } from "react";
import { notFound } from "next/navigation";

import type { Platform } from "@/lib/domain/types";
import { getCachedProfile } from "@/lib/cache/profile-cache";
import { ProfileNotFoundError } from "@/lib/providers";
import { ProviderUnavailableError } from "@/lib/providers/types";

export const getProfileByUsername = cache(async (username: string, platform: Platform = "instagram") => {
  try {
    const { profile } = await getCachedProfile(username, platform);
    return profile;
  } catch (error) {
    if (error instanceof ProfileNotFoundError) return null;
    // Anything else means every source failed and no cached copy existed
    // (getCachedProfile already serves a stale row when it has one). Retyped
    // here so it stops surfacing as an anonymous crash: the profile segment's
    // error boundary can then say what's actually true — the data source is
    // temporarily unreachable — instead of "unexpected error", and Sentry gets
    // a named, expected condition rather than a mystery stack trace.
    //
    // Deliberately not `notFound()`: a source outage must never be reported to
    // a visitor as "this profile doesn't exist".
    throw new ProviderUnavailableError(`${platform}/${username}`, error);
  }
});

export async function requireProfile(username: string, platform: Platform = "instagram") {
  const profile = await getProfileByUsername(username, platform);
  if (!profile) notFound();
  return profile;
}
