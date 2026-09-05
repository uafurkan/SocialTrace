const ALLOWED_MEDIA_HOSTS = ["cdninstagram.com", "fbcdn.net", "picsum.photos"];

export function isAllowedMediaHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return ALLOWED_MEDIA_HOSTS.some((domain) => lower === domain || lower.endsWith(`.${domain}`));
}

export function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 150);
  return cleaned || "socialtrace-media";
}

export function extensionFor(contentType: string): string {
  if (contentType.includes("video")) return "mp4";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}
