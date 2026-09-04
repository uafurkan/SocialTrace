import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How SocialTrace handles data.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold text-primary">Privacy</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-secondary">
        <p>
          SocialTrace organizes publicly accessible social profile data. This build is a product
          scaffold using generated sample data — no real profile, follower or following data is
          collected, stored, or displayed by the current deployment.
        </p>
        <p>
          When SocialTrace is connected to a real data source, this page will describe exactly what
          public data is retained, how long it is kept, how coverage and freshness are determined,
          and how a person can request removal of data that pertains to their own public account.
        </p>
        <p>
          SocialTrace does not attempt to access private accounts, bypass authentication, or collect
          data that is not publicly accessible.
        </p>
      </div>
    </div>
  );
}
