import type { FastifyInstance, FastifyPluginCallback } from 'fastify';

/** Per-route opt-out (used by C's cron-token run): `config: { deviceId: 'optional' }`. */
declare module 'fastify' {
  interface FastifyContextConfig {
    deviceId?: 'optional';
  }
  interface FastifyRequest {
    deviceId: string | undefined;
  }
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isDeviceId = (v: unknown): v is string => typeof v === 'string' && UUID_V4.test(v);

/** Health routes never need a device id. */
const EXEMPT = new Set(['/healthz', '/readyz']);

export interface DevicePluginOptions {
  /** Where devices are recorded; omit to skip persistence (unit tests, no DB). */
  db?: { query(sql: string, params?: unknown[]): Promise<unknown> };
  /** Minimum ms between `last_seen_at` writes for the same id on this replica. */
  touchEveryMs?: number;
}

const plugin: FastifyPluginCallback<DevicePluginOptions> = (app: FastifyInstance, opts, done) => {
  const touchEveryMs = opts.touchEveryMs ?? 5 * 60_000;
  const lastTouched = new Map<string, number>();

  app.decorateRequest('deviceId', undefined);

  app.addHook('onRequest', async (request, reply) => {
    const path = request.url.split('?', 1)[0] ?? '';
    if (!path.startsWith('/api/') || EXEMPT.has(path)) return;

    const header = request.headers['x-device-id'];
    if (header === undefined) {
      if (request.routeOptions.config?.deviceId === 'optional') return;
      return reply
        .code(400)
        .send({ error: 'missing_device_id', message: 'X-Device-Id header is required' });
    }
    if (!isDeviceId(header)) {
      return reply
        .code(400)
        .send({ error: 'invalid_device_id', message: 'X-Device-Id must be a UUID v4' });
    }
    request.deviceId = header;

    if (opts.db) {
      const now = Date.now();
      const last = lastTouched.get(header);
      if (last === undefined || now - last >= touchEveryMs) {
        lastTouched.set(header, now);
        // Fire and forget: a DB hiccup must never fail the user's request.
        opts.db
          .query(
            `INSERT INTO devices (id) VALUES ($1)
             ON CONFLICT (id) DO UPDATE SET last_seen_at = now()`,
            [header],
          )
          .catch((err: unknown) => {
            lastTouched.delete(header);
            request.log.warn({ err }, 'devices upsert failed');
          });
      }
    }
  });
  done();
};

// Equivalent of fastify-plugin (not a dependency): expose the hook and decorator to the parent scope.
(plugin as unknown as Record<symbol, boolean>)[Symbol.for('skip-override')] = true;
export const devicePlugin = plugin;
