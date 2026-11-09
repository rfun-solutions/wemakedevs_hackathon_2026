import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';

describe('health routes', () => {
  it('/healthz is 200 without a device id or a database', async () => {
    const app = await buildApp({ staticDir: null });
    const res = await app.inject({ url: '/healthz' });
    expect(res.statusCode).toBe(200);
  });

  it('/readyz is 200 when SELECT 1 succeeds and migrations ran', async () => {
    const app = await buildApp({
      staticDir: null,
      db: { query: async () => ({}) },
      isMigrated: () => true,
    });
    expect((await app.inject({ url: '/readyz' })).statusCode).toBe(200);
  });

  it('/readyz is 503 when the database errors', async () => {
    const app = await buildApp({
      staticDir: null,
      db: { query: async () => Promise.reject(new Error('down')) },
      isMigrated: () => true,
    });
    const res = await app.inject({ url: '/readyz' });
    expect(res.statusCode).toBe(503);
    expect(res.json().reason).toBe('down');
  });

  it('/readyz is 503 before migrations have run, and with no database', async () => {
    const pre = await buildApp({
      staticDir: null,
      db: { query: async () => ({}) },
      isMigrated: () => false,
    });
    expect((await pre.inject({ url: '/readyz' })).statusCode).toBe(503);
    const none = await buildApp({ staticDir: null });
    expect((await none.inject({ url: '/readyz' })).statusCode).toBe(503);
  });

  it('/readyz is 503 when the check exceeds the timeout', async () => {
    const { healthRoutes } = await import('./health.js');
    const Fastify = (await import('fastify')).default;
    const app = Fastify();
    await app.register(healthRoutes, {
      db: { query: () => new Promise(() => undefined) },
      isMigrated: () => true,
      timeoutMs: 20,
    });
    const res = await app.inject({ url: '/readyz' });
    expect(res.statusCode).toBe(503);
    expect(res.json().reason).toMatch(/timed out/);
  });
});
