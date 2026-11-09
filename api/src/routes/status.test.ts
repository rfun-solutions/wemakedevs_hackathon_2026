import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { createRateLimiter } from '../lib/rateLimit.js';
import statusPlugin from './status.js';
import { RollingWindow } from './status-core.js';

const NOW = new Date('2026-11-09T18:00:00Z');

async function build(opts: Parameters<typeof statusPlugin>[1] = {}) {
  const app = Fastify();
  app.decorateRequest('deviceId', undefined);
  app.post('/api/notes', async (_r, reply) => reply.code(201).send({ ok: true }));
  await app.register(statusPlugin, {
    now: () => NOW,
    isChaosActive: () => false,
    ...opts,
  });
  return app;
}

describe('GET /api/status', () => {
  it('returns the payload with feed age from feed_runs', async () => {
    const db = { query: async () => ({ rows: [{ synced_at: new Date('2026-11-09T17:56:00Z') }] }) };
    const app = await build({ db, isChaosActive: () => true });
    const res = await app.inject('/api/status');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      server_ms_p95: null,
      feed_synced_at: '2026-11-09T17:56:00.000Z',
      feed_age_s: 240,
      slo_ms: 500,
      chaos_active: true,
    });
  });

  it('handles a missing feed_runs table (42P01) with feed_synced_at null', async () => {
    const db = {
      query: async () => {
        throw Object.assign(new Error('relation "feed_runs" does not exist'), { code: '42P01' });
      },
    };
    const res = await (await build({ db })).inject('/api/status');
    expect(res.statusCode).toBe(200);
    expect(res.json().feed_synced_at).toBeNull();
    expect(res.json().feed_age_s).toBeNull();
  });

  it('returns null feed fields with no database and no rows', async () => {
    const noRows = { query: async () => ({ rows: [{ synced_at: null }] }) };
    expect(
      (await (await build({ db: noRows })).inject('/api/status')).json().feed_synced_at,
    ).toBeNull();
  });

  it('503 on other database errors', async () => {
    const db = {
      query: async () => {
        throw new Error('boom');
      },
    };
    expect((await (await build({ db })).inject('/api/status')).statusCode).toBe(503);
  });

  it('feeds p95 from POST /api/notes responses only', async () => {
    const window = new RollingWindow();
    const db = { query: async () => ({ rows: [] }) };
    const app = await build({ db, window });
    await app.inject({ method: 'POST', url: '/api/notes', payload: {} });
    await app.inject({ method: 'POST', url: '/api/notes', payload: {} });
    await app.inject('/api/status');
    expect(window.count).toBe(2);
    const body = (await app.inject('/api/status')).json();
    expect(typeof body.server_ms_p95).toBe('number');
  });
});

describe('POST /api/status/rtt', () => {
  it('accepts a valid sample with 204', async () => {
    const app = await build({ db: { query: async () => ({ rows: [] }) } });
    const res = await app.inject({
      method: 'POST',
      url: '/api/status/rtt',
      payload: { rtt_ms: 120 },
    });
    expect(res.statusCode).toBe(204);
  });

  it('400 on a bad body', async () => {
    const app = await build({ db: { query: async () => ({ rows: [] }) } });
    for (const payload of [{}, { rtt_ms: -1 }, { rtt_ms: 'x' }]) {
      const res = await app.inject({ method: 'POST', url: '/api/status/rtt', payload });
      expect(res.statusCode).toBe(400);
    }
  });

  it('429 with Retry-After once the per-device limit is spent', async () => {
    const app = await build({
      db: { query: async () => ({ rows: [] }) },
      rttLimiter: createRateLimiter({ max: 2, windowMs: 60_000 }),
    });
    const post = () =>
      app.inject({ method: 'POST', url: '/api/status/rtt', payload: { rtt_ms: 10 } });
    expect((await post()).statusCode).toBe(204);
    expect((await post()).statusCode).toBe(204);
    const limited = await post();
    expect(limited.statusCode).toBe(429);
    expect(Number(limited.headers['retry-after'])).toBeGreaterThanOrEqual(1);
  });
});
