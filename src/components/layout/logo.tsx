/**
 * SocialTrace icon mark (spec §9.3): a rounded lens containing a path
 * through two nodes — "lens = observe, path = trace, nodes = change over
 * time". Placeholder mark for this scaffold; a full asset set (§9.4)
 * belongs in a dedicated design pass.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="9" stroke="var(--brand)" strokeWidth="2" />
      <path
        d="M8 20L13.5 13L19 17L24 10"
        stroke="var(--brand)"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="13.5" cy="13" r="2" fill="var(--brand)" />
      <circle cx="19" cy="17" r="2" fill="var(--brand)" />
    </svg>
  );
}
