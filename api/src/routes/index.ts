import type { FastifyInstance } from 'fastify';

/**
 * API route registry (design D3 "Registry markers"). Each change inserts lines DIRECTLY UNDER ITS OWN
 * marker and nowhere else, so parallel branches merge cleanly. Import lazily so no import line is needed
 * at the top of this file:
 *
 *   await app.register((await import('./agenda.js')).default);
 *
 * Never edit another change's marker or reorder them.
 */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/ping: the shared RTT probe (F consumes it, does not re-register it).
  app.get('/api/ping', async (_req, reply) => reply.code(204).send());

  // >> a-schedule-agenda
  await app.register((await import('../services/schedule/startup.js')).default);
  await app.register((await import('./sessions.js')).default);
  await app.register((await import('./agenda.js')).default);
  // >> b-capture
  await app.register((await import('./notes.js')).default);
  await app.register((await import('./people.js')).default);
  await app.register((await import('./promises.js')).default);
  // >> f-observability-product
  await app.register((await import('./status.js')).default);
  await app.register((await import('../lib/chaos.js')).chaosPlugin);
  await app.register((await import('./status-explain.js')).default);
  // >> f-observability-product-health
  // >> f-observability-product-kay
  // >> e-captions-translation
  await app.register((await import('./captions.js')).default);
  // >> e-captions-translation-translate
  // >> c-evening-threads
  await app.register((await import('./threads.js')).default);
}
