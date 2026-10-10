import { sanitizeFilename } from "@/app/api/v1/media/download/utils";
import type { Platform } from "@/lib/domain/types";
import { CSV_BOM } from "@/lib/export/serialize";

export type EngagementListKind = "likers" | "comments";

/**
 * The post's own identifier taken from its permalink: the last path segment
 * (Instagram shortcode, TikTok video id, Facebook post id). Falls back to
 * "post" when there is no usable segment, e.g. a permalink.php link.
 */
export function postKeyFromPermalink(permalink: string): string {
  try {
    const segments = new URL(permalink).pathname.split("/").filter(Boolean);
    const last = segments.length > 0 ? segments[segments.length - 1] : "";
    return last && !last.includes(".") ? last : "post";
  } catch {
    return "post";
  }
}

/**
 * Download name for one engagement list, e.g. socialtrace-instagram-ABC123-likers.csv.
 * The post id is used when one is given; otherwise the key is read from the permalink.
 */
export function engagementCsvFilename(platform: Platform, permalink: string, kind: EngagementListKind, postId?: string): string {
  const trimmedId = postId?.trim();
  const postKey = trimmedId ? trimmedId : postKeyFromPermalink(permalink);
  return sanitizeFilename(`socialtrace-${platform}-${postKey}-${kind}.csv`);
}

/**
 * Saves CSV text as a file through a Blob object URL. The file starts with a
 * UTF-8 byte-order mark so Excel reads non-ASCII text correctly. The URL is
 * revoked after the click; the revoke is deferred because some browsers cancel
 * the download when the URL is released in the same tick.
 */
export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([`${CSV_BOM}${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
