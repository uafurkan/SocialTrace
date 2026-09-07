import { formatCount } from "@/lib/utils";

interface Stat {
  label: string;
  value: number;
}

/**
 * The Followers/Following/Posts row used by every profile header
 * (Instagram's ProfileHeader and TikTok/Facebook's PlatformProfileHeader
 * both had their own copy of this markup, drifting slightly in spacing —
 * pulled into one place so every platform's profile page looks and
 * behaves identically here). Divider lines between stats (instead of bare
 * gaps) make the row read as one grouped unit rather than three loose
 * numbers floating next to the bio.
 */
export function ProfileStatRow({ stats }: { stats: Stat[] }) {
  return (
    <dl className="mt-4 flex divide-x divide-border text-sm">
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-col gap-0.5 pr-4 first:pl-0 [&:not(:first-child)]:pl-4">
          <dd className="font-semibold text-primary">{formatCount(stat.value)}</dd>
          <dt className="text-muted">{stat.label}</dt>
        </div>
      ))}
    </dl>
  );
}
