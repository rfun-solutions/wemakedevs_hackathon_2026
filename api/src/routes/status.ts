import { SpanStatusCode, metrics, trace } from '@opentelemetry/api';
import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import { isChaosActive } from '../lib/chaos.js';
import { createRateLimiter, type RateLimiter } from '../lib/rateLimit.js';
import { createPool } from '../db.js';
import {
  RollingWindow,
  computeStatus,
  isMissingTable,
  parseRttBody,
  type StatusPayload,
} from './status-core.js';

export interface StatusOptions {
  /** Test seam; defaults to a pool from DATABASE_URI (none when unset: feed fields are null). */
  db?: { query(sql: string, params?: unknown[]): Promise<unknown> };
  window?: RollingWindow;
  rttLimiter?: RateLimiter;
  isChaosActive?: () => boolean;
  now?: () => Date;
}

const FEED_SQL = "SELECT max(finished_at) AS synced_at FROM feed_runs WHERE status = 'ok'";

/** Latest successful feed sync, or null (no table yet, no rows, or no database). */
async function readFeedSyncedAt(db: StatusOptions['db']): Promise<Date | string | null> {
  if (!db) return null;
  try {
    const res = (await db.query(FEED_SQL)) as { rows?: { synced_at: Date | string | null }[] };
    return res.rows?.[0]?.synced_at ?? null;
  } catch (err) {
    if (isMissingTable(err)) return null; // A's migration has not run yet
    throw err;
  }
}

/**
 * GET /api/status, POST /api/status/rtt, and the onResponse hook that feeds the rolling p95 window from
 * POST /api/notes (no change to B's code). `/api/ping` is C0's and is not registered here.
 * Skip-override so the hook sees every route.
 */
const plugin: FastifyPluginCallback<StatusOptions> = (app: FastifyInstance, opts, done) => {
  const window = opts.window ?? new RollingWindow();
  const limiter = opts.rttLimiter ?? createRateLimiter({ max: 20, windowMs: 60_000 });
  const chaosActive = opts.isChaosActive ?? isChaosActive;
  const now = opts.now ?? (() => new Date());
  const ownPool = opts.db ? undefined : createPool();
  const db = opts.db ?? ownPool;
  if (ownPool)
    app.addHook('onClose', async () => void (await ownPool.end().catch(() => undefined)));

  let rttHist: ReturnType<ReturnType<typeof metrics.getMeter>['createHistogram']> | undefined;

  app.addHook('onResponse', async (request, reply) => {
    if (request.method === 'POST' && request.routeOptions.url === '/api/notes') {
      window.push(reply.elapsedTime);
    }
  });

  app.get('/api/status', async (_req, reply) => {
    return trace.getTracer('kubecompanion').startActiveSpan('kc.status.read', async (span) => {
      try {
        const body: StatusPayload = computeStatus({
          p95: window.p95(),
          feedSyncedAt: await readFeedSyncedAt(db),
          now: now(),
          chaosActive: chaosActive(),
        });
        span.setAttributes({
          'kc.status.chaos_active': body.chaos_active,
          'kc.status.has_feed': body.feed_synced_at !== null,
        });
        return reply.header('Cache-Control', 'no-store').send(body);
      } catch (err) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
        return reply.code(503).send({ error: 'status_unavailable' });
      } finally {
        span.end();
      }
    });
  });

  app.post('/api/status/rtt', async (request, reply) => {
    const rtt = parseRttBody(request.body);
    if (rtt === null) return reply.code(400).send({ error: 'invalid_rtt' });
    const verdict = limiter.take(request.deviceId ?? request.ip);
    if (!verdict.ok) {
      return reply
        .code(429)
        .header('Retry-After', String(verdict.retryAfterS))
        .send({ error: 'rate_limited' });
    }
    rttHist ??= metrics.getMeter('kubecompanion').createHistogram('kc_status_rtt_ms', {
      unit: 'ms',
      description: 'Client-reported round trip to /api/ping',
    });
    rttHist.record(rtt);
    return reply.code(204).send();
  });

  done();
};
(plugin as unknown as Record<symbol, boolean>)[Symbol.for('skip-override')] = true;
export default plugin;
