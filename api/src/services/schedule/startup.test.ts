import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import type { PoolLike } from './ingest.js';
import scheduleStartup from './startup.js';

const pool = {} as PoolLike;

describe('scheduleStartup', () => {
  it('runs ingest once after ready and does not block listen', async () => {
    const ingest = vi.fn(async () => ({ status: 'ok' as const, sessionCount: 1 }));
    const app = Fastify();
    await app.register(scheduleStartup, { pool, ingest });
    await app.ready();
    await vi.waitFor(() => expect(ingest).toHaveBeenCalledTimes(1));
    await app.close();
  });
  it('retries when tables are not ready yet, then succeeds', async () => {
    const ingest = vi
      .fn()
      .mockRejectedValueOnce(new Error('relation "feed_runs" does not exist'))
      .mockResolvedValueOnce({ status: 'ok', sessionCount: 1 });
    const app = Fastify();
    await app.register(scheduleStartup, { pool, ingest, retryMs: 5 });
    await app.ready();
    await vi.waitFor(() => expect(ingest).toHaveBeenCalledTimes(2));
    await app.close();
  });
  it('gives up after the attempt budget without throwing', async () => {
    const ingest = vi.fn().mockRejectedValue(new Error('db down'));
    const app = Fastify();
    await app.register(scheduleStartup, { pool, ingest, retryMs: 1, attempts: 3 });
    await app.ready();
    await vi.waitFor(() => expect(ingest).toHaveBeenCalledTimes(3));
    await app.close();
  });
  it('is skipped without DATABASE_URI', async () => {
    const saved = { u: process.env.DATABASE_URI, l: process.env.DATABASE_URL };
    delete process.env.DATABASE_URI;
    delete process.env.DATABASE_URL;
    const ingest = vi.fn();
    const app = Fastify();
    await app.register(scheduleStartup, { ingest });
    await app.ready();
    expect(ingest).not.toHaveBeenCalled();
    await app.close();
    if (saved.u) process.env.DATABASE_URI = saved.u;
    if (saved.l) process.env.DATABASE_URL = saved.l;
  });
});
