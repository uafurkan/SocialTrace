/**
 * Provider dates for posts and comments. Each returns an ISO string, or `null`
 * when the source has no date or the value does not parse.
 *
 * Never substitute the current time. A made-up date looks real in the UI and
 * skews posting-frequency and date-filter results without any visible sign.
 */

function isoOrNull(date: Date): string | null {
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** For ISO-style date strings as the Apify and TikTok actors return them. */
export function toPostedAt(value: string | null | undefined): string | null {
  return value ? isoOrNull(new Date(value)) : null;
}

/** For Unix-seconds timestamps, such as Instagram's `taken_at_timestamp`. */
export function unixSecondsToPostedAt(seconds: number | null | undefined): string | null {
  return seconds == null ? null : isoOrNull(new Date(seconds * 1000));
}
