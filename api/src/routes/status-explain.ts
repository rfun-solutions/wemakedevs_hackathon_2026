import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import {
  createAgent0Service,
  type Agent0Options,
  type Agent0Service,
} from '../services/health/agent0.js';

export interface StatusExplainOptions extends Agent0Options {
  service?: Agent0Service;
}

/**
 * GET /api/status/explain?lang=en|es -> { text, lang, at, source: 'agent0' } or
 * { text: null, lang, at: null, source: 'none' } when Agent0 has produced nothing (never invented text).
 * Chaos-exempt (under /api/status). Reads the cache only; Agent0 runs on health transitions.
 * `subscribe` is wired to F2's `onHealthTransition` once that exists; until then no transition fires.
 */
const plugin: FastifyPluginCallback<StatusExplainOptions> = (app: FastifyInstance, opts, done) => {
  const service = opts.service ?? createAgent0Service(opts);
  app.addHook('onClose', async () => service.stop());

  app.get<{ Querystring: { lang?: string } }>('/api/status/explain', async (request, reply) => {
    const lang = request.query.lang === 'es' ? 'es' : 'en';
    const out = await service.explain(lang);
    reply.header('Cache-Control', 'no-store');
    if (!out) return reply.send({ text: null, lang, at: null, source: 'none' });
    return reply.send({
      text: out.text,
      lang: out.lang,
      at: new Date(out.at).toISOString(),
      source: 'agent0',
    });
  });
  done();
};
export default plugin;
