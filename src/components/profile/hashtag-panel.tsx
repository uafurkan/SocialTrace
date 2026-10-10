import { countHashtags } from "@/lib/hashtags/analyze";

const TOP_TAG_COUNT = 20;

function captionWord(n: number): string {
  return n === 1 ? "caption" : "captions";
}

function postWord(n: number): string {
  return n === 1 ? "post" : "posts";
}

/**
 * Top hashtags across the posts already loaded on the page. Each count is the
 * number of loaded captions using that tag. It describes this sample only and
 * says nothing about reach, volume or popularity. Caption text is rendered as
 * plain text, never as HTML.
 */
export function HashtagPanel({ posts }: { posts: { caption: string }[] }) {
  const { tags, postsWithHashtags, totalPosts } = countHashtags(posts, TOP_TAG_COUNT);
  if (postsWithHashtags === 0 || tags.length === 0) return null;

  const topCount = tags[0].count;

  return (
    <section aria-label="Hashtags in loaded posts" className="mb-4 rounded-card border border-border bg-surface-subtle px-3 py-2">
      <h3 className="text-sm font-semibold text-primary">Hashtags</h3>
      <p className="mt-0.5 text-xs text-muted">
        Hashtags appear in {postsWithHashtags} {captionWord(postsWithHashtags)} out of {totalPosts} loaded{" "}
        {postWord(totalPosts)}.
      </p>
      <ol className="mt-3 space-y-2">
        {tags.map(({ tag, count }) => (
          <li key={tag}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 break-words text-primary">{tag}</span>
              <span className="shrink-0 tabular-nums text-secondary">
                {count}
                <span className="sr-only">
                  {" "}
                  (in {count} {captionWord(count)} out of {totalPosts} loaded {postWord(totalPosts)})
                </span>
              </span>
            </div>
            <div aria-hidden="true" className="mt-1 h-1.5 overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-brand" style={{ width: `${(count / topCount) * 100}%` }} />
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-muted">
        Counts cover only these loaded posts, not the whole account, and are not a measure of reach or popularity.
      </p>
    </section>
  );
}
