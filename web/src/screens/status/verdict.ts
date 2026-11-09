// Pure "Wi-Fi or us" verdict. Strings are looked up by the screen via t(`status.verdict.${kind}`).

export type VerdictKind = 'offline' | 'server_slow' | 'connection_slow' | 'all_good' | 'unknown';

export const RTT_SLOW_MS = 400;

export function computeVerdict(input: {
  online: boolean;
  rttMs: number | null; // median of 3 /api/ping calls; null when not measured
  serverP95: number | null;
  sloMs: number;
}): VerdictKind {
  if (!input.online) return 'offline';
  if (input.serverP95 !== null && input.serverP95 > input.sloMs) return 'server_slow';
  if (input.rttMs !== null && input.rttMs > RTT_SLOW_MS) return 'connection_slow';
  if (input.rttMs === null && input.serverP95 === null) return 'unknown';
  return 'all_good';
}

/** "Saved in N ms" text input; null when nothing was saved yet. */
export function savedLabel(ms: number | null): { shown: boolean; ms: number | null } {
  return ms === null || !Number.isFinite(ms) || ms < 0
    ? { shown: false, ms: null }
    : { shown: true, ms: Math.round(ms) };
}

/** "Schedule updated N min ago" label key and params from the feed age in seconds. */
export function feedLabel(ageS: number | null): { key: string; params?: { min: number } } {
  if (ageS === null || !Number.isFinite(ageS) || ageS < 0) return { key: 'status.feed.unknown' };
  if (ageS < 60) return { key: 'status.feed.now' };
  return { key: 'status.feed.age', params: { min: Math.floor(ageS / 60) } };
}
