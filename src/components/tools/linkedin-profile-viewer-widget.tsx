"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Building2, GraduationCap, Lock, Users } from "lucide-react";

import type { LinkedInProfile } from "@/lib/linkedin/types";
import { proxiedMediaUrl } from "@/lib/media-proxy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LinkedInProfileViewerWidget() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<LinkedInProfile | null>(null);
  const [postsRequireSignIn, setPostsRequireSignIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!url.trim()) {
      setError("Paste a LinkedIn profile link or username.");
      setProfile(null);
      return;
    }

    setLoading(true);
    setError(null);
    setProfile(null);
    setPostsRequireSignIn(false);
    try {
      const res = await fetch("/api/v1/linkedin-viewer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong looking up this profile.");
        return;
      }
      setProfile(data.profile as LinkedInProfile);
      setPostsRequireSignIn(Boolean(data.postsRequireSignIn));
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-col gap-2 rounded-card border border-border bg-surface p-2 shadow-default sm:flex-row sm:items-center"
      >
        <Input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="linkedin.com/in/username"
          aria-label="LinkedIn profile link or username"
          autoComplete="off"
          className="flex-1"
        />
        <Button type="submit" loading={loading} className="sm:w-auto">
          View profile
        </Button>
      </form>
      <p className="mt-2 text-xs text-muted">
        A first-time lookup can take up to a minute or so — LinkedIn data has no fast/free path and is fetched fresh via Bright Data on a cache miss. A repeat lookup is instant.
      </p>

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      {profile ? (
        <div className="mt-6 rounded-card border border-border bg-surface">
          {profile.bannerUrl ? (
            <div className="relative h-28 w-full overflow-hidden rounded-t-card bg-surface-subtle sm:h-36">
              <Image src={proxiedMediaUrl(profile.bannerUrl)} alt="" fill unoptimized className="object-cover" />
            </div>
          ) : null}
          <div className="p-5">
            <div className="flex items-start gap-4">
              {profile.avatarUrl ? (
                <Image
                  src={proxiedMediaUrl(profile.avatarUrl)}
                  alt={profile.name}
                  width={72}
                  height={72}
                  unoptimized
                  className="size-18 shrink-0 rounded-full border-2 border-surface object-cover"
                />
              ) : (
                <div className="flex size-18 shrink-0 items-center justify-center rounded-full bg-surface-subtle text-lg font-semibold text-secondary">
                  {profile.firstName?.[0] ?? profile.name?.[0] ?? "?"}
                </div>
              )}
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold text-primary">{profile.name}</h3>
                {profile.headline ? <p className="mt-0.5 text-sm text-secondary">{profile.headline}</p> : null}
                {profile.location ? <p className="mt-0.5 text-xs text-muted">{profile.location}</p> : null}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-secondary">
                <Users className="size-4 text-muted" aria-hidden="true" />
                <span className="font-semibold text-primary">{profile.followers.toLocaleString()}</span> followers
              </div>
              {profile.connections > 0 ? (
                <div className="text-secondary">
                  <span className="font-semibold text-primary">{profile.connections}</span> connections
                </div>
              ) : null}
              {profile.isInfluencer ? (
                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand-strong">
                  Top Voice
                </span>
              ) : null}
            </div>

            {profile.about ? <p className="mt-4 whitespace-pre-line text-sm text-secondary">{profile.about}</p> : null}

            {profile.currentCompanyName ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-secondary">
                <Building2 className="size-4 shrink-0 text-muted" aria-hidden="true" />
                <span>
                  {profile.currentCompanyTitle ? `${profile.currentCompanyTitle} at ` : ""}
                  <span className="font-medium text-primary">{profile.currentCompanyName}</span>
                </span>
              </div>
            ) : null}

            {profile.experience.length > 0 ? (
              <div className="mt-5">
                <h4 className="text-sm font-semibold text-primary">Experience</h4>
                <ul className="mt-2 space-y-2">
                  {profile.experience.slice(0, 5).map((role, index) => (
                    <li key={index} className="text-sm text-secondary">
                      <span className="font-medium text-primary">{role.title}</span>
                      {role.company ? ` — ${role.company}` : ""}
                      {role.startDate ? (
                        <span className="text-muted">
                          {" "}
                          ({role.startDate}
                          {role.endDate ? ` – ${role.endDate}` : ""})
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {profile.education.length > 0 ? (
              <div className="mt-5">
                <h4 className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                  <GraduationCap className="size-4 text-muted" aria-hidden="true" />
                  Education
                </h4>
                <ul className="mt-2 space-y-1">
                  {profile.education.slice(0, 5).map((school, index) => (
                    <li key={index} className="text-sm text-secondary">
                      {school.title}
                      {school.startYear ? (
                        <span className="text-muted">
                          {" "}
                          ({school.startYear}
                          {school.endYear ? ` – ${school.endYear}` : ""})
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {profile.posts.length > 0 ? (
              <div className="mt-5">
                <h4 className="text-sm font-semibold text-primary">Recent activity</h4>
                <ul className="mt-2 space-y-2">
                  {profile.posts.slice(0, 3).map((post) => (
                    <li key={post.id || post.link} className="text-sm">
                      <a
                        href={post.link}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="text-brand-strong hover:underline"
                      >
                        {post.title || post.link}
                      </a>
                      {post.interaction ? <span className="ml-2 text-xs text-muted">{post.interaction}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : postsRequireSignIn ? (
              <div className="mt-5 flex items-center justify-between gap-3 rounded-button border border-dashed border-border bg-surface-subtle px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-secondary">
                  <Lock className="size-4 shrink-0 text-muted" aria-hidden="true" />
                  <span>Sign in to see this profile&apos;s recent posts.</span>
                </div>
                <Link href="/login" className="shrink-0 text-sm font-medium text-brand-strong hover:underline">
                  Sign in
                </Link>
              </div>
            ) : null}

            <p className="mt-5 text-xs text-muted">
              Source:{" "}
              <a href={profile.profileUrl} target="_blank" rel="noopener noreferrer nofollow" className="hover:underline">
                {profile.profileUrl}
              </a>
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
