import { NextResponse } from "next/server";

/**
 * `llms.txt` (Mintlify's 2024 proposal) is not confirmed to be read by any
 * major AI crawler as of this writing — Google's John Mueller has said no
 * Google Search system acts on it, and no other provider has confirmed
 * support either. It's included anyway because it's zero-risk (a plain,
 * accurate index of real pages, same "no fabricated data" rule as
 * `src/lib/seo/json-ld.tsx`) and costs nothing if it's ever picked up.
 * This is not a substitute for `robots.ts`/`sitemap.ts`, which remain the
 * actual, effective mechanisms — this file only ever lists routes that
 * exist, kept in sync by hand alongside `src/app/sitemap.ts`.
 */
const SITE_URL = "https://www.socialtrace.co";

const LINES = [
  "# SocialTrace",
  "",
  "> Free tools to view public Instagram/TikTok/Facebook profiles and to transcribe public YouTube/TikTok/Instagram/Facebook/X (Twitter) videos to text. Public data only — no login, no private-account access.",
  "",
  "## Product",
  `- [Home](${SITE_URL}/): Search a public Instagram, TikTok, or Facebook profile.`,
  `- [Video transcriber](${SITE_URL}/transcribe): Paste a public video link, get a text transcript.`,
  `- [Tools index](${SITE_URL}/tools): Every anonymous-viewer and transcriber tool this site offers.`,
  "",
  "## Transcriber, by platform",
  `- [YouTube transcript generator](${SITE_URL}/transcribe/youtube-transcript-generator)`,
  `- [TikTok video to text](${SITE_URL}/transcribe/tiktok-video-to-text)`,
  `- [Instagram Reel to text](${SITE_URL}/transcribe/instagram-reel-to-text)`,
  `- [Facebook video to text](${SITE_URL}/transcribe/facebook-video-to-text)`,
  "",
  "## Anonymous viewer tools",
  `- [Anonymous Instagram viewer](${SITE_URL}/tools/anonymous-instagram-viewer)`,
  `- [Anonymous TikTok viewer](${SITE_URL}/tools/anonymous-tiktok-viewer)`,
  `- [Anonymous Facebook viewer](${SITE_URL}/tools/anonymous-facebook-viewer)`,
  `- [Instagram story viewer](${SITE_URL}/tools/instagram-story-viewer)`,
  `- [Instagram follower history](${SITE_URL}/tools/instagram-follower-history)`,
  `- [Instagram follower compare](${SITE_URL}/tools/instagram-follower-compare)`,
  `- [Instagram growth tracker](${SITE_URL}/tools/instagram-growth-tracker)`,
  "",
  "## Reference",
  `- [How coverage and data collection work](${SITE_URL}/data-methodology)`,
  `- [FAQ](${SITE_URL}/faq)`,
  `- [Help center](${SITE_URL}/help)`,
  "",
].join("\n");

export async function GET() {
  return new NextResponse(LINES, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
}
