const AVATAR_PALETTE_SIZE = 6;

/**
 * Deterministic: the same username always maps to the same palette slot,
 * so a given identity's fallback avatar looks the same everywhere it
 * appears (search results, followers list, tracking dashboard, ...).
 */
export function avatarPaletteIndex(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % AVATAR_PALETTE_SIZE) + 1;
}

export function avatarInitials(username: string, displayName?: string): string {
  const source = displayName?.trim() || username;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}
