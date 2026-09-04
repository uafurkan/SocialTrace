import { requireProfile } from "@/lib/server/profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCount } from "@/lib/utils";

export default async function ProfileOverviewPage({ params }: { params: { username: string } }) {
  const profile = await requireProfile(params.username);

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Followers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold text-primary">{formatCount(profile.followerCount)}</p>
          <p className="mt-1 text-xs text-muted">
            {profile.followerCoverage.coveragePercent}% indexed
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Following</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold text-primary">{formatCount(profile.followingCount)}</p>
          <p className="mt-1 text-xs text-muted">
            {profile.followingCoverage.coveragePercent}% indexed
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Posts</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold text-primary">{formatCount(profile.postCount)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
