/**
 * LinkedIn profile viewer — the domain shape returned by Bright Data's
 * "LinkedIn people profiles" dataset (`gd_l1viktl72bvl7bjuj0`), confirmed by
 * live trigger/poll/snapshot calls against a real public profile (see
 * docs/DECISIONS.md). This is a standalone lib, not a `SocialDataProvider`
 * implementation — LinkedIn isn't in the `Platform` enum and has no free or
 * Apify source, so it doesn't belong behind that interface (mirrors how
 * the Engagement Calculator and Username Availability Checker are
 * self-contained libs rather than full providers).
 */

export interface LinkedInExperience {
  title: string;
  company: string;
  companyId: string | null;
  companyUrl: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface LinkedInEducation {
  title: string;
  url: string | null;
  startYear: string | null;
  endYear: string | null;
}

export interface LinkedInPost {
  id: string;
  title: string;
  link: string;
  createdAt: string | null;
  interaction: string | null;
}

export interface LinkedInProfile {
  slug: string;
  profileUrl: string;
  name: string;
  firstName: string;
  lastName: string;
  headline: string;
  about: string;
  location: string;
  avatarUrl: string;
  bannerUrl: string;
  followers: number;
  connections: number;
  isInfluencer: boolean;
  currentCompanyName: string | null;
  currentCompanyTitle: string | null;
  experience: LinkedInExperience[];
  education: LinkedInEducation[];
  posts: LinkedInPost[];
}

export type LinkedInLookupErrorReason = "invalid_url" | "not_found" | "provider_unavailable";

/**
 * Three-state-honesty class, same shape as `ProfileNotFoundError` /
 * `ProviderUnavailableError` in src/lib/providers/types.ts: "not_found"
 * means Bright Data itself resolved the lookup and reported the profile as
 * gone/hidden/private (its own `error_code: "dead_page"`, confirmed live —
 * Bright Data does not distinguish "never existed" from "private", so
 * neither does this reason). "provider_unavailable" means the lookup itself
 * couldn't run (no token configured, trigger/poll/snapshot failure, or a
 * timeout) — a temporary condition, not a verdict about the profile.
 */
export class LinkedInLookupError extends Error {
  constructor(
    public reason: LinkedInLookupErrorReason,
    message: string,
  ) {
    super(message);
    this.name = "LinkedInLookupError";
  }
}
