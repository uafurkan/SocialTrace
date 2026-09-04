import { and, desc, eq } from "drizzle-orm";

import type { ChangeEvent } from "@/lib/domain/types";
import { getDb, schema } from "@/lib/db";

/**
 * Reads the change_events written by captureSnapshot (src/lib/snapshot/capture.ts)
 * for a profile — this module only reads; the diffing itself happens at
 * capture time, once, against the previous snapshot, rather than being
 * recomputed on every page view.
 */
export async function listChanges(username: string, limit = 100): Promise<ChangeEvent[]> {
  const db = getDb();
  const normalizedUsername = username.trim().toLowerCase();

  const [profileRow] = await db
    .select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(and(eq(schema.profiles.platform, "instagram"), eq(schema.profiles.normalizedUsername, normalizedUsername)))
    .limit(1);

  if (!profileRow) return [];

  const rows = await db
    .select({
      id: schema.changeEvents.id,
      detectedAt: schema.changeEvents.detectedAt,
      membershipEvent: schema.changeEvents.membershipEvent,
      membershipKind: schema.changeEvents.membershipKind,
      field: schema.changeEvents.field,
      oldValue: schema.changeEvents.oldValue,
      newValue: schema.changeEvents.newValue,
      userUsername: schema.socialUsers.username,
      userDisplayName: schema.socialUsers.displayName,
      userAvatarUrl: schema.socialUsers.avatarUrl,
      userIsVerified: schema.socialUsers.isVerified,
    })
    .from(schema.changeEvents)
    .leftJoin(schema.socialUsers, eq(schema.changeEvents.socialUserId, schema.socialUsers.id))
    .where(eq(schema.changeEvents.profileId, profileRow.id))
    .orderBy(desc(schema.changeEvents.detectedAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    detectedAt: row.detectedAt.toISOString(),
    membershipEvent: row.membershipEvent,
    membershipKind: row.membershipKind,
    user:
      row.userUsername !== null
        ? {
            username: row.userUsername,
            displayName: row.userDisplayName ?? "",
            avatarUrl: row.userAvatarUrl ?? "",
            isVerified: row.userIsVerified ?? false,
          }
        : null,
    field: row.field,
    oldValue: row.oldValue,
    newValue: row.newValue,
  }));
}
