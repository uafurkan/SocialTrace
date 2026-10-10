import { and, desc, eq, isNotNull } from "drizzle-orm";

import type { ChangeEvent } from "@/lib/domain/types";
import { getDb, schema } from "@/lib/db";

/**
 * Reads the profile-field change_events written by captureSnapshot
 * (src/lib/snapshot/capture.ts) for a profile. This module only reads; the
 * diffing itself happens at capture time, once, against the previous
 * snapshot, rather than being recomputed on every page view.
 *
 * Only profile-field changes are returned. Capture no longer records
 * follower identities, so membership rows (who was added or removed) left by
 * earlier captures are never read or returned.
 */

export interface FieldChangeRow {
  id: string;
  detectedAt: Date;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
}

/** Pure: a profile-field change as a ChangeEvent. Returns null for a row that has no field, i.e. a membership row. */
export function toFieldChangeEvent(row: FieldChangeRow): ChangeEvent | null {
  if (row.field === null) return null;
  return {
    id: row.id,
    detectedAt: row.detectedAt.toISOString(),
    membershipEvent: null,
    membershipKind: null,
    user: null,
    field: row.field,
    oldValue: row.oldValue,
    newValue: row.newValue,
  };
}

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
      field: schema.changeEvents.field,
      oldValue: schema.changeEvents.oldValue,
      newValue: schema.changeEvents.newValue,
    })
    .from(schema.changeEvents)
    .where(and(eq(schema.changeEvents.profileId, profileRow.id), isNotNull(schema.changeEvents.field)))
    .orderBy(desc(schema.changeEvents.detectedAt))
    .limit(limit);

  return rows.flatMap((row) => {
    const change = toFieldChangeEvent(row);
    return change ? [change] : [];
  });
}
