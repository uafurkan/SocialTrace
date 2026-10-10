/** Summary of a sample. Every statistic is null when no usable value is left. */
export interface SampleSummary {
  median: number | null;
  mean: number | null;
  min: number | null;
  max: number | null;
  /** Number of values the statistics were computed from. */
  n: number;
  /** Number of entries dropped because they were NaN or not finite. */
  ignored: number;
}

/**
 * Median, mean, min and max of a sample. NaN and non-finite entries are
 * dropped (and counted in `ignored`) rather than poisoning the statistics.
 * The input array is not modified.
 */
export function summarizeSample(values: number[]): SampleSummary {
  const usable: number[] = [];
  let ignored = 0;
  for (const value of values) {
    if (Number.isFinite(value)) {
      usable.push(value);
    } else {
      ignored += 1;
    }
  }

  const n = usable.length;
  if (n === 0) {
    return { median: null, mean: null, min: null, max: null, n: 0, ignored };
  }

  const sorted = [...usable].sort((a, b) => a - b);
  const middle = Math.floor(n / 2);
  const median = n % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  const sum = sorted.reduce((total, value) => total + value, 0);

  return {
    median,
    mean: sum / n,
    min: sorted[0],
    max: sorted[n - 1],
    n,
    ignored,
  };
}
