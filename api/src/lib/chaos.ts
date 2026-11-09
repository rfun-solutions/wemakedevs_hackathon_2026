/**
 * The one chaos reader (change f-observability-product replaces C0's stub, same exports).
 * Reads ConfigMap `kc-chaos` key `flags.json`, mounted at /etc/kc-chaos/flags.json (env CHAOS_FILE),
 * re-reading at most every 5 s (mtime check). Missing file, key or bad JSON -> DEFAULT_CHAOS, never throws.
 * Route keys (`/api/...`) are applied by `chaosPlugin`; named keys (`agenda`) only by their owning handler.
 */
import { readFileSync, statSync } from 'node:fs';
import { metrics, trace } from '@opentelemetry/api';
import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import {
  DEFAULT_CHAOS,
  anyActive,
  decideInjection,
  parseChaosFlags,
  type ChaosFlags,
} from './chaos-parse.js';

export { DEFAULT_CHAOS };
export type { ChaosFlags };

export const DEFAULT_CHAOS_FILE = '/etc/kc-chaos/flags.json';
export const RECHECK_MS = 5000;

export interface ChaosReader {
  all(): Record<string, ChaosFlags>;
  get(key: string): ChaosFlags;
  active(): boolean;
}

export interface ChaosReaderOptions {
  file?: string | undefined;
  recheckMs?: number;
  now?: () => number;
}

export function createChaosReader(opts: ChaosReaderOptions = {}): ChaosReader {
  const recheckMs = opts.recheckMs ?? RECHECK_MS;
  const now = opts.now ?? Date.now;
  let flags: Record<string, ChaosFlags> = {};
  let lastCheck = Number.NEGATIVE_INFINITY;
  let lastMtime = -1;

  const refresh = (): Record<string, ChaosFlags> => {
    const t = now();
    if (t - lastCheck < recheckMs) return flags;
    lastCheck = t;
    const file = opts.file ?? process.env.CHAOS_FILE ?? DEFAULT_CHAOS_FILE;
    try {
      // ConfigMap mounts swap a symlink; statSync follows it, so mtime changes on update.
      const mtime = statSync(file).mtimeMs;
      if (mtime !== lastMtime) {
        flags = parseChaosFlags(readFileSync(file, 'utf8'));
        lastMtime = mtime;
      }
    } catch {
      flags = {};
      lastMtime = -1;
    }
    return flags;
  };

  return {
    all: refresh,
    get: (key) => refresh()[key] ?? DEFAULT_CHAOS,
    active: () => anyActive(refresh()),
  };
}

const shared = createChaosReader();

/** Missing file, key or bad JSON -> DEFAULT_CHAOS; never throws. */
export function getChaos(key: string): ChaosFlags {
  return shared.get(key);
}

/** True when any flag has an effect. Feeds `chaos_active` on GET /api/status. */
export function isChaosActive(): boolean {
  return shared.active();
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface ChaosPluginOptions {
  reader?: ChaosReader;
  rand?: () => number;
}

/** Generic route-key hook: latency and error only. Never touches protected routes or named keys. */
const plugin: FastifyPluginCallback<ChaosPluginOptions> = (app: FastifyInstance, opts, done) => {
  const reader = opts.reader ?? shared;
  let counter: ReturnType<ReturnType<typeof metrics.getMeter>['createCounter']> | undefined;
  app.addHook('onRequest', async (request, reply) => {
    const route = request.url.split('?', 1)[0] ?? '';
    const decision = decideInjection(reader.all(), route, opts.rand);
    if (!decision) return;
    await trace.getTracer('kubecompanion').startActiveSpan('kc.chaos.apply', async (span) => {
      span.setAttributes({
        route,
        latency_ms: decision.latencyMs,
        injected_error: decision.error,
      });
      try {
        if (decision.latencyMs > 0) await sleep(decision.latencyMs);
      } finally {
        span.end();
      }
    });
    counter ??= metrics
      .getMeter('kubecompanion')
      .createCounter('kc_chaos_injected_total', { description: 'Requests altered by kc-chaos' });
    counter.add(1, { route, kind: decision.error ? 'error' : 'latency' });
    if (decision.error) {
      return reply.code(503).send({ error: 'chaos_injected' });
    }
    return undefined;
  });
  done();
};
(plugin as unknown as Record<symbol, boolean>)[Symbol.for('skip-override')] = true;
export const chaosPlugin = plugin;
