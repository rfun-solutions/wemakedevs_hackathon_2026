// RUM for capture. Never sends note text; only timing and connectivity flags.
// The web SDK has no span API and @opentelemetry/api is not a web dependency, so the browser-side
// `kc.capture.save` span is a User Timing measure (visible in DevTools and tests) plus the RUM event below.
export interface SavedReport {
  saved_ms: number;
  queued: boolean;
  online: boolean;
}

export function markSave(startedAt: number, savedMs: number): void {
  try {
    performance.measure('kc.capture.save', { start: startedAt, duration: savedMs });
  } catch {
    /* User Timing unavailable: the RUM event still carries saved_ms */
  }
}

export async function reportSaved(report: SavedReport): Promise<void> {
  if (!import.meta.env.VITE_DASH0_INGEST_TOKEN) return; // SDK is only initialised when the token exists
  try {
    const { sendEvent } = await import('@dash0/sdk-web');
    sendEvent('kc.capture.saved', {
      title: 'Capture saved',
      attributes: { saved_ms: report.saved_ms, queued: report.queued, online: report.online },
    });
  } catch {
    /* telemetry must never break a save */
  }
}
