import { metrics, trace } from '@opentelemetry/api';

/*
 * SLO candidate (F owns the check rule and dashboard; this is the definition only):
 *   capture p95 of kc_capture_saved_ms < 500 ms over 5 min.
 * "Saved" means durable on the phone (local queue write), so the SLO holds on bad Wi-Fi.
 * The client reports the value in header X-Capture-Saved-Ms on sync; it is recorded once per new note
 * (idempotent replays are not counted). kc_capture_notes_create_ms is the server handler latency.
 */
export const SAVED_MS_BUCKETS = [25, 50, 100, 250, 500, 1000, 2500];

export const tracer = trace.getTracer('kubecompanion');
const meter = metrics.getMeter('kubecompanion');

const savedMs = meter.createHistogram('kc_capture_saved_ms', {
  unit: 'ms',
  description: 'Client-reported tap-to-durable-save time for a note',
  advice: { explicitBucketBoundaries: SAVED_MS_BUCKETS },
});
const createMs = meter.createHistogram('kc_capture_notes_create_ms', {
  unit: 'ms',
  description: 'Server handler latency of POST /api/notes',
});

/** Parses X-Capture-Saved-Ms; returns null for missing or implausible values. */
export function parseSavedMs(header: unknown): number | null {
  if (typeof header !== 'string' || !/^\d{1,7}$/.test(header)) return null;
  const n = Number(header);
  return n <= 600_000 ? n : null;
}

export function recordSavedMs(ms: number, source: string): void {
  savedMs.record(ms, { 'kc.source': source });
}
export function recordCreateMs(ms: number, source: string, replay: boolean): void {
  createMs.record(ms, { 'kc.source': source, 'kc.idempotent_replay': replay });
}
