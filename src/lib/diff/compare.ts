import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";

import { getDb, schema } from "@/lib/db";
import { normalizeUsername } from "@/lib/snapshot/capture";

/**
 * Spec §23 Follower Comparison, count-only. Pick two snapshots of a profile
 * (not necessarily consecutive) and see how the profile's own counts moved
 * between them, plus the profile-field changes captured in that window.
 *
 * No member identities are read or returned. Snapshot capture stores no
 * follower or following accounts (src/lib/snapshot/capture.ts), so there is
 * no who-joined or who-left list to compare, and the memberships table is
 * never consulted.
 */

export type ComparisonKind = "follower" | "following";

type SnapshotRow = Pick<
  typeof schema.profileSnapshots.$inferSelect,
  "id" | "capturedAt" | "followerCount" | "followingCount" | "postCount"
>;

export interface ComparisonSnapshot {
  id: string;
  capturedAt: string;
  followerCount: number;
  followingCount: number;
  postCount: number;
}

export interface ProfileFieldChange {
  field: string;
  oldValue: string | null;
  newValue: string | null;
  detectedAt: string;
}

export interface FollowerComparisonResult {
  kind: ComparisonKind;
  /** The older of the two snapshots, regardless of which the caller labeled "from". */
  from: ComparisonSnapshot;
  /** The newer of the two snapshots. */
  to: ComparisonSnapshot;
  /** Change in the requested dataset's count from `from` to `to`; negative when it fell. */
  countChange: number;
  /** Profile-field changes captured after `from`, up to and including `to`, oldest first. */
  fieldChanges: ProfileFieldChange[];
}

function countOf(snapshot: Pick<SnapshotRow, "followerCount" | "followingCount">, kind: ComparisonKind): number {
  return kind === "follower" ? snapshot.followerCount : snapshot.followingCount;
}

/** Copies only the count fields, so nothing else on the stored row reaches a response. */
function toComparisonSnapshot(row: SnapshotRow): ComparisonSnapshot {
  return {
    id: row.id,
    capturedAt: row.capturedAt.toISOString(),
    followerCount: row.followerCount,
    followingCount: row.followingCount,
    postCount: row.postCount,
  };
}

/**
 * Ids of the snapshots captured after `older` and no later than `newer`. A
 * profile-field change is written at the capture that observed it, so these
 * are the captures whose changes fall between the two snapshots.
 */
export function snapshotIdsInWindow(
  snapshots: ReadonlyArray<Pick<SnapshotRow, "id" | "capturedAt">>,
  older: Date,
  newer: Date,
): string[] {
  return snapshots
    .filter((row) => row.capturedAt.getTime() > older.getTime() && row.capturedAt.getTime() <= newer.getTime())
    .map((row) => row.id);
}

/** Pure: builds the count-only comparison from two snapshot rows already ordered older -> newer. */
export function buildFollowerComparison(
  kind: ComparisonKind,
  older: SnapshotRow,
  newer: SnapshotRow,
  fieldChanges: ProfileFieldChange[],
): FollowerComparisonResult {
  return {
    kind,
    from: toComparisonSnapshot(older),
    to: toComparisonSnapshot(newer),
    countChange: countOf(newer, kind) - countOf(older, kind),
    fieldChanges,
  };
}

export async function compareSnapshots(
  username: string,
  kind: ComparisonKind,
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
    .select({
      id: schema.profileSnapshots.id,
      capturedAt: schema.profileSnapshots.capturedAt,
      followerCount: schema.profileSnapshots.followerCount,
      followingCount: schema.profileSnapshots.followingCount,
      postCount: schema.profileSnapshots.postCount,
    })
    .from(schema.profileSnapshots)
    .where(eq(schema.profileSnapshots.profileId, profileRow.id));
  const byId = new Map(snapshotRows.map((row) => [row.id, row]));
  const fromRow = byId.get(fromSnapshotId);
  const toRow = byId.get(toSnapshotId);
  if (!fromRow || !toRow) return null;

  // Always compare older -> newer regardless of which the caller labeled from/to.
  const [olderRow, newerRow] = fromRow.capturedAt.getTime() <= toRow.capturedAt.getTime() ? [fromRow, toRow] : [toRow, fromRow];

  const windowIds = snapshotIdsInWindow(snapshotRows, olderRow.capturedAt, newerRow.capturedAt);
  const fieldRows =
    windowIds.length === 0
      ? []
      : await db
          .select({
            field: schema.changeEvents.field,
            oldValue: schema.changeEvents.oldValue,
            newValue: schema.changeEvents.newValue,
            detectedAt: schema.changeEvents.detectedAt,
          })
          .from(schema.changeEvents)
          .where(
            and(
              eq(schema.changeEvents.profileId, profileRow.id),
              isNotNull(schema.changeEvents.field),
              inArray(schema.changeEvents.toSnapshotId, windowIds),
            ),
          )
          .orderBy(asc(schema.changeEvents.detectedAt));

  const fieldChanges = fieldRows.flatMap((row): ProfileFieldChange[] =>
    row.field === null
      ? []
      : [{ field: row.field, oldValue: row.oldValue, newValue: row.newValue, detectedAt: row.detectedAt.toISOString() }],
  );

  return buildFollowerComparison(kind, olderRow, newerRow, fieldChanges);
}
