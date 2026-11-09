/**
 * F2 D2: a minimal Dash0 PromQL client. Host, path and label names match G's scripts/rules-from-prod.mjs CONFIG
 * (route label dash0_operation_name, fallback `route` on kc_app_http_server_duration). Server only: the token
 * never leaves the API.
 */
import { SpanStatusCode, trace } from '@opentelemetry/api';

export const PROMQL_CONFIG = {
  apiHost: 'https://api.us-west-2.aws.dash0.com',
  queryPath: '/api/prometheus/api/v1/query',
  routeLabel: 'dash0_operation_name',
  fallbackRouteLabel: 'route',
  queryTimeoutMs: 5000,
} as const;

// Shared query contract with G (keep identical to scripts/rules-from-prod.mjs).
export const routesQuery = (w: string) =>
  `histogram_quantile(0.95, sum by (le, dash0_operation_name) (rate(dash0_spans_duration_seconds_bucket{service_name="kubecompanion", dash0_operation_name=~"(GET|POST|PUT|PATCH|DELETE) /.+"}[${w}])))`;
export const routesFallbackQuery = (w: string) =>
  `histogram_quantile(0.95, sum by (le, route) (rate(kc_app_http_server_duration_bucket[${w}])))`;
export const captionsQuery = (w: string) =>
  `histogram_quantile(0.95, sum by (le, engine) (rate(kc_captions_segment_ms_bucket[${w}])))`;
export const captionSamplesQuery = (w: string) =>
  `sum by (engine) (increase(kc_captions_segment_ms_count[${w}]))`;

export type PromQLFailure = 'no_token' | 'auth' | 'timeout' | 'network' | 'http' | 'shape';
export class PromQLError extends Error {
  constructor(
    readonly reason: PromQLFailure,
    message?: string,
  ) {
    super(message ?? reason);
    this.name = 'PromQLError';
  }
}

export interface PromSample {
  metric: Record<string, string>;
  value: number;
}

export interface QueryOptions {
  token: string | undefined;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

/** Runs an instant query and returns the finite samples (an empty array means no data). */
export async function queryPromQL(expr: string, opts: QueryOptions): Promise<PromSample[]> {
  return trace
    .getTracer('kubecompanion')
    .startActiveSpan('kc.status.promql_query', async (span) => {
      try {
        return await run(expr, opts);
      } catch (err) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: (err as PromQLError).reason });
        throw err;
      } finally {
        span.end();
      }
    });
}

async function run(expr: string, opts: QueryOptions): Promise<PromSample[]> {
  if (!opts.token) throw new PromQLError('no_token');
  const url = `${PROMQL_CONFIG.apiHost}${PROMQL_CONFIG.queryPath}?${new URLSearchParams({ query: expr })}`;
  let res: Response;
  try {
    res = await (opts.fetchFn ?? fetch)(url, {
      headers: { Authorization: `Bearer ${opts.token}` },
      signal: AbortSignal.timeout(opts.timeoutMs ?? PROMQL_CONFIG.queryTimeoutMs),
    });
  } catch (err) {
    const name = (err as Error)?.name;
    throw new PromQLError(name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'network');
  }
  if (res.status === 401 || res.status === 403) throw new PromQLError('auth');
  if (!res.ok) throw new PromQLError('http', `HTTP ${res.status}`);
  let body: { status?: string; data?: { result?: unknown } };
  try {
    body = (await res.json()) as typeof body;
  } catch {
    throw new PromQLError('shape');
  }
  if (body?.status !== 'success' || !Array.isArray(body.data?.result))
    throw new PromQLError('shape');
  const out: PromSample[] = [];
  for (const r of body.data.result as {
    metric?: Record<string, string>;
    value?: [number, string];
  }[]) {
    const v = Number(r.value?.[1]);
    if (Number.isFinite(v)) out.push({ metric: r.metric ?? {}, value: v });
  }
  return out;
}
