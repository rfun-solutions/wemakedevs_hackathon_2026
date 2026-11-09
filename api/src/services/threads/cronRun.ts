import { SpanStatusCode, trace } from '@opentelemetry/api';

export interface CronRunResult {
  status: number;
  ok: boolean;
  body: string;
}

/**
 * The CronJob's single outbound call: POST /api/threads/run with the cron token and allDevices.
 * Wrapped in the `kc.threads.cron_run` span with an explicit timeout; never throws (errors become ok:false).
 */
export async function cronRun(
  baseUrl: string,
  token: string | undefined,
  fetchFn: typeof fetch = fetch,
  timeoutMs = 100_000,
): Promise<CronRunResult> {
  return trace.getTracer('kubecompanion').startActiveSpan('kc.threads.cron_run', async (span) => {
    try {
      if (!token) throw new Error('THREADS_CRON_TOKEN is not set');
      const res = await fetchFn(new URL('/api/threads/run', baseUrl), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-cron-token': token },
        body: JSON.stringify({ allDevices: true }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const body = await res.text();
      span.setAttribute('http.response.status_code', res.status);
      if (!res.ok) span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${res.status}` });
      return { status: res.status, ok: res.ok, body };
    } catch (e) {
      span.recordException(e as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (e as Error).name });
      return { status: 0, ok: false, body: (e as Error).message };
    } finally {
      span.end();
    }
  });
}
