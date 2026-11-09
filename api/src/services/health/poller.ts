/**
 * F2 D2: the service health poller. Every 30 s it asks Dash0 for route p95 (agenda limit 300 ms), caption lag p95
 * per engine (limit 4000 ms, 20-sample minimum) and holds one in-memory HealthSnapshot. `onHealthTransition`
 * subscribers (F1's Agent0) are called once per healthy-to-breached change. Unavailable when there is no token or
 * the last success is older than 120 s; never invents a number.
 */
import { metrics } from '@opentelemetry/api';
import {
  PROMQL_CONFIG,
  captionSamplesQuery,
  captionsQuery,
  queryPromQL,
  routesFallbackQuery,
  routesQuery,
  type PromSample,
  type QueryOptions,
} from './promql.js';

export const ROUTE_LIMIT_MS = 300;
export const CAPTION_LIMIT_MS = 4000;
export const MIN_SAMPLES = 20;
export const STALE_MS = 120_000;
export const POLL_MS = 30_000;
const WINDOW = '5m';
const EXCLUDED = ['/healthz', '/readyz', '/api/ping'];
const EXCLUDED_PREFIX = ['/api/status'];

export interface HealthSnapshot {
  source: 'dash0' | 'unavailable';
  polledAt: string | null;
  routes: { route: string; p95Ms: number; slow: boolean }[];
  captions: { p95MsByEngine: Record<string, number>; lagging: boolean };
}

export const UNAVAILABLE: HealthSnapshot = {
  source: 'unavailable',
  polledAt: null,
  routes: [],
  captions: { p95MsByEngine: {}, lagging: false },
};

export const isBreached = (s: HealthSnapshot) =>
  s.source === 'dash0' && (s.routes.some((r) => r.slow) || s.captions.lagging);

type Listener = (prev: HealthSnapshot, next: HealthSnapshot) => void;
const listeners = new Set<Listener>();

/** Subscribe to healthy-to-breached changes; returns an unsubscribe. */
export function onHealthTransition(cb: Listener | (() => void)): () => void {
  listeners.add(cb as Listener);
  return () => void listeners.delete(cb as Listener);
}

function routesFrom(samples: PromSample[]): HealthSnapshot['routes'] {
  const by = new Map<string, number>();
  for (const s of samples) {
    const primary = s.metric[PROMQL_CONFIG.routeLabel];
    const label = primary ?? s.metric[PROMQL_CONFIG.fallbackRouteLabel];
    if (!label) continue;
    const route = label.replace(/^(GET|POST|PUT|PATCH|DELETE)\s+/, '');
    if (EXCLUDED.includes(route) || EXCLUDED_PREFIX.some((p) => route.startsWith(p))) continue;
    // dash0 span histogram is in seconds; kc_app_http_server_duration is recorded in ms
    const ms = primary ? s.value * 1000 : s.value;
    by.set(route, Math.max(by.get(route) ?? 0, ms));
  }
  return [...by].map(([route, p95Ms]) => ({
    route,
    p95Ms: Math.round(p95Ms),
    slow: p95Ms > ROUTE_LIMIT_MS,
  }));
}

function captionsFrom(p95: PromSample[], counts: PromSample[]): HealthSnapshot['captions'] {
  const n = new Map(counts.map((c) => [c.metric.engine, c.value]));
  const p95MsByEngine: Record<string, number> = {};
  for (const s of p95) {
    const engine = s.metric.engine;
    if (engine && (n.get(engine) ?? 0) >= MIN_SAMPLES) p95MsByEngine[engine] = Math.round(s.value);
  }
  const lagging = Object.values(p95MsByEngine).some((v) => v > CAPTION_LIMIT_MS);
  return { p95MsByEngine, lagging };
}

export interface PollerOptions {
  getToken?: () => string | undefined;
  fetchFn?: typeof fetch;
  now?: () => number;
  intervalMs?: number;
}

export interface HealthPoller {
  start(): void;
  stop(): void;
  pollOnce(): Promise<void>;
  snapshot(): HealthSnapshot;
}

export function createHealthPoller(opts: PollerOptions = {}): HealthPoller {
  const getToken = opts.getToken ?? (() => process.env.DASH0_TOKEN);
  const now = opts.now ?? Date.now;
  let last: HealthSnapshot | null = null;
  let lastOk = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setInterval> | undefined;
  let counter: ReturnType<ReturnType<typeof metrics.getMeter>['createCounter']> | undefined;
  const count = (result: 'ok' | 'error') => {
    counter ??= metrics
      .getMeter('kubecompanion')
      .createCounter('kc_status_health_poll_total', { description: 'Health poller runs' });
    counter.add(1, { result });
  };

  const pollOnce = async () => {
    const token = getToken();
    if (!token) return; // no token: snapshot() says unavailable, no query made
    const q: QueryOptions = { token, fetchFn: opts.fetchFn };
    try {
      let routes = await queryPromQL(routesQuery(WINDOW), q);
      if (routes.length === 0) routes = await queryPromQL(routesFallbackQuery(WINDOW), q);
      const [p95, counts] = await Promise.all([
        queryPromQL(captionsQuery(WINDOW), q),
        queryPromQL(captionSamplesQuery(WINDOW), q),
      ]);
      const next: HealthSnapshot = {
        source: 'dash0',
        polledAt: new Date(now()).toISOString(),
        routes: routesFrom(routes),
        captions: captionsFrom(p95, counts),
      };
      const prev = last ?? UNAVAILABLE;
      last = next;
      lastOk = now();
      count('ok');
      if (!isBreached(prev) && isBreached(next)) {
        for (const cb of [...listeners]) {
          try {
            cb(prev, next);
          } catch {
            /* a subscriber must not stop the poller */
          }
        }
      }
    } catch {
      count('error');
    }
  };

  return {
    pollOnce,
    snapshot: () => (!getToken() || !last || now() - lastOk > STALE_MS ? UNAVAILABLE : last),
    start() {
      if (timer || !getToken()) return;
      void pollOnce();
      timer = setInterval(() => void pollOnce(), opts.intervalMs ?? POLL_MS);
      timer.unref?.();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
    },
  };
}

let shared: HealthPoller | undefined;
export const getHealthPoller = () => (shared ??= createHealthPoller());
