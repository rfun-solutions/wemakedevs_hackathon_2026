import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { devicePlugin } from './plugins/device.js';
import { httpMetricsPlugin } from './plugins/httpMetrics.js';
import { createFastifyOtel } from './plugins/otel.js';
import { healthRoutes } from './routes/health.js';
import { registerRoutes } from './routes/index.js';

export interface Db {
  query(sql: string, params?: unknown[]): Promise<unknown>;
}

export interface BuildAppOptions {
  db?: Db;
  isMigrated?: () => boolean;
  /** Directory of the built web app; defaults to <repo>/web/dist. Static serving is skipped if missing. */
  staticDir?: string | null;
  logger?: FastifyServerOptions['logger'];
  /** Extra routes registered after the registry (tests). */
  extraRoutes?: (app: FastifyInstance) => void | Promise<void>;
}

export const DEFAULT_STATIC_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'web',
  'dist',
);

export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false });

  await app.register(createFastifyOtel().plugin());
  await app.register(httpMetricsPlugin);
  await app.register(devicePlugin, { ...(opts.db ? { db: opts.db } : {}) });
  await app.register(healthRoutes, {
    ...(opts.db ? { db: opts.db } : {}),
    isMigrated: opts.isMigrated ?? (() => true),
  });
  await registerRoutes(app);
  await opts.extraRoutes?.(app);

  const staticDir = opts.staticDir === undefined ? DEFAULT_STATIC_DIR : opts.staticDir;
  const hasWeb = staticDir !== null && existsSync(join(staticDir, 'index.html'));
  if (hasWeb) {
    await app.register(fastifyStatic, {
      root: staticDir,
      wildcard: true,
      setHeaders(res, path) {
        // Hashed build assets never change; the shell, manifest and service worker must always revalidate.
        res.header(
          'Cache-Control',
          /[\\/]assets[\\/]/.test(path) ? 'public, max-age=31536000, immutable' : 'no-cache',
        );
      },
    });
  }

  // SPA fallback: unknown non-API GETs get index.html so client-side routes survive reload and offline deep links.
  app.setNotFoundHandler(async (request, reply) => {
    const path = request.url.split('?', 1)[0] ?? '';
    const isApi = path === '/api' || path.startsWith('/api/');
    if (hasWeb && !isApi && (request.method === 'GET' || request.method === 'HEAD')) {
      return reply.header('Cache-Control', 'no-cache').type('text/html').sendFile('index.html');
    }
    return reply.code(404).send({ error: 'not_found' });
  });

  return app;
}
