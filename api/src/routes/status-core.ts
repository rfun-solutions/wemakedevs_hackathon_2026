// Pure status computations for GET /api/status. No Fastify, no DB, no clock reads except via arguments.

export const SLO_MS = 500;
export const WINDOW_SIZE = 200;

/** Fixed-size rolling window of durations in ms. */
export class RollingWindow {
  private readonly buf: number[] = [];
  constructor(private readonly size: number = WINDOW_SIZE) {}

  push(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) return;
    this.buf.push(ms);
    if (this.buf.length > this.size) this.buf.shift();
  }

  get count(): number {
    return this.buf.length;
  }

  /** Nearest-rank percentile; null when empty. */
  percentile(p: number): number | null {
    if (this.buf.length === 0) return null;
    const sorted = [...this.buf].sort((a, b) => a - b);
    const rank = Math.ceil((p / 100) * sorted.length);
    return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
  }

  p95(): number | null {
    const v = this.percentile(95);
    return v === null ? null : Math.round(v);
  }
}

export type StatusPayload = {
  server_ms_p95: number | null;
  feed_synced_at: string | null;
  feed_age_s: number | null;
  slo_ms: number;
  chaos_active: boolean;
};

/** postgres undefined_table */
export function isMissingTable(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '42P01';
}

export function computeStatus(input: {
  p95: number | null;
  feedSyncedAt: Date | string | null;
  now: Date;
  chaosActive: boolean;
}): StatusPayload {
  let synced: Date | null = null;
  if (input.feedSyncedAt) {
    const d = input.feedSyncedAt instanceof Date ? input.feedSyncedAt : new Date(input.feedSyncedAt);
    if (!Number.isNaN(d.getTime())) synced = d;
  }
  return {
    server_ms_p95: input.p95,
    feed_synced_at: synced ? synced.toISOString() : null,
    feed_age_s: synced ? Math.max(0, Math.round((input.now.getTime() - synced.getTime()) / 1000)) : null,
    slo_ms: SLO_MS,
    chaos_active: input.chaosActive,
  };
}

/** Median of RTT samples; null when none. */
export function medianRtt(samples: number[]): number | null {
  const s = samples.filter((n) => Number.isFinite(n) && n >= 0).sort((a, b) => a - b);
  if (!s.length) return null;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Validate POST /api/status/rtt body: { rtt_ms: number } within 0..60000. */
export function parseRttBody(body: unknown): number | null {
  if (!body || typeof body !== 'object') return null;
  const v = (body as { rtt_ms?: unknown }).rtt_ms;
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 60_000 ? v : null;
}
