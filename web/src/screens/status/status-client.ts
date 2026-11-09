import type { VerdictKind } from './verdict';

export type { VerdictKind };

/** Shape of GET /api/status. */
export interface StatusPayload {
  server_ms_p95: number | null;
  feed_synced_at: string | null;
  feed_age_s: number | null;
  slo_ms: number;
  chaos_active: boolean;
}

export function medianOf(samples: number[]): number | null {
  if (!samples.length) return null;
  const s = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] ?? null) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
}
