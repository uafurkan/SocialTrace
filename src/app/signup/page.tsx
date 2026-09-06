import type { Metadata } from "next";
import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { copy } from "@/lib/copy";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: copy.auth.signupTitle,
  description: copy.auth.signupSubtitle,
  path: "/signup",
  noIndex: true,
});

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold text-primary">{copy.auth.signupTitle}</h1>
      <p className="mt-2 text-sm text-secondary">{copy.auth.signupSubtitle}</p>
      <div className="mt-8">
        <AuthForm mode="signup" />
      </div>
      <p className="mt-6 text-sm text-secondary">
        {copy.auth.hasAccountPrompt}{" "}
        <Link href="/login" className="text-brand hover:underline">
          {copy.auth.loginCta}
        </Link>
      </p>
    </div>
  );
}
