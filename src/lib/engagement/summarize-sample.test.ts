import { describe, expect, it } from "vitest";

import { summarizeSample } from "./summarize-sample";

describe("summarizeSample", () => {
  it("returns null statistics and zero counts for an empty sample", () => {
    expect(summarizeSample([])).toEqual({ median: null, mean: null, min: null, max: null, n: 0, ignored: 0 });
  });

  it("uses the single value for every statistic", () => {
    expect(summarizeSample([4.5])).toEqual({ median: 4.5, mean: 4.5, min: 4.5, max: 4.5, n: 1, ignored: 0 });
  });

  it("takes the middle value as the median when n is odd", () => {
    const summary = summarizeSample([1, 9, 5]);
    expect(summary.median).toBe(5);
  });

  it("averages the two middle values as the median when n is even", () => {
    expect(summarizeSample([1, 2, 3, 4]).median).toBe(2.5);
    expect(summarizeSample([10, 2, 8, 4]).median).toBe(6);
  });

  it("sorts before taking the median, whatever the input order", () => {
    expect(summarizeSample([100, 1, 3, 2, 99]).median).toBe(3);
  });

  it("is not pulled off-centre by one outlier the way a mean is", () => {
    const summary = summarizeSample([2, 2, 2, 2, 1000]);
    expect(summary.median).toBe(2);
    expect(summary.mean).toBe(201.6);
  });

  it("reports mean, min and max over the usable values", () => {
    expect(summarizeSample([3, 1, 2])).toEqual({ median: 2, mean: 2, min: 1, max: 3, n: 3, ignored: 0 });
  });

  it("handles zero and negative values", () => {
    expect(summarizeSample([0, -4, 2])).toEqual({ median: 0, mean: -2 / 3, min: -4, max: 2, n: 3, ignored: 0 });
  });

  it("drops NaN and non-finite entries and counts them as ignored", () => {
    const summary = summarizeSample([1, NaN, 3, Infinity, 5, -Infinity]);
    expect(summary).toEqual({ median: 3, mean: 3, min: 1, max: 5, n: 3, ignored: 3 });
  });

  it("returns null statistics with n 0 when every entry is unusable", () => {
    expect(summarizeSample([NaN, Infinity])).toEqual({ median: null, mean: null, min: null, max: null, n: 0, ignored: 2 });
  });

  it("does not modify the array it is given", () => {
    const values = [5, NaN, 1, 3];
    summarizeSample(values);
    expect(values).toHaveLength(4);
    expect(values[0]).toBe(5);
    expect(values[2]).toBe(1);
  });
});
