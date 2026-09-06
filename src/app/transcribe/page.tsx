import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { TranscriberWidget } from "@/components/transcriber/transcriber-widget";
import { copy } from "@/lib/copy";

const PATH = "/transcribe";

export const metadata: Metadata = pageMetadata({ title: copy.transcriber.hubTitle, description: copy.transcriber.hubLead, path: PATH });

const FAQ = [
  {
    question: "Which platforms are supported?",
    answer: "YouTube, TikTok, Instagram, and Facebook video links. Paste any public video URL from these four platforms.",
  },
  {
    question: "Is it free?",
    answer: "Yes — a limited number of transcriptions per day, no sign-up required. Creating a free account raises the daily limit.",
  },
  {
    question: "How accurate is it?",
    answer:
      "For YouTube videos with existing captions, the transcript comes directly from those captions. Otherwise, speech-to-text (90+ languages) is used, which is generally accurate for clear audio but can struggle with heavy background noise, overlapping speakers, or strong accents.",
  },
  {
    question: "Does this work on private accounts or videos?",
    answer: "No — only public videos can be transcribed, the same public-data-only rule as the rest of SocialTrace.",
  },
];

export default function TranscribePage() {
  return (
    <>
      <JsonLd id="ld-transcribe-breadcrumb" data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Transcribe", path: PATH }])} />
      <JsonLd id="ld-transcribe-faq" data={faqJsonLd(FAQ)} />
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-semibold text-primary sm:text-4xl">{copy.transcriber.hubTitle}</h1>
        <p className="mt-4 max-w-2xl text-lg text-secondary">{copy.transcriber.hubLead}</p>

        <div className="mt-8">
          <TranscriberWidget autoSubmitFromQueryParam />
        </div>

        <section className="mt-16">
          <h2 className="text-xl font-semibold text-primary">How it works</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-6 text-secondary">
            <li>Paste a public YouTube, TikTok, Instagram, or Facebook video link above.</li>
            <li>Wait a few seconds while the video is fetched and transcribed.</li>
            <li>Copy the transcript, or read it alongside timestamps where available.</li>
          </ol>
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-semibold text-primary">Limitations</h2>
          <ul className="mt-4 list-disc space-y-2 pl-6 text-secondary">
            <li>Only public videos can be transcribed — private or restricted content is not supported.</li>
            <li>Videos longer than 30 minutes aren&apos;t supported yet.</li>
            <li>A daily limit applies per visitor to keep this free for everyone; signing up for a free account raises it.</li>
          </ul>
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-semibold text-primary">FAQ</h2>
          <dl className="mt-4 space-y-6">
            {FAQ.map((entry) => (
              <div key={entry.question}>
                <dt className="font-semibold text-primary">{entry.question}</dt>
                <dd className="mt-2 text-secondary">{entry.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-semibold text-primary">By platform</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Link href="/transcribe/youtube-transcript-generator" className="rounded-card border border-border p-4 transition hover:border-primary/40">
              <span className="font-semibold text-primary">YouTube transcript generator</span>
            </Link>
            <Link href="/transcribe/tiktok-video-to-text" className="rounded-card border border-border p-4 transition hover:border-primary/40">
              <span className="font-semibold text-primary">TikTok video to text</span>
            </Link>
            <Link href="/transcribe/instagram-reel-to-text" className="rounded-card border border-border p-4 transition hover:border-primary/40">
              <span className="font-semibold text-primary">Instagram Reel to text</span>
            </Link>
            <Link href="/transcribe/facebook-video-to-text" className="rounded-card border border-border p-4 transition hover:border-primary/40">
              <span className="font-semibold text-primary">Facebook video to text</span>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
