import { getDeviceId } from '../device';
import { emit } from './telemetry';
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
  emit('kc.captions.health_fetch', { deviceClass });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
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
    return {
      fasterEngine: fe === 'whisper' || fe === 'webspeech' ? fe : null,
      lagging: body.captions.lagging === true,
    };
  } catch {
    return NONE;
  } finally {
    clearTimeout(timer);
  }
}
