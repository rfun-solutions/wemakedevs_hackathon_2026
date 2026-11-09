import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { createHealthPoller } from '../services/health/poller.js';
import statusHealth from './status-health.js';

describe('GET /api/status/health', () => {
  it('returns an unavailable snapshot with max-age=15 when there is no token', async () => {
    const poller = createHealthPoller({ getToken: () => undefined });
    const app = Fastify();
    await app.register(statusHealth, { poller });
    const res = await app.inject('/api/status/health');
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('max-age=15');
    expect(res.json()).toMatchObject({ source: 'unavailable', polledAt: null, routes: [] });
  });

  it('returns the polled snapshot', async () => {
    const fetchFn = (async (url: string) => {
      const q = decodeURIComponent(new URL(url).searchParams.get('query') ?? '');
      const result = q.includes('duration_seconds_bucket')
        ? [{ metric: { dash0_operation_name: 'GET /api/agenda' }, value: [1, '2'] }]
        : [];
      return new Response(JSON.stringify({ status: 'success', data: { result } }));
    }) as unknown as typeof fetch;
    const poller = createHealthPoller({ getToken: () => 't', fetchFn });
    await poller.pollOnce();
    const app = Fastify();
    await app.register(statusHealth, { poller });
    const body = (await app.inject('/api/status/health')).json();
    expect(body.source).toBe('dash0');
    expect(body.routes).toEqual([{ route: '/api/agenda', p95Ms: 2000, slow: true }]);
  });
});
