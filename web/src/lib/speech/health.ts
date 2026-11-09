import { getDeviceId } from '../device';
import { span } from './telemetry';
import type { DeviceClass, EngineId } from './types';

export const HEALTH_TIMEOUT_MS = 1500;

export interface CaptionsHealth {
  fasterEngine: EngineId | null;
  lagging: boolean;
}

const NONE: CaptionsHealth = { fasterEngine: null, lagging: false };

/**
 * Reads F's GET /api/status/health with a 1.5 s timeout. A 404, an error, a timeout, a malformed body or
 * `source: 'unavailable'` all mean "no hint": the platform ENGINE_ORDER applies and no message is shown.
 */
export async function fetchCaptionsHealth(
  deviceClass: DeviceClass,
  fetchFn: typeof fetch = globalThis.fetch,
  timeoutMs = HEALTH_TIMEOUT_MS,
): Promise<CaptionsHealth> {
  const started = performance.now();
  const ctrl = new AbortController();
  let timedOut = false;
  let outcome = 'unavailable';
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        ctrl.abort();
        reject(new Error('health request timed out'));
      }, timeoutMs);
    });
    const request = (async (): Promise<CaptionsHealth> => {
      const res = await fetchFn(`/api/status/health?deviceClass=${deviceClass}`, {
        signal: ctrl.signal,
        headers: { 'X-Device-Id': getDeviceId() },
      });
      if (!res.ok) return NONE;
      const body = (await res.json()) as {
        source?: string;
        captions?: { fasterEngine?: unknown; lagging?: unknown };
      };
      if (body.source === 'unavailable' || !body.captions) return NONE;
      const fe = body.captions.fasterEngine;
      outcome = 'ok';
      return {
        fasterEngine: fe === 'whisper' || fe === 'webspeech' ? fe : null,
        lagging: body.captions.lagging === true,
      };
    })();
    return await Promise.race([request, timeout]);
  } catch {
    outcome = timedOut ? 'timeout' : 'error';
    return NONE;
  } finally {
    if (timer) clearTimeout(timer);
    span.healthFetch({ outcome, ms: Math.round(performance.now() - started) });
  }
}
