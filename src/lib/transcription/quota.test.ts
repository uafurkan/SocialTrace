import { describe, expect, it } from "vitest";

import {
  GLOBAL_DAILY_BILLED_CEILING,
  PENDING_RESERVATION_WINDOW_MS,
  exceedsDurationCap,
  hasGlobalCapacity,
  occupiesGlobalCeiling,
  pendingReservationCutoff,
  type UsageForCeiling,
} from "./quota";

/** Fixed clock: 2026-10-10 12:00 UTC. Today's window starts at 2026-10-10T00:00Z. */
const NOW = new Date("2026-10-10T12:00:00Z");
const MINUTE = 60 * 1000;

function row(overrides: Partial<UsageForCeiling>): UsageForCeiling {
  return { billed: false, createdAt: NOW, transcriptStatus: "processing", ...overrides };
}

describe("occupiesGlobalCeiling", () => {
  it("counts a billed row from today", () => {
    expect(occupiesGlobalCeiling(row({ billed: true, transcriptStatus: "done" }), NOW)).toBe(true);
  });

  it("does not count a billed row from before today's UTC midnight", () => {
    const yesterday = new Date("2026-10-09T23:59:59Z");
    expect(occupiesGlobalCeiling(row({ billed: true, createdAt: yesterday, transcriptStatus: "done" }), NOW)).toBe(false);
  });

  it("counts an unbilled reservation whose transcript is still processing, inside the window", () => {
    const recent = new Date(NOW.getTime() - 60 * 1000);
    expect(occupiesGlobalCeiling(row({ billed: false, createdAt: recent, transcriptStatus: "processing" }), NOW)).toBe(true);
  });

  it("does not count a cache hit: an unbilled row whose transcript is done", () => {
    expect(occupiesGlobalCeiling(row({ billed: false, transcriptStatus: "done" }), NOW)).toBe(false);
  });

  it("does not count an unbilled row with no transcript cache row", () => {
    expect(occupiesGlobalCeiling(row({ billed: false, transcriptStatus: null }), NOW)).toBe(false);
  });

  it("does not count a 'failed' transcript", () => {
    expect(occupiesGlobalCeiling(row({ billed: false, transcriptStatus: "failed" }), NOW)).toBe(false);
  });

  it("stops counting a pending reservation once it is older than the window (abandoned run)", () => {
    const atEdge = new Date(NOW.getTime() - PENDING_RESERVATION_WINDOW_MS);
    const beyond = new Date(NOW.getTime() - PENDING_RESERVATION_WINDOW_MS - MINUTE);
    expect(occupiesGlobalCeiling(row({ createdAt: atEdge }), NOW)).toBe(true);
    expect(occupiesGlobalCeiling(row({ createdAt: beyond }), NOW)).toBe(false);
  });

  it("does not count a pending reservation from before today's midnight, even inside the window", () => {
    const justBeforeMidnight = new Date("2026-10-09T23:58:00Z");
    const now = new Date("2026-10-10T00:01:00Z");
    expect(occupiesGlobalCeiling(row({ createdAt: justBeforeMidnight }), now)).toBe(false);
  });
});

describe("hasGlobalCapacity", () => {
  it("leaves room while occupied slots are below the ceiling", () => {
    expect(hasGlobalCapacity(0)).toBe(true);
    expect(hasGlobalCapacity(GLOBAL_DAILY_BILLED_CEILING - 1)).toBe(true);
  });

  it("is full once occupied slots reach the ceiling", () => {
    expect(hasGlobalCapacity(GLOBAL_DAILY_BILLED_CEILING)).toBe(false);
    expect(hasGlobalCapacity(GLOBAL_DAILY_BILLED_CEILING + 5)).toBe(false);
  });

  it("honours an explicit ceiling", () => {
    expect(hasGlobalCapacity(2, 3)).toBe(true);
    expect(hasGlobalCapacity(3, 3)).toBe(false);
  });
});

describe("pendingReservationCutoff", () => {
  it("is the window before now", () => {
    expect(pendingReservationCutoff(NOW).getTime()).toBe(NOW.getTime() - PENDING_RESERVATION_WINDOW_MS);
  });
});

describe("exceedsDurationCap", () => {
  const CAP = 45 * 60;

  it("treats an unknown duration as over the cap", () => {
    expect(exceedsDurationCap(0, CAP)).toBe(true);
    expect(exceedsDurationCap(-1, CAP)).toBe(true);
    expect(exceedsDurationCap(Number.NaN, CAP)).toBe(true);
    expect(exceedsDurationCap(Number.POSITIVE_INFINITY, CAP)).toBe(true);
  });

  it("allows a known duration up to and including the cap", () => {
    expect(exceedsDurationCap(1, CAP)).toBe(false);
    expect(exceedsDurationCap(CAP, CAP)).toBe(false);
  });

  it("refuses a known duration over the cap", () => {
    expect(exceedsDurationCap(CAP + 1, CAP)).toBe(true);
  });
});
