import type { FastifyPluginCallback } from 'fastify';
import { getHealthPoller, type HealthPoller } from '../services/health/poller.js';

export interface StatusHealthOptions {
  poller?: HealthPoller;
}

/** GET /api/status/health -> HealthSnapshot (source 'unavailable' without token or fresh data). Chaos-exempt. */
const plugin: FastifyPluginCallback<StatusHealthOptions> = (app, opts, done) => {
  const poller = opts.poller ?? getHealthPoller();
  poller.start(); // no-op without DASH0_TOKEN
  app.addHook('onClose', async () => poller.stop());
  app.get('/api/status/health', async (_req, reply) => {
    reply.header('Cache-Control', 'max-age=15');
    return reply.send(poller.snapshot());
  });
  done();
};
export default plugin;
