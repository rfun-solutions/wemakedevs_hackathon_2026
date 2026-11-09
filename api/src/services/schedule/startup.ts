// Non-blocking ingest at startup. The server migrates in the background, so we retry until the
// tables exist (bounded) instead of failing. Skipped when there is no DATABASE_URI.
import type { FastifyPluginAsync } from 'fastify';
import type pg from 'pg';
import { createPool } from '../../db.js';
import { runIngest, type PoolLike } from './ingest.js';

export interface ScheduleStartupOptions {
  pool?: PoolLike;
  attempts?: number;
  retryMs?: number;
  /** Test seam. */
  ingest?: typeof runIngest;
}

export const scheduleStartup: FastifyPluginAsync<ScheduleStartupOptions> = async (app, opts) => {
  const owned = opts.pool ? undefined : createPool();
  const pool: PoolLike | undefined = opts.pool ?? (owned as pg.Pool | undefined);
  if (!pool) {
    app.log.warn('DATABASE_URI is not set; schedule ingest at startup skipped');
    return;
  }
  const attempts = opts.attempts ?? 24;
  const retryMs = opts.retryMs ?? 5000;
  const ingest = opts.ingest ?? runIngest;
  let stopped = false;

  app.addHook('onReady', async () => {
    void (async () => {
      for (let i = 1; i <= attempts && !stopped; i++) {
        try {
          const r = await ingest({ pool });
          // An 'error' result is a recorded feed/validation failure; do not hammer the feed.
          app.log.info({ status: r.status }, 'schedule ingest at startup finished');
          return;
        } catch (err) {
          // Tables not there yet (migrations still running) or DB down: try again shortly.
          app.log.warn({ attempt: i, err: (err as Error).message }, 'schedule ingest not ready');
          await new Promise((r) => setTimeout(r, retryMs));
        }
      }
    })();
  });
  app.addHook('onClose', async () => {
    stopped = true;
    await owned?.end().catch(() => undefined);
  });
};

export default scheduleStartup;
