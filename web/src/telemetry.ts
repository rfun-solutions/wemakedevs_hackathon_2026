// Browser telemetry (Dash0 web SDK). Token is the ingest-only VITE_DASH0_INGEST_TOKEN injected at build.
// The server token's env name must never appear here (CI greps web/dist for it).
const INGRESS_URL = 'https://ingress.us-west-2.aws.dash0.com';
export const DEFAULT_SERVICE_NAME = 'kc-web';
export const KAY_SERVICE_NAME = 'kc-web-kay';

/** Only `kc.probe=kay` is honoured (synthetic Kay probe, design D3a); anything else, or throwing storage, keeps the default. */
export function resolveServiceName(storage?: Pick<Storage, 'getItem'>): string {
  try {
    const s = storage ?? globalThis.localStorage;
    return s.getItem('kc.probe') === 'kay' ? KAY_SERVICE_NAME : DEFAULT_SERVICE_NAME;
  } catch {
    return DEFAULT_SERVICE_NAME;
  }
}

export async function initTelemetry(): Promise<void> {
  const token = import.meta.env.VITE_DASH0_INGEST_TOKEN as string | undefined;
  if (!token) return; // telemetry is optional; the app must work without it
  try {
    const { init } = await import('@dash0/sdk-web');
    init({
      serviceName: resolveServiceName(),
      endpoint: { url: INGRESS_URL, authToken: token },
      // join browser spans to API spans via traceparent on same-origin calls
      propagateTraceHeadersCorsURLs: [
        new RegExp(`^${location.origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
      ],
    });
  } catch {
    /* never let telemetry break the app */
  }
}
