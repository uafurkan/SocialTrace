import { describe, expect, it } from "vitest";

import { MAX_ITEMS, TTL_MS, clearEntries, migrateV1, readEntries, writeEntry, type StorageLike } from "./input-history";

const KEY = "profile-search-instagram";
const V1_KEY = "socialtrace:input-history:profile-search-instagram";
const V2_KEY = "socialtrace:input-history:v2:profile-search-instagram";
const NOW = Date.parse("2026-10-10T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

class MemoryStorage implements StorageLike {
  readonly data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}

/** Reads and reports writes, but every write fails, as with a full quota. */
class WriteFailingStorage extends MemoryStorage {
  override setItem(): void {
    throw new Error("QuotaExceededError");
  }
}

/** Every call throws, as with blocked site data. */
const blockedStorage: StorageLike = {
  getItem() {
    throw new Error("SecurityError");
  },
  setItem() {
    throw new Error("SecurityError");
  },
  removeItem() {
    throw new Error("SecurityError");
  },
};

function storedV2(storage: MemoryStorage): unknown {
  return JSON.parse(storage.data.get(V2_KEY) ?? "null");
}

describe("readEntries and TTL", () => {
  it("drops entries older than TTL_MS and writes the pruned list back", () => {
    const storage = new MemoryStorage();
    storage.data.set(
      V2_KEY,
      JSON.stringify([
        { value: "kept-edge", savedAt: NOW - TTL_MS + 1 },
        { value: "expired-edge", savedAt: NOW - TTL_MS },
        { value: "old", savedAt: NOW - TTL_MS - DAY },
      ]),
    );

    expect(readEntries(storage, KEY, NOW)).toEqual(["kept-edge"]);
    expect(storedV2(storage)).toEqual([{ value: "kept-edge", savedAt: NOW - TTL_MS + 1 }]);
  });

  it("returns an empty list when nothing is stored", () => {
    expect(readEntries(new MemoryStorage(), KEY, NOW)).toEqual([]);
  });
});

describe("writeEntry dedupe", () => {
  it("keeps the newest casing of a case-insensitive duplicate", () => {
    const storage = new MemoryStorage();

    writeEntry(storage, KEY, "Nike", NOW);
    expect(writeEntry(storage, KEY, "nike", NOW + 1)).toEqual(["nike"]);
    expect(writeEntry(storage, KEY, "NIKE", NOW + 2)).toEqual(["NIKE"]);
  });

  it("moves a repeated value to the front and trims whitespace", () => {
    const storage = new MemoryStorage();

    writeEntry(storage, KEY, "alpha", NOW);
    writeEntry(storage, KEY, "beta", NOW + 1);
    expect(writeEntry(storage, KEY, "  ALPHA  ", NOW + 2)).toEqual(["ALPHA", "beta"]);
  });

  it("ignores blank input and writes nothing", () => {
    const storage = new MemoryStorage();

    expect(writeEntry(storage, KEY, "   ", NOW)).toEqual([]);
    expect(storage.data.has(V2_KEY)).toBe(false);
  });
});

describe("MAX_ITEMS cap", () => {
  it("keeps only the newest MAX_ITEMS values", () => {
    const storage = new MemoryStorage();
    for (let i = 0; i < 10; i += 1) {
      writeEntry(storage, KEY, `user${i}`, NOW + i);
    }

    const expected = ["user9", "user8", "user7", "user6", "user5", "user4", "user3", "user2"];
    expect(MAX_ITEMS).toBe(8);
    expect(readEntries(storage, KEY, NOW + 10)).toEqual(expected);
    expect(storedV2(storage)).toHaveLength(MAX_ITEMS);
  });
});

describe("migrateV1", () => {
  it("converts the v1 array once and removes the v1 key", () => {
    const storage = new MemoryStorage();
    storage.data.set(V1_KEY, JSON.stringify(["newer", "older"]));

    expect(readEntries(storage, KEY, NOW)).toEqual(["newer", "older"]);
    expect(storage.data.has(V1_KEY)).toBe(false);
    expect(storedV2(storage)).toEqual([
      { value: "newer", savedAt: NOW },
      { value: "older", savedAt: NOW },
    ]);
  });

  it("does not run again once the v2 key exists", () => {
    const storage = new MemoryStorage();
    storage.data.set(V1_KEY, JSON.stringify(["first"]));
    expect(migrateV1(storage, KEY, NOW)).not.toBeNull();

    // A stale legacy write from an older tab must not overwrite v2.
    storage.data.set(V1_KEY, JSON.stringify(["stale"]));
    expect(migrateV1(storage, KEY, NOW + 1)).toBeNull();
    expect(readEntries(storage, KEY, NOW + 1)).toEqual(["first"]);
    expect(storage.data.get(V1_KEY)).toBe(JSON.stringify(["stale"]));
  });

  it("keeps the v1 key and still returns the values when the v2 write fails", () => {
    const storage = new WriteFailingStorage();
    storage.data.set(V1_KEY, JSON.stringify(["legacy"]));

    expect(migrateV1(storage, KEY, NOW)).toEqual([{ value: "legacy", savedAt: NOW }]);
    expect(storage.data.get(V1_KEY)).toBe(JSON.stringify(["legacy"]));
    expect(readEntries(storage, KEY, NOW)).toEqual(["legacy"]);
  });
});

describe("clearEntries", () => {
  it("removes the v2 key and returns an empty history", () => {
    const storage = new MemoryStorage();
    writeEntry(storage, KEY, "nike", NOW);
    expect(storage.data.has(V2_KEY)).toBe(true);

    clearEntries(storage, KEY);

    expect(storage.data.has(V2_KEY)).toBe(false);
    expect(readEntries(storage, KEY, NOW)).toEqual([]);
  });

  it("removes a leftover v1 key so it does not migrate back", () => {
    const storage = new MemoryStorage();
    storage.data.set(V1_KEY, JSON.stringify(["legacy"]));

    clearEntries(storage, KEY);

    expect(storage.data.has(V1_KEY)).toBe(false);
    expect(readEntries(storage, KEY, NOW)).toEqual([]);
  });
});

describe("corrupt or unexpected data", () => {
  it("returns an empty list for invalid JSON, without throwing", () => {
    const storage = new MemoryStorage();
    storage.data.set(V2_KEY, "{not json");

    expect(readEntries(storage, KEY, NOW)).toEqual([]);
    expect(writeEntry(storage, KEY, "fresh", NOW)).toEqual(["fresh"]);
  });

  it("treats a corrupt v1 value as empty and removes it", () => {
    const storage = new MemoryStorage();
    storage.data.set(V1_KEY, "[oops");

    expect(readEntries(storage, KEY, NOW)).toEqual([]);
    expect(storage.data.has(V1_KEY)).toBe(false);
  });

  it("skips non-string values and malformed entries", () => {
    const storage = new MemoryStorage();
    storage.data.set(
      V2_KEY,
      JSON.stringify([
        { value: 5, savedAt: NOW },
        { value: "ok", savedAt: NOW },
        null,
        "plain string",
        { value: "no-time", savedAt: "yesterday" },
      ]),
    );

    expect(readEntries(storage, KEY, NOW)).toEqual(["ok"]);
  });

  it("returns an empty list when the stored JSON is not an array", () => {
    const storage = new MemoryStorage();
    storage.data.set(V2_KEY, JSON.stringify({ value: "x", savedAt: NOW }));

    expect(readEntries(storage, KEY, NOW)).toEqual([]);
  });

  it("does not throw when storage itself is blocked", () => {
    expect(readEntries(blockedStorage, KEY, NOW)).toEqual([]);
    expect(writeEntry(blockedStorage, KEY, "nike", NOW)).toEqual([]);
    expect(() => clearEntries(blockedStorage, KEY)).not.toThrow();
  });
});
