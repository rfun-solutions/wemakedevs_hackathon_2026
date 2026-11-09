// Browser telemetry for captions. Browser "spans" and metric points are sent as Dash0 web SDK custom events
// named like the span or metric (kc.captions.*, kc_captions_*). Everything is best effort and a no-op when
// the SDK was not initialised (no ingest token) or is unavailable (tests).
type Attrs = Record<string, string | number | boolean>;

export function emit(name: string, attributes: Attrs = {}): void {
  void (async () => {
    try {
      const sdk = await import('@dash0/sdk-web');
      sdk.sendEvent(name, { attributes });
    } catch {
      /* telemetry must never break captions */
    }
  })();
}

export const metric = {
  lag: (ms: number, engine: string) => emit('kc_captions_lag_ms', { value: ms, engine }),
  fallback: (reason: string, from: string, to: string) =>
    emit('kc_captions_engine_fallback_total', { value: 1, reason, from, to }),
  restart: (engine: string) => emit('kc_captions_restart_total', { value: 1, engine }),
};

export const span = {
  modelLoad: (a: { bytes: number; ms: number; backend: string }) =>
    emit('kc.captions.model_load', a),
  chunkDecode: (a: { ms: number; audioS: number }) => emit('kc.captions.chunk_decode', a),
  restart: () => emit('kc.captions.restart'),
  sliPost: (a: { outcome: string; ms: number }) => emit('kc.captions.sli_post', a),
  healthFetch: (a: { outcome: string; ms: number }) => emit('kc.captions.health_fetch', a),
  highlightToNote: (a: { chars: number }) => emit('kc.captions.highlight_to_note', a),
};
