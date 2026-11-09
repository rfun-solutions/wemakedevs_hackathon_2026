import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { createAgent0Service } from '../services/health/agent0.js';
import statusExplain from './status-explain.js';

const body = (text: string) =>
  `data: ${JSON.stringify({ result: { content: [{ type: 'text', text }] } })}\n\n`;

async function build(fetchFn: typeof fetch) {
  const service = createAgent0Service({
    fetchFn,
    getToken: () => 't',
    translate: async (t) => `ES:${t}`,
  });
  const app = Fastify();
  await app.register(statusExplain, { service });
  return { app, service };
}

describe('GET /api/status/explain', () => {
  it('says source none with null text when Agent0 has produced nothing', async () => {
    const { app } = await build((async () => new Response('', { status: 500 })) as typeof fetch);
    const res = await app.inject('/api/status/explain?lang=en');
    expect(res.json()).toEqual({ text: null, lang: 'en', at: null, source: 'none' });
  });

  it('never calls Agent0 on a request', async () => {
    let calls = 0;
    const { app } = await build((async () => (calls++, new Response(''))) as typeof fetch);
    await app.inject('/api/status/explain');
    expect(calls).toBe(0);
  });

  it('serves the cached sentence in EN and ES, defaulting unknown langs to en', async () => {
    const { app, service } = await build(
      (async () => new Response(body('All fine.'))) as typeof fetch,
    );
    await service.trigger();
    const en = (await app.inject('/api/status/explain?lang=fr')).json();
    expect(en).toMatchObject({ text: 'All fine.', lang: 'en', source: 'agent0' });
    expect(Date.parse(en.at)).not.toBeNaN();
    const es = (await app.inject('/api/status/explain?lang=es')).json();
    expect(es).toMatchObject({ text: 'ES:All fine.', lang: 'es', source: 'agent0' });
  });
});
