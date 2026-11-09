import { FastifyOtelInstrumentation } from '@fastify/otel';

/**
 * Fastify OTel instrumentation. It sets `http.route` to the route template on the request span and, via
 * rpcMetadata, on the HTTP server span; requestHook names the span `GET /api/agenda/:id` (T9 addendum:
 * Dash0 derives dash0_operation_name from the span name).
 *
 * Created per buildApp(): the instrumentation binds its tracer when constructed, so it
 * must be built after telemetry.ts (loaded first via `--import`) has registered the tracer provider.
 */
export function createFastifyOtel(): FastifyOtelInstrumentation {
  return new FastifyOtelInstrumentation({
    ignorePaths: (route: { url: string }) => route.url === '/healthz',
    requestHook(span, request) {
      const url = request.routeOptions?.url;
      if (url) span.updateName(`${request.method} ${url}`);
    },
  });
}
