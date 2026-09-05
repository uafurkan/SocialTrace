/** Builds the media proxy download URL (see the route for why this can't just be a plain <a href> to the CDN). */
export function mediaDownloadUrl(url: string, filename: string): string {
  const params = new URLSearchParams({ url, filename });
  return `/api/v1/media/download?${params.toString()}`;
}
