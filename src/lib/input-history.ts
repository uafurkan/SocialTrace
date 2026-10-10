/**
 * Pure rules for the per-device input history (see `use-input-history.ts`).
 *
 * Works on any Storage-like object, so the rules run under node tests with an
 * in-memory fake. Storage errors are swallowed on every path: a full, blocked
 * or missing store means "no history", never a thrown error in the UI.
 *
 * Layout for each caller key:
 * - v2 (current): `socialtrace:input-history:v2:<key>` holds a JSON array of
 *   `{ value, savedAt }`, newest first. Entries expire after TTL_MS.
 * - v1 (legacy): `socialtrace:input-history:<key>` holds a JSON array of
 *   strings. It is converted once, when the v2 key is absent, then removed.
 */

export const MAX_ITEMS = 8;
export const TTL_MS = 30 * 24 * 60 * 60 * 1000;

const V1_PREFIX = "socialtrace:input-history:";
const V2_PREFIX = "socialtrace:input-history:v2:";

/** The subset of `Storage` used here. `window.localStorage` satisfies it. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface HistoryEntry {
  value: string;
  savedAt: number;
}

const v1Key = (key: string) => `${V1_PREFIX}${key}`;
const v2Key = (key: string) => `${V2_PREFIX}${key}`;

function safeGet(storage: StorageLike, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeRemove(storage: StorageLike, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Unavailable storage: there is nothing to remove.
  }
}

/**
 * Writes the v2 array, then drops the legacy copy. The legacy key is only
 * removed after the write succeeds, so a failed write never loses v1 data.
 */
function persist(storage: StorageLike, key: string, entries: HistoryEntry[]): boolean {
  try {
    storage.setItem(v2Key(key), JSON.stringify(entries));
  } catch {
    return false;
  }
  safeRemove(storage, v1Key(key));
  return true;
}

/**
 * Trims, drops blanks, sorts newest first, keeps the newest casing of each
 * value (case-insensitive match), and caps the list at MAX_ITEMS.
 */
function normalize(entries: HistoryEntry[]): HistoryEntry[] {
  const newestFirst = entries
    .map((entry) => ({ value: entry.value.trim(), savedAt: entry.savedAt }))
    .filter((entry) => entry.value !== "")
    .sort((a, b) => b.savedAt - a.savedAt);

  const seen = new Set<string>();
  const result: HistoryEntry[] = [];
  for (const entry of newestFirst) {
    const folded = entry.value.toLowerCase();
    if (seen.has(folded)) continue;
    seen.add(folded);
    result.push(entry);
    if (result.length === MAX_ITEMS) break;
  }
  return result;
}

/** Parses a v2 value. Anything malformed is skipped; this never throws. */
function parseEntries(raw: string | null): HistoryEntry[] {
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const entries: HistoryEntry[] = [];
  const items: unknown[] = parsed;
  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const { value, savedAt } = item as Record<string, unknown>;
    if (typeof value === "string" && typeof savedAt === "number" && Number.isFinite(savedAt)) {
      entries.push({ value, savedAt });
    }
  }
  return entries;
}

/** Parses a v1 value (an array of strings). Anything else yields no values. */
function parseLegacyValues(raw: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const items: unknown[] = parsed;
  return items.filter((item): item is string => typeof item === "string");
}

/**
 * Converts the v1 array into v2, once. Runs only when the v2 key is absent and
 * the v1 key exists. Returns the converted entries, or null when there was
 * nothing to convert. The entries come back even if the write fails, so the
 * caller can still show them for this session.
 */
export function migrateV1(storage: StorageLike, key: string, now: number): HistoryEntry[] | null {
  if (safeGet(storage, v2Key(key)) !== null) return null;
  const legacy = safeGet(storage, v1Key(key));
  if (legacy === null) return null;

  const entries = normalize(parseLegacyValues(legacy).map((value) => ({ value, savedAt: now })));
  persist(storage, key, entries);
  return entries;
}

/**
 * Current entries, newest first. Runs the migration first, then drops expired
 * entries. If anything expired, the pruned list is written back, so expired
 * inputs don't stay in storage.
 */
function load(storage: StorageLike, key: string, now: number): HistoryEntry[] {
  const migrated = migrateV1(storage, key, now);
  if (migrated !== null) return migrated;

  const stored = normalize(parseEntries(safeGet(storage, v2Key(key))));
  const fresh = stored.filter((entry) => now - entry.savedAt < TTL_MS);
  if (fresh.length !== stored.length) persist(storage, key, fresh);
  return fresh;
}

/** The values for `key`, newest first. Expired entries are dropped. */
export function readEntries(storage: StorageLike, key: string, now: number): string[] {
  return load(storage, key, now).map((entry) => entry.value);
}

/**
 * Records `value` as the newest entry and returns the resulting values. Blank
 * input is ignored. If the write fails, returns what is still stored.
 */
export function writeEntry(storage: StorageLike, key: string, value: string, now: number): string[] {
  const current = load(storage, key, now);
  const trimmed = value.trim();
  if (trimmed === "") return current.map((entry) => entry.value);

  const next = normalize([{ value: trimmed, savedAt: now }, ...current]);
  const result = persist(storage, key, next) ? next : current;
  return result.map((entry) => entry.value);
}

/**
 * Removes the history for `key`. The v1 key is removed too, or a leftover
 * legacy copy would migrate back on the next read.
 */
export function clearEntries(storage: StorageLike, key: string): void {
  safeRemove(storage, v2Key(key));
  safeRemove(storage, v1Key(key));
}
