/**
 * Hashtag counts over the posts already loaded on a profile page. Pure logic,
 * no provider calls. Every number describes only the loaded sample, never the
 * whole account, and nothing here measures reach, volume or popularity.
 */

/** "#" followed by letters, digits or underscores. A lone "#" never matches. */
const HASHTAG_PATTERN = /#[\p{L}\p{N}_]+/gu;
/** A body made only of underscores ("#___") is not a tag. */
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

export interface HashtagCount {
  /** First-seen spelling in the input, including the leading "#". */
  tag: string;
  /** Number of captions that contain this tag at least once. */
  count: number;
}

export interface HashtagSummary {
  /** Sorted by count (desc), then tag (asc, case-insensitive), capped at topN. */
  tags: HashtagCount[];
  /** Posts with at least one tag. */
  postsWithHashtags: number;
  /** All posts passed in, including those with empty captions. */
  totalPosts: number;
}

/**
 * Distinct tags in one caption, keyed by their lowercase form and mapped to
 * the spelling seen first in that caption. NFC normalization keeps a tag
 * typed with a decomposed accent (e + combining mark) from being cut short.
 */
function distinctTagsInCaption(caption: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of caption.normalize("NFC").matchAll(HASHTAG_PATTERN)) {
    const tag = match[0];
    if (!HAS_LETTER_OR_DIGIT.test(tag.slice(1))) continue;
    const key = tag.toLowerCase();
    if (!found.has(key)) found.set(key, tag);
  }
  return found;
}

export function countHashtags(posts: { caption: string }[], topN = 20): HashtagSummary {
  const byKey = new Map<string, HashtagCount>();
  let postsWithHashtags = 0;

  for (const post of posts) {
    const tagsHere = distinctTagsInCaption(post.caption);
    if (tagsHere.size === 0) continue;
    postsWithHashtags += 1;

    for (const [key, spelling] of tagsHere) {
      const existing = byKey.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        // Posts are visited in input order, so this is the first-seen spelling.
        byKey.set(key, { tag: spelling, count: 1 });
      }
    }
  }

  const ranked = [...byKey.entries()].sort(([keyA, a], [keyB, b]) => {
    if (b.count !== a.count) return b.count - a.count;
    return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
  });

  return {
    tags: ranked.slice(0, Math.max(0, topN)).map(([, entry]) => entry),
    postsWithHashtags,
    totalPosts: posts.length,
  };
}
