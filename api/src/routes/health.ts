import { SpanStatusCode, trace } from '@opentelemetry/api';
import type { FastifyInstance } from 'fastify';

export interface HealthOptions {
  db?: { query(sql: string): Promise<unknown> };
  /** True once migrations have run. */
  isMigrated: () => boolean;
  timeoutMs?: number;
}

/** GET /healthz is liveness; GET /readyz is readiness. Neither needs X-Device-Id. */
export async function healthRoutes(app: FastifyInstance, opts: HealthOptions): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? 1000;

  app.get('/healthz', async (_req, reply) => reply.type('text/plain').send('ok'));

  app.get('/readyz', async (_req, reply) => {
    return trace.getTracer('kubecompanion').startActiveSpan('kc.app.readyz', async (span) => {
      let timer: NodeJS.Timeout | undefined;
      try {
        if (!opts.db) throw new Error('no database configured');
        if (!opts.isMigrated()) throw new Error('migrations have not run');
        await Promise.race([
          opts.db.query('SELECT 1'),
          new Promise((_, rej) => {
            timer = setTimeout(() => rej(new Error('db check timed out')), timeoutMs);
          }),
        ]);
        span.setAttribute('kc.ready', true);
        return reply.code(200).type('text/plain').send('ok');
      } catch (e) {
        span.setAttribute('kc.ready', false);
        span.setStatus({ code: SpanStatusCode.ERROR, message: (e as Error).message });
        return reply.code(503).send({ status: 'unavailable', reason: (e as Error).message });
      } finally {
        clearTimeout(timer);
        span.end();
      }
    });
  });
}
