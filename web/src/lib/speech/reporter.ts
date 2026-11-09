import { getDeviceId } from '../device';
import { emit } from './telemetry';
import type { DeviceClass, EngineId } from './types';

export const SLI_URL = '/api/captions/sli';
export const MAX_SAMPLES = 20;
export const SLI_TIMEOUT_MS = 5000;
const MAX_SAMPLE_MS = 120_000;

export interface ReporterOptions {
  deviceClass: DeviceClass;
  intervalMs?: number;
  fetchFn?: typeof fetch;
  /** Where to listen for `pagehide`; defaults to window. */
  target?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
}

export interface SliReporter {
  add(engine: EngineId, lagMs: number): void;
  flush(): void;
  start(): void;
  /** Flush and stop timers/listeners (on captions stop). */
  stop(): void;
}

/**
 * Batches lag samples and posts them to POST /api/captions/sli every 10 s, on stop and on `pagehide`.
 * Uses fetch with `keepalive: true` and X-Device-Id (sendBeacon cannot set headers, so C0's device plugin
 * would answer 400). Max 20 samples per request; one engine per request.
 */
export function createSliReporter(opts: ReporterOptions): SliReporter {
  const intervalMs = opts.intervalMs ?? 10_000;
  let batch: number[] = [];
  let batchEngine: EngineId | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;
  const onHide = () => flush();

  function flush(): void {
    if (!batchEngine || batch.length === 0) return;
    const body = JSON.stringify({
      engine: batchEngine,
      deviceClass: opts.deviceClass,
      samples: batch,
    });
    batch = [];
    batchEngine = null;
    const f = opts.fetchFn ?? globalThis.fetch;
    emit('kc.captions.sli_post', { samples: JSON.parse(body).samples.length });
    try {
      void Promise.resolve(
        f(SLI_URL, {
          method: 'POST',
          keepalive: true,
          signal: AbortSignal.timeout?.(SLI_TIMEOUT_MS),
          headers: { 'Content-Type': 'application/json', 'X-Device-Id': getDeviceId() },
          body,
        }),
      ).catch(() => undefined); // telemetry must never break captions
    } catch {
      /* ignore */
    }
  }

  return {
    add(engine, lagMs) {
      if (!Number.isFinite(lagMs)) return;
      if (batchEngine && batchEngine !== engine) flush();
      batchEngine = engine;
      batch.push(Math.min(MAX_SAMPLE_MS, Math.max(0, Math.round(lagMs))));
      if (batch.length >= MAX_SAMPLES) flush();
    },
    flush,
    start() {
      if (timer) return;
      timer = setInterval(flush, intervalMs);
      (opts.target ?? globalThis.window)?.addEventListener('pagehide', onHide);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
      (opts.target ?? globalThis.window)?.removeEventListener('pagehide', onHide);
      flush();
    },
  };
}
