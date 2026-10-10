import { zipSync } from "fflate";

import type { Post } from "@/lib/domain/types";

/**
 * Upper bound on the bytes held in browser memory while building one archive.
 * Video posts are large, so the archive stops here and says so rather than
 * exhausting the tab.
 */
export const MAX_ARCHIVE_BYTES = 250 * 1024 * 1024;

export interface ArchiveEntry {
  name: string;
  data: Uint8Array;
}

export interface CollectedMedia {
  entries: ArchiveEntry[];
  /** Posts with no downloadable file, or whose file could not be fetched. */
  skipped: number;
  /** True when the archive stopped early because the size budget was reached. */
  truncated: boolean;
}

export function extensionForMime(mime: string): string {
  if (mime.startsWith("video/")) return "mp4";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

/**
 * Media is already compressed (JPEG, MP4), so entries are stored as-is.
 * Deflating them again would cost CPU for almost no size gain.
 */
export function buildArchive(entries: ArchiveEntry[]): Uint8Array<ArrayBuffer> {
  const files: Record<string, [Uint8Array, { level: 0 }]> = {};
  for (const entry of entries) {
    files[entry.name] = [entry.data, { level: 0 }];
  }
  // fflate allocates its output with a plain ArrayBuffer, so the narrower type is accurate.
  return zipSync(files) as Uint8Array<ArrayBuffer>;
}

/**
 * Fetches each post's media one at a time, in the order shown. Fetching is
 * injected so the budget and naming rules can be tested without a network.
 */
export async function collectPostMedia(
  posts: Post[],
  fetchMedia: (url: string) => Promise<Blob>,
  options: { budgetBytes?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<CollectedMedia> {
  const budget = options.budgetBytes ?? MAX_ARCHIVE_BYTES;
  const entries: ArchiveEntry[] = [];
  let usedBytes = 0;
  let skipped = 0;
  let truncated = false;

  for (let index = 0; index < posts.length; index += 1) {
    options.onProgress?.(index, posts.length);
    const post = posts[index];
    if (!post.mediaUrl) {
      skipped += 1;
      continue;
    }

    let blob: Blob;
    try {
      blob = await fetchMedia(post.mediaUrl);
    } catch {
      skipped += 1;
      continue;
    }

    if (usedBytes + blob.size > budget) {
      truncated = true;
      break;
    }

    usedBytes += blob.size;
    const safeId = post.id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40) || "post";
    const number = String(index + 1).padStart(3, "0");
    entries.push({
      name: `${number}-${safeId}.${extensionForMime(blob.type)}`,
      data: new Uint8Array(await blob.arrayBuffer()),
    });
  }

  options.onProgress?.(posts.length, posts.length);
  return { entries, skipped, truncated };
}
