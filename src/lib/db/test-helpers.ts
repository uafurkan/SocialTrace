import { inArray } from "drizzle-orm";

import { getDb, schema } from "@/lib/db";
import { normalizeUsername } from "@/lib/snapshot/capture";

/**
 * Shared cleanup/naming helpers for *.integration.test.ts files (see
 * docs/TESTING.md). Deleting a `profiles` row cascades (onDelete:
 * "cascade") to memberships, profile_snapshots, watchlist_entries,
 * saved_searches, and change_events — so tests only need to track the
 * usernames they created, not every row they touched.
 */
export function uniqueUsername(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}@test.socialtrace.invalid`;
}

export async function deleteTestProfiles(usernames: string[]): Promise<void> {
  if (usernames.length === 0) return;
  const db = getDb();
  await db.delete(schema.profiles).where(inArray(schema.profiles.normalizedUsername, usernames.map(normalizeUsername)));
}

export async function deleteTestUsers(emails: string[]): Promise<void> {
  if (emails.length === 0) return;
  const db = getDb();
  await db.delete(schema.users).where(inArray(schema.users.normalizedEmail, emails.map((e) => e.trim().toLowerCase())));
}
