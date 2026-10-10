"use client";

import { useId, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, Heart, MessageCircle, LayoutGrid, List, Play, Search } from "lucide-react";

import type { Platform, Post } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mediaDownloadUrl } from "@/lib/media-download-url";
import { proxiedMediaUrl } from "@/lib/media-proxy";
import { formatCount } from "@/lib/utils";
import { computePostInsights, filterPostsByCaption } from "@/lib/posts/insights";
import {
  countUndatedPosts,
  DEFAULT_POST_SORT,
  filterPostsByDate,
  hasDateFilter,
  POST_SORT_OPTIONS,
  type PostSort,
  sortOptionValue,
  sortPosts,
} from "@/lib/posts/grid";
import { PostArchiveButton } from "@/components/profile/post-archive-button";
import { PostEngagementModal } from "@/components/profile/post-engagement-modal";
import { PostInsightsPanel } from "@/components/profile/post-insights";
import { HashtagPanel } from "@/components/profile/hashtag-panel";
import { PostTrendChart } from "@/components/profile/post-trend-chart";
import { PostingTimePanel } from "@/components/profile/posting-time-panel";

type HeaderSortKey = "likes" | "comments" | "date";

export function PostGrid({ posts, platform = "instagram" }: { posts: Post[]; platform?: Platform }) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<PostSort>(DEFAULT_POST_SORT);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const sortId = useId();
  const dateFromId = useId();
  const dateToId = useId();
  const insights = useMemo(() => computePostInsights(posts), [posts]);
  const captionMatches = useMemo(() => filterPostsByCaption(posts, query), [posts, query]);
  const visiblePosts = useMemo(
    () => sortPosts(filterPostsByDate(captionMatches, dateFrom, dateTo), sort.key, sort.direction),
    [captionMatches, dateFrom, dateTo, sort],
  );
  const searchActive = query.trim() !== "";
  const dateActive = hasDateFilter(dateFrom, dateTo);
  const filtersActive = searchActive || dateActive;
  const undatedCount = useMemo(() => (dateActive ? countUndatedPosts(posts) : 0), [posts, dateActive]);

  if (posts.length === 0) {
    return <p className="py-16 text-center text-sm text-muted">No posts to display.</p>;
  }

  function toggleHeaderSort(key: HeaderSortKey) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
    }));
  }

  function headerSortAttr(key: HeaderSortKey): "ascending" | "descending" | undefined {
    if (sort.key !== key) return undefined;
    return sort.direction === "asc" ? "ascending" : "descending";
  }

  function sortButton(key: HeaderSortKey, label: string) {
    const Arrow = sort.direction === "asc" ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        onClick={() => toggleHeaderSort(key)}
        className="inline-flex items-center gap-1 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
      >
        {label}
        {sort.key === key ? <Arrow className="size-3" aria-hidden="true" /> : null}
      </button>
    );
  }

  function clearDates() {
    setDateFrom("");
    setDateTo("");
  }

  return (
    <div>
      <PostInsightsPanel insights={insights} />
      <HashtagPanel posts={posts} />
      <PostTrendChart posts={posts} />
      <PostingTimePanel posts={posts} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search captions"
            aria-label="Search post captions"
            className="pl-9"
          />
        </div>
        <PostArchiveButton posts={visiblePosts} />
        <div className="ml-auto flex gap-1">
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
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <label htmlFor={sortId} className="text-sm text-secondary">
            Sort
          </label>
          <select
            id={sortId}
            value={sortOptionValue(sort)}
            onChange={(event) => {
              const option = POST_SORT_OPTIONS.find((item) => item.value === event.target.value);
              if (option) setSort(option.sort);
            }}
            className="h-11 rounded-button border border-border bg-surface px-3 text-base text-primary focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 sm:text-sm"
          >
            {POST_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={dateFromId} className="text-sm text-secondary">
            From
          </label>
          <Input
            id={dateFromId}
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(event) => setDateFrom(event.target.value)}
            className="w-auto"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={dateToId} className="text-sm text-secondary">
            To
          </label>
          <Input
            id={dateToId}
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(event) => setDateTo(event.target.value)}
            className="w-auto"
          />
        </div>
        <Button variant="secondary" onClick={clearDates} disabled={!dateFrom && !dateTo}>
          Clear dates
        </Button>
      </div>

      {filtersActive ? (
        <div className="mb-3 text-xs text-muted">
          <p>{`Showing ${visiblePosts.length} of ${posts.length} loaded posts`}</p>
          {undatedCount > 0 ? (
            <p>
              {`${undatedCount} loaded ${undatedCount === 1 ? "post has" : "posts have"} no known date and ${
                undatedCount === 1 ? "is" : "are"
              } hidden by the date range.`}
            </p>
          ) : null}
        </div>
      ) : null}

      {visiblePosts.length === 0 ? (
        captionMatches.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">No loaded posts mention &ldquo;{query.trim()}&rdquo;.</p>
        ) : (
          <p className="py-10 text-center text-sm text-muted">No loaded posts fall within this date range.</p>
        )
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {visiblePosts.map((post) => (
            <div key={post.id} className="group relative aspect-square overflow-hidden rounded-card border border-border bg-surface-subtle">
              {post.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={proxiedMediaUrl(post.thumbnailUrl)} alt="" className="size-full object-cover" loading="lazy" />
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
              <button
                type="button"
                onClick={() => setOpenPost(post)}
                disabled={!post.permalink}
                className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/60 to-transparent p-2 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
                title="View likers & comments"
              >
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
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr className="border-b border-border">
                <th className="py-2 pr-4 font-medium" aria-sort={headerSortAttr("date")}>
                  {sortButton("date", "Date")}
                </th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium" aria-sort={headerSortAttr("likes")}>
                  {sortButton("likes", "Likes")}
                </th>
                <th className="py-2 pr-4 font-medium" aria-sort={headerSortAttr("comments")}>
                  {sortButton("comments", "Comments")}
                </th>
                <th className="py-2 pr-4 font-medium">Caption</th>
                <th className="py-2 font-medium">
                  <span className="sr-only">Download</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visiblePosts.map((post) => (
                <tr key={post.id} className="border-b border-border last:border-0">
                  <td className="py-2 pr-4 text-secondary">
                    {post.postedAt ? new Date(post.postedAt).toLocaleDateString("en-US") : "—"}
                  </td>
                  <td className="py-2 pr-4 capitalize text-secondary">{post.mediaType}</td>
                  <td className="py-2 pr-4">
                    {post.permalink ? (
                      <button
                        type="button"
                        onClick={() => setOpenPost(post)}
                        className="text-primary hover:underline"
                        title="View likers"
                      >
                        {formatCount(post.likeCount)}
                      </button>
                    ) : (
                      formatCount(post.likeCount)
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    {post.permalink ? (
                      <button
                        type="button"
                        onClick={() => setOpenPost(post)}
                        className="text-primary hover:underline"
                        title="View comments"
                      >
                        {formatCount(post.commentCount)}
                      </button>
                    ) : (
                      formatCount(post.commentCount)
                    )}
                  </td>
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

      {openPost ? (
        <PostEngagementModal
          key={openPost.permalink}
          permalink={openPost.permalink}
          postId={openPost.id}
          platform={platform}
          onClose={() => setOpenPost(null)}
        />
      ) : null}
    </div>
  );
}
