import type { Metadata } from "next";

import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Terms",
  description: "Terms of use for SocialTrace.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold text-primary">Terms</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-secondary">
        <p>
          SocialTrace is a public social intelligence product for exploring publicly accessible
          profile data. This build is a pre-launch scaffold; the data shown is generated sample
          data, not real profile data, and the service is provided for evaluation purposes only.
        </p>
        <p>
          Use of SocialTrace to access private accounts, bypass platform access controls, or
          impersonate another person is prohibited.
        </p>
        <p>
          A complete terms of service, reflecting the live data sources and account features once
          available, will replace this page before public launch.
        </p>
      </div>
    </div>
  );
}
