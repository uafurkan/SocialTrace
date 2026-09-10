/**
 * Pulls a LinkedIn public-profile slug ("williamhgates") out of either a
 * bare handle or a full profile URL, mirroring extractUsername() in
 * src/lib/profile-link.ts. Only `/in/<slug>` URLs resolve — company pages
 * (`/company/...`), posts (`/posts/...`), and every other LinkedIn path
 * shape are rejected rather than guessed at, same "only real, addressable
 * profiles" rule that file documents.
 */
const SLUG_PATTERN = /^[a-z0-9-]{3,100}$/i;
const HOST_PATTERN = /^(?:www\.)?linkedin\.com$/i;

export function extractLinkedInSlug(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (SLUG_PATTERN.test(trimmed) && !trimmed.includes("linkedin")) {
    return trimmed.toLowerCase();
  }

  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (!HOST_PATTERN.test(url.hostname)) return null;

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2 || parts[0].toLowerCase() !== "in") return null;

    const slug = parts[1];
    return SLUG_PATTERN.test(slug) ? slug.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function linkedInProfileUrlFor(slug: string): string {
  return `https://www.linkedin.com/in/${slug}/`;
}
