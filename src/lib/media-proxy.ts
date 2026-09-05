/**
 * Routes Instagram/Facebook CDN image URLs through our own
 * `/api/v1/media/proxy` (server-to-server fetch) instead of the browser
 * hotlinking fbcdn.net/cdninstagram.com directly. Confirmed via a direct
 * server-side fetch that the CDN itself serves these fine — the failures
 * (initials shown instead of a real avatar, blank thumbnails) are
 * consistent with a client-network-level block on those domains that
 * doesn't affect Vercel's egress, not a bug in the URL or its signature.
 * Other hosts (e.g. picsum.photos from the mock provider) pass through
 * unproxied — no reason to add a hop for a host with no known issue.
 */
const HOTLINK_RISK_HOSTS = ["cdninstagram.com", "fbcdn.net"];

export function proxiedMediaUrl<T extends string | undefined | null>(url: T): T | string {
  if (!url) return url;

  let hostname: string;
  let protocol: string;
  try {
    ({ hostname, protocol } = new URL(url));
  } catch {
    return url;
  }

  if (protocol !== "https:") return url;

  const lower = hostname.toLowerCase();
  const needsProxy = HOTLINK_RISK_HOSTS.some((domain) => lower === domain || lower.endsWith(`.${domain}`));
  if (!needsProxy) return url;

  return `/api/v1/media/proxy?url=${encodeURIComponent(url)}`;
}
