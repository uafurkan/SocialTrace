import type { Metadata } from "next";
import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { copy } from "@/lib/copy";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: copy.auth.loginTitle,
  description: copy.auth.loginSubtitle,
  path: "/login",
  noIndex: true,
});

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold text-primary">{copy.auth.loginTitle}</h1>
      <p className="mt-2 text-sm text-secondary">{copy.auth.loginSubtitle}</p>
      <div className="mt-8">
        <AuthForm mode="login" />
      </div>
      <p className="mt-6 text-sm text-secondary">
        {copy.auth.noAccountPrompt}{" "}
        <Link href="/signup" className="text-brand hover:underline">
          {copy.auth.signupCta}
        </Link>
      </p>
    </div>
  );
}
