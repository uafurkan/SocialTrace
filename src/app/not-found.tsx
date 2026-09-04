import Link from "next/link";

import { ProfileSearchForm } from "@/components/home/profile-search-form";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center sm:px-6">
      <h1 className="text-2xl font-semibold text-primary">Profile or page not found</h1>
      <p className="mt-2 text-secondary">
        We couldn&apos;t find what you were looking for. Try searching for a public profile instead.
      </p>
      <div className="mt-6 w-full">
        <ProfileSearchForm />
      </div>
      <Button asChild variant="tertiary" className="mt-4">
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}
