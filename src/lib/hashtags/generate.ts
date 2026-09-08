import { CATEGORY_KEYWORDS, GENERIC_HASHTAGS, HASHTAG_CATEGORIES } from "./categories";

const MAX_MATCHED_CATEGORIES = 3;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Ranks categories by how many of their keywords appear in the input, returns the top matches (ties broken by category insertion order). */
function matchCategories(tokens: string[]): string[] {
  const tokenSet = new Set(tokens);
  const scored = Object.entries(CATEGORY_KEYWORDS)
    .map(([category, keywords]) => ({
      category,
      score: keywords.reduce((count, keyword) => count + (tokenSet.has(keyword) ? 1 : 0), 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, MAX_MATCHED_CATEGORIES).map((entry) => entry.category);
}

export interface HashtagGenerationResult {
  hashtags: string[];
  matchedCategories: string[];
  isGenericFallback: boolean;
}

/**
 * Matches free-text input against hand-curated category keyword lists and
 * returns that category's hashtags — deduped, capped at maxCount. Falls
 * back to a small set of clearly-generic tags only when nothing matches.
 * Never returns any popularity/volume/reach number — hashtag strings only.
 */
export function generateHashtags(text: string, maxCount = 20): HashtagGenerationResult {
  const tokens = tokenize(text);
  const matchedCategories = matchCategories(tokens);

  if (matchedCategories.length === 0) {
    return { hashtags: GENERIC_HASHTAGS.slice(0, maxCount), matchedCategories: [], isGenericFallback: true };
  }

  const deduped = new Set<string>();
  for (const category of matchedCategories) {
    for (const hashtag of HASHTAG_CATEGORIES[category]) {
      if (deduped.size >= maxCount) break;
      deduped.add(hashtag);
    }
  }

  return { hashtags: [...deduped], matchedCategories, isGenericFallback: false };
}
