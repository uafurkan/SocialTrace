/**
 * LinkedIn profile lookup via Bright Data's Datasets API — dataset
 * `gd_l1viktl72bvl7bjuj0` ("LinkedIn people profiles"), confirmed live this
 * session by triggering a real lookup and inspecting the exact response
 * shape (docs/DECISIONS.md).
 *
 * Unlike the Instagram/Facebook Bright Data paths in profile.ts (which are
 * fire-and-forget background warms because completion time there was too
 * variable to block a page load on), this lookup is awaited synchronously:
 * live testing found LinkedIn's dataset completes in ~15-54s, and this is
 * the *only* source for LinkedIn data in this codebase — there's no free/
 * Apify fallback to serve first, so there's nothing to warm in the
 * background in service of. The API route calling this sets
 * `maxDuration = 90` to leave real headroom above the slowest run seen.
 */
import {
  BrightDataError,
  isBrightDataConfigured,
  pollBrightDataSnapshot,
  triggerBrightDataDataset,
} from "./client";
import { extractLinkedInSlug, linkedInProfileUrlFor } from "@/lib/linkedin/extract-slug";
import { LinkedInLookupError, type LinkedInProfile } from "@/lib/linkedin/types";

const LINKEDIN_PROFILES_DATASET_ID = "gd_l1viktl72bvl7bjuj0";

// Live testing (this session) observed completion times from ~15s to ~54s
// across separate runs — wider than first measured, so this is bounded
// under the calling route's 90s function budget with real headroom, not
// tuned to the fastest run seen.
const POLL_INTERVAL_MS = 3_000;
const MAX_WAIT_MS = 80_000;

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

interface BrightDataLinkedInExperience {
  title?: unknown;
  company?: unknown;
  company_id?: unknown;
  url?: unknown;
  start_date?: unknown;
  end_date?: unknown;
}

interface BrightDataLinkedInEducation {
  title?: unknown;
  url?: unknown;
  start_year?: unknown;
  end_year?: unknown;
}

interface BrightDataLinkedInPost {
  id?: unknown;
  title?: unknown;
  link?: unknown;
  created_at?: unknown;
  interaction?: unknown;
}

interface BrightDataLinkedInRecord {
  // Present only on a failed lookup (confirmed live against a nonexistent
  // slug): { error: "The profile is hidden or private.", error_code: "dead_page" }
  error?: unknown;
  error_code?: unknown;

  id?: unknown;
  linkedin_id?: unknown;
  name?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  position?: unknown;
  about?: unknown;
  location?: unknown;
  city?: unknown;
  avatar?: unknown;
  banner_image?: unknown;
  followers?: unknown;
  connections?: unknown;
  influencer?: unknown;
  url?: unknown;
  input_url?: unknown;
  current_company_name?: unknown;
  current_company?: { title?: unknown };
  experience?: unknown;
  education?: unknown;
  posts?: unknown;
}

function mapExperience(item: BrightDataLinkedInExperience): LinkedInProfile["experience"][number] {
  return {
    title: text(item.title),
    company: text(item.company),
    companyId: nullableText(item.company_id),
    companyUrl: nullableText(item.url),
    startDate: nullableText(item.start_date),
    endDate: nullableText(item.end_date),
  };
}

function mapEducation(item: BrightDataLinkedInEducation): LinkedInProfile["education"][number] {
  return {
    title: text(item.title),
    url: nullableText(item.url),
    startYear: nullableText(item.start_year),
    endYear: nullableText(item.end_year),
  };
}

function mapPost(item: BrightDataLinkedInPost): LinkedInProfile["posts"][number] {
  return {
    id: text(item.id),
    title: text(item.title),
    link: text(item.link),
    createdAt: nullableText(item.created_at),
    interaction: nullableText(item.interaction),
  };
}

function mapRecord(record: BrightDataLinkedInRecord, requestedSlug: string): LinkedInProfile {
  const slug = text(record.linkedin_id) || text(record.id) || requestedSlug;
  return {
    slug,
    profileUrl: text(record.url) || linkedInProfileUrlFor(slug),
    name: text(record.name),
    firstName: text(record.first_name),
    lastName: text(record.last_name),
    headline: text(record.position),
    about: text(record.about),
    location: text(record.location) || text(record.city),
    avatarUrl: text(record.avatar),
    bannerUrl: text(record.banner_image),
    followers: num(record.followers),
    connections: num(record.connections),
    isInfluencer: record.influencer === true,
    currentCompanyName: nullableText(record.current_company_name),
    currentCompanyTitle: nullableText(record.current_company?.title),
    experience: Array.isArray(record.experience) ? record.experience.map(mapExperience) : [],
    education: Array.isArray(record.education) ? record.education.map(mapEducation) : [],
    posts: Array.isArray(record.posts) ? record.posts.map(mapPost) : [],
  };
}

/**
 * Looks up one public LinkedIn profile by slug. Throws `LinkedInLookupError`
 * with an honest reason — never returns a partially-fabricated profile.
 */
export async function fetchLinkedInProfile(slug: string): Promise<LinkedInProfile> {
  if (!isBrightDataConfigured()) {
    throw new LinkedInLookupError("provider_unavailable", "LinkedIn lookups are not configured on this deployment.");
  }

  let records: unknown[];
  try {
    const snapshotId = await triggerBrightDataDataset(LINKEDIN_PROFILES_DATASET_ID, [
      { url: linkedInProfileUrlFor(slug) },
    ]);
    records = await pollBrightDataSnapshot(snapshotId, {
      pollIntervalMs: POLL_INTERVAL_MS,
      maxWaitMs: MAX_WAIT_MS,
    });
  } catch (error) {
    const message = error instanceof BrightDataError ? error.message : String(error);
    throw new LinkedInLookupError("provider_unavailable", `LinkedIn lookup failed: ${message}`);
  }

  const record = records[0] as BrightDataLinkedInRecord | undefined;

  // Confirmed live: a nonexistent/private slug still returns a ready
  // snapshot, just with one error record instead of profile data — never a
  // thrown poll error. `records.length === 0` (no error field either) is
  // treated the same way defensively, never as a fabricated empty profile.
  if (!record || record.error || !text(record.name)) {
    throw new LinkedInLookupError("not_found", "No public LinkedIn profile found at that link.");
  }

  return mapRecord(record, slug);
}
