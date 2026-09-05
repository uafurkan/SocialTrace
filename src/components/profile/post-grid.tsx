"use client";

import { useState } from "react";
import { Download, Heart, MessageCircle, LayoutGrid, List, Play } from "lucide-react";

import type { Post } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { mediaDownloadUrl } from "@/lib/media-download-url";
import { formatCount } from "@/lib/utils";

export function PostGrid({ posts }: { posts: Post[] }) {
  const [view, setView] = useState<"grid" | "list">("grid");

  if (posts.length === 0) {
    return <p className="py-16 text-center text-sm text-muted">No posts to display.</p>;
  }

  return (
    <div>
      <div className="mb-4 flex justify-end gap-1">
        <Button
          variant={view === "grid" ? "secondary" : "tertiary"}
          size="sm"
          onClick={() => setView("grid")}
          aria-pressed={view === "grid"}
          aria-label="Grid view"
        >
          <LayoutGrid className="size-4" />
        </Button>
        <Button
          variant={view === "list" ? "secondary" : "tertiary"}
          size="sm"
          onClick={() => setView("list")}
          aria-pressed={view === "list"}
          aria-label="List view"
        >
          <List className="size-4" />
        </Button>
      </div>

      {view === "grid" ? (
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
                  href={mediaDownloadUrl(post.mediaUrl, `${post.id}`)}
                  className="absolute left-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
                  aria-label="Download"
                  title="Download"
                >
                  <Download className="size-3.5" />
                </a>
              ) : null}
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/60 to-transparent p-2 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                <span className="flex items-center gap-1">
                  <Heart className="size-3.5" /> {formatCount(post.likeCount)}
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="size-3.5" /> {formatCount(post.commentCount)}
                </span>
                {post.viewCount != null ? (
                  <span className="flex items-center gap-1">
                    <Play className="size-3.5" /> {formatCount(post.viewCount)}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr className="border-b border-border">
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium">Likes</th>
                <th className="py-2 pr-4 font-medium">Comments</th>
                <th className="py-2 pr-4 font-medium">Caption</th>
                <th className="py-2 font-medium">
                  <span className="sr-only">Download</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id} className="border-b border-border last:border-0">
                  <td className="py-2 pr-4 text-secondary">
                    {new Date(post.postedAt).toLocaleDateString("en-US")}
                  </td>
                  <td className="py-2 pr-4 capitalize text-secondary">{post.mediaType}</td>
                  <td className="py-2 pr-4 text-primary">{formatCount(post.likeCount)}</td>
                  <td className="py-2 pr-4 text-primary">{formatCount(post.commentCount)}</td>
                  <td className="max-w-xs truncate py-2 pr-4 text-secondary">{post.caption}</td>
                  <td className="py-2">
                    {post.mediaUrl ? (
                      <a
                        href={mediaDownloadUrl(post.mediaUrl, post.id)}
                        className="inline-flex items-center gap-1 text-brand-strong hover:underline"
                        aria-label="Download"
                      >
                        <Download className="size-3.5" /> Download
                      </a>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
