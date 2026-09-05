import { Download, Heart, MessageCircle, Play } from "lucide-react";

import type { TaggedPost } from "@/lib/domain/types";
import { mediaDownloadUrl } from "@/lib/media-download-url";
import { formatCount } from "@/lib/utils";
import { NotAvailable } from "@/components/profile/not-available";

export function TaggedPostGrid({ posts }: { posts: TaggedPost[] }) {
  if (posts.length === 0) {
    return <NotAvailable detail="No public posts currently tag this profile." />;
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
      {posts.map((post) => (
        <div
          key={post.id}
          className="group relative aspect-square overflow-hidden rounded-card border border-border bg-surface-subtle"
        >
          {post.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.thumbnailUrl} alt="" className="size-full object-cover" loading="lazy" />
          ) : null}
          {post.mediaType !== "image" ? (
            <Play className="absolute right-2 top-2 size-4 text-inverse drop-shadow" aria-hidden="true" />
          ) : null}
          {post.mediaUrl ? (
            <a
              href={mediaDownloadUrl(post.mediaUrl, post.id)}
              className="absolute left-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
              aria-label="Download"
              title="Download"
            >
              <Download className="size-3.5" />
            </a>
          ) : null}
          <a
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
          >
            <span className="truncate">@{post.authorUsername}</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Heart className="size-3.5" /> {formatCount(post.likeCount)}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="size-3.5" /> {formatCount(post.commentCount)}
              </span>
            </div>
          </a>
        </div>
      ))}
    </div>
  );
}
