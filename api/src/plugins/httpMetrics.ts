import { metrics } from '@opentelemetry/api';
import type { FastifyInstance, FastifyPluginCallback } from 'fastify';

/**
 * Fallback for per-route p95 (T9 addendum): histogram kc_app_http_server_duration{route,method,status_class}
 * with `route` the route TEMPLATE ('/api/agenda/:id'), never the raw path, so cardinality stays bounded.
 */
const plugin: FastifyPluginCallback = (app: FastifyInstance, _opts, done) => {
  let hist: ReturnType<ReturnType<typeof metrics.getMeter>['createHistogram']> | undefined;
  app.addHook('onResponse', async (request, reply) => {
    hist ??= metrics.getMeter('kubecompanion').createHistogram('kc_app_http_server_duration', {
      unit: 'ms',
      description: 'HTTP server duration by route template',
    });
    hist.record(reply.elapsedTime, {
      route: request.routeOptions.url ?? 'unmatched',
      method: request.method,
      status_class: `${Math.floor(reply.statusCode / 100)}xx`,
    });
  });
  done();
};
(plugin as unknown as Record<symbol, boolean>)[Symbol.for('skip-override')] = true;
export const httpMetricsPlugin = plugin;
