import { and, eq, gt, isNull, lte, or } from "drizzle-orm";

import type { SocialUser } from "@/lib/domain/types";
import { getDb, schema } from "@/lib/db";
import { DIFF_COVERAGE_THRESHOLD, normalizeUsername } from "@/lib/snapshot/capture";

/**
 * Spec §23 Follower Comparison — pick two (not necessarily consecutive)
 * snapshots and see who was gained/lost between them. Unlike
 * docs/DIFF.md's automatic diff (previous snapshot -> latest, computed
 * once at capture time), this reconstructs membership state as of an
 * arbitrary past moment from the memberships table's
 * first_seen_at/last_seen_at/removed_at columns, rather than needing a
 * separate per-snapshot membership log: a social_user counts as "active
 * as of time T" if first_seen_at <= T and (removed_at is null or
 * removed_at > T). That's sound precisely because removed_at is only
 * ever set by the coverage-gated logic in capture.ts — it's never set
 * for a low-coverage profile, so this reconstruction naturally can't
 * over-claim removal for one either.
 */
export interface FollowerComparisonSnapshot {
  id: string;
  capturedAt: string;
  coveragePercent: number;
}

export interface FollowerComparisonResult {
  available: boolean;
  reason: string | null;
  from: FollowerComparisonSnapshot;
  to: FollowerComparisonSnapshot;
  newMembers: SocialUser[];
  removedMembers: SocialUser[];
  netChange: number;
}

async function activeMembersAsOf(
  db: ReturnType<typeof getDb>,
  profileId: string,
  kind: "follower" | "following",
  asOf: Date,
): Promise<Map<string, SocialUser>> {
  const rows = await db
    .select({
      id: schema.socialUsers.id,
      username: schema.socialUsers.username,
      displayName: schema.socialUsers.displayName,
      avatarUrl: schema.socialUsers.avatarUrl,
      isVerified: schema.socialUsers.isVerified,
    })
    .from(schema.memberships)
    .innerJoin(schema.socialUsers, eq(schema.memberships.socialUserId, schema.socialUsers.id))
    .where(
      and(
        eq(schema.memberships.profileId, profileId),
        eq(schema.memberships.kind, kind),
        lte(schema.memberships.firstSeenAt, asOf),
        or(isNull(schema.memberships.removedAt), gt(schema.memberships.removedAt, asOf)),
      ),
    );
  return new Map(
    rows.map((row) => [
      row.id,
      { id: row.id, platform: "instagram" as const, username: row.username, displayName: row.displayName, avatarUrl: row.avatarUrl, isVerified: row.isVerified },
    ]),
  );
}

function coverageOf(snapshot: typeof schema.profileSnapshots.$inferSelect, kind: "follower" | "following"): number {
  return Number(kind === "follower" ? snapshot.followerCoveragePercent : snapshot.followingCoveragePercent);
}

export interface CoverageGateResult {
  available: boolean;
  reason: string | null;
}

/** Pure spec §20 gate: both sides of a comparison must clear the coverage threshold. */
export function evaluateCoverageGate(
  kind: "follower" | "following",
  fromCoveragePercent: number,
  toCoveragePercent: number,
): CoverageGateResult {
  if (fromCoveragePercent < DIFF_COVERAGE_THRESHOLD || toCoveragePercent < DIFF_COVERAGE_THRESHOLD) {
    return {
      available: false,
      reason: `Comparison unavailable: both snapshots need at least ${DIFF_COVERAGE_THRESHOLD}% ${kind} coverage to reliably tell who was gained or lost (spec §20's rule against inferring removal from a partial capture).`,
    };
  }
  return { available: true, reason: null };
}

export interface MembershipDiff {
  newMembers: SocialUser[];
  removedMembers: SocialUser[];
  netChange: number;
}

/** Pure reconciliation: who's in `newer` but not `older`, and vice versa. */
export function diffActiveMembers(
  olderActive: Map<string, SocialUser>,
  newerActive: Map<string, SocialUser>,
): MembershipDiff {
  const newMembers = [...newerActive.values()].filter((user) => !olderActive.has(user.id));
  const removedMembers = [...olderActive.values()].filter((user) => !newerActive.has(user.id));
  return { newMembers, removedMembers, netChange: newMembers.length - removedMembers.length };
}

export async function compareSnapshots(
  username: string,
  kind: "follower" | "following",
  fromSnapshotId: string,
  toSnapshotId: string,
): Promise<FollowerComparisonResult | null> {
  const db = getDb();
  const normalizedUsername = normalizeUsername(username);

  const [profileRow] = await db
    .select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(and(eq(schema.profiles.platform, "instagram"), eq(schema.profiles.normalizedUsername, normalizedUsername)))
    .limit(1);
  if (!profileRow) return null;

  const snapshotRows = await db
    .select()
    .from(schema.profileSnapshots)
    .where(eq(schema.profileSnapshots.profileId, profileRow.id));
  const byId = new Map(snapshotRows.map((row) => [row.id, row]));
  const fromRow = byId.get(fromSnapshotId);
  const toRow = byId.get(toSnapshotId);
  if (!fromRow || !toRow) return null;

  // Always compare older -> newer regardless of which the caller labeled from/to.
  const [olderRow, newerRow] = fromRow.capturedAt <= toRow.capturedAt ? [fromRow, toRow] : [toRow, fromRow];

  const from: FollowerComparisonSnapshot = {
    id: olderRow.id,
    capturedAt: olderRow.capturedAt.toISOString(),
    coveragePercent: coverageOf(olderRow, kind),
  };
  const to: FollowerComparisonSnapshot = {
    id: newerRow.id,
    capturedAt: newerRow.capturedAt.toISOString(),
    coveragePercent: coverageOf(newerRow, kind),
  };

  const gate = evaluateCoverageGate(kind, from.coveragePercent, to.coveragePercent);
  if (!gate.available) {
    return { ...gate, from, to, newMembers: [], removedMembers: [], netChange: 0 };
  }

  const [olderActive, newerActive] = await Promise.all([
    activeMembersAsOf(db, profileRow.id, kind, olderRow.capturedAt),
    activeMembersAsOf(db, profileRow.id, kind, newerRow.capturedAt),
  ]);

  return { available: true, reason: null, from, to, ...diffActiveMembers(olderActive, newerActive) };
}
