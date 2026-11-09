import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { devicePlugin, isDeviceId } from './device.js';

const GOOD = '3f2b8c1e-5d4a-4b7e-9a1c-0e6d2f4a8b10';

type Q = (sql: string, params?: unknown[]) => Promise<unknown>;
async function make(db?: { query: Q }) {
  const app = Fastify();
  await app.register(devicePlugin, db ? { db } : {});
  app.get('/api/who', async (req) => ({ id: req.deviceId ?? null }));
  app.get('/api/cron', { config: { deviceId: 'optional' } }, async (req) => ({
    id: req.deviceId ?? null,
  }));
  app.get('/healthz', async () => 'ok');
  return app;
}

describe('device plugin', () => {
  it('accepts a valid UUID v4 and decorates the request', async () => {
    const app = await make();
    const res = await app.inject({ url: '/api/who', headers: { 'x-device-id': GOOD } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: GOOD });
  });

  it('rejects a missing header with 400', async () => {
    const app = await make();
    const res = await app.inject({ url: '/api/who' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('missing_device_id');
  });

  it.each(['nope', '3f2b8c1e-5d4a-1b7e-9a1c-0e6d2f4a8b10', GOOD + 'x', ''])(
    'rejects malformed id %j with 400',
    async (id) => {
      const app = await make();
      const res = await app.inject({ url: '/api/who', headers: { 'x-device-id': id } });
      expect(res.statusCode).toBe(400);
    },
  );

  it('lets an opted-out route run without the header, but still rejects a malformed one', async () => {
    const app = await make();
    const ok = await app.inject({ url: '/api/cron' });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ id: null });
    const withId = await app.inject({ url: '/api/cron', headers: { 'x-device-id': GOOD } });
    expect(withId.json()).toEqual({ id: GOOD });
    const bad = await app.inject({ url: '/api/cron', headers: { 'x-device-id': 'bad' } });
    expect(bad.statusCode).toBe(400);
  });

  it('exempts non-API paths such as /healthz', async () => {
    const app = await make();
    expect((await app.inject({ url: '/healthz' })).statusCode).toBe(200);
  });

  it('upserts the device once per touch window and survives a DB error', async () => {
    const query = vi.fn<Q>().mockRejectedValueOnce(new Error('db down')).mockResolvedValue({});
    const app = await make({ query });
    const h = { 'x-device-id': GOOD };
    expect((await app.inject({ url: '/api/who', headers: h })).statusCode).toBe(200);
    await new Promise((r) => setImmediate(r));
    // first write failed, so the next request retries it; the one after is throttled
    await app.inject({ url: '/api/who', headers: h });
    await app.inject({ url: '/api/who', headers: h });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0]?.[1]).toEqual([GOOD]);
  });

  it('sweeps expired touch-cache entries every 1000 requests so the cache stays bounded', async () => {
    vi.useFakeTimers();
    try {
      const query = vi.fn<Q>().mockResolvedValue({});
      const touchCache = new Map<string, number>();
      const app = Fastify();
      await app.register(devicePlugin, { db: { query }, touchCache });
      app.get('/api/who', async () => 'ok');
      const uuid = (i: number) => `3f2b8c1e-5d4a-4b7e-9a1c-${String(i).padStart(12, '0')}`;
      const hit = (i: number) =>
        app.inject({ url: '/api/who', headers: { 'x-device-id': uuid(i) } });

      for (let i = 0; i < 500; i++) await hit(i);
      expect(touchCache.size).toBe(500);
      vi.advanceTimersByTime(6 * 60_000); // all 500 entries are now expired
      for (let i = 500; i < 1000; i++) await hit(i); // the 1000th request triggers the sweep
      expect(touchCache.size).toBe(500); // only the 500 fresh entries remain (the 1000th is added after the sweep)
    } finally {
      vi.useRealTimers();
    }
  });

  it('isDeviceId validates the v4 format', () => {
    expect(isDeviceId(GOOD)).toBe(true);
    expect(isDeviceId(undefined)).toBe(false);
  });
});
