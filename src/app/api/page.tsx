import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API",
  description: "SocialTrace public data API.",
};

export default function ApiLandingPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold text-primary">API</h1>
      <p className="mt-4 text-secondary">
        A public API for profile, follower and following data is planned but not available in this
        build. When available, it will be documented under <code className="font-mono">/api/v1</code>{" "}
        with cursor pagination, schema validation and API-key authentication.
      </p>
    </div>
  );
}
