import { mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CHAOS, chaosPlugin, createChaosReader } from './chaos.js';

function tmpFlags(content?: string): string {
  const file = join(mkdtempSync(join(tmpdir(), 'kc-chaos-')), 'flags.json');
  if (content !== undefined) writeFileSync(file, content);
  return file;
}

describe('createChaosReader', () => {
  it('missing file and bad JSON give DEFAULT_CHAOS without throwing', () => {
    expect(createChaosReader({ file: tmpFlags() }).get('agenda')).toBe(DEFAULT_CHAOS);
    expect(createChaosReader({ file: tmpFlags('{nope') }).get('agenda')).toBe(DEFAULT_CHAOS);
    expect(createChaosReader({ file: tmpFlags('{}') }).active()).toBe(false);
  });

  it('reads the agenda key, and re-reads only after 5 s and an mtime change', () => {
    const file = tmpFlags('{"agenda":{"latencyMs":800,"errorRate":0,"naive":false}}');
    let t = 0;
    const r = createChaosReader({ file, now: () => t });
    expect(r.get('agenda').latencyMs).toBe(800);
    expect(r.active()).toBe(true);

    writeFileSync(file, '{"agenda":{"latencyMs":0,"errorRate":0,"naive":true}}');
    utimesSync(file, new Date(), new Date(Date.now() + 10_000));
    t = 4_000;
    expect(r.get('agenda').naive).toBe(false); // inside the 5 s window
    t = 5_001;
    expect(r.get('agenda')).toEqual({ latencyMs: 0, errorRate: 0, naive: true });
  });
});

describe('chaosPlugin', () => {
  async function build(content: string, rand?: () => number) {
    const app = Fastify();
    const reader = createChaosReader({ file: tmpFlags(content), now: () => 0 });
    // Routes registered BEFORE the plugin, like A's agenda route under an earlier marker.
    app.get('/api/agenda', async () => ({ ok: true }));
    app.get('/api/sessions', async () => ({ ok: true }));
    app.get('/api/status', async () => ({ ok: true }));
    await app.register(chaosPlugin, { reader, ...(rand ? { rand } : {}) });
    return app;
  }

  it('applies a route key latency', async () => {
    const app = await build('{"/api/sessions":{"latencyMs":120}}');
    const start = Date.now();
    expect((await app.inject('/api/sessions')).statusCode).toBe(200);
    expect(Date.now() - start).toBeGreaterThanOrEqual(115);
  });

  it('injects errors for route keys', async () => {
    const app = await build('{"/api/sessions":{"errorRate":1}}', () => 0);
    const res = await app.inject('/api/sessions');
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: 'chaos_injected' });
  });

  it('reads the agenda key via getChaos but never applies it in the hook', async () => {
    const app = await build('{"agenda":{"latencyMs":500,"errorRate":1,"naive":true}}', () => 0);
    const start = Date.now();
    const res = await app.inject('/api/agenda');
    expect(res.statusCode).toBe(200);
    expect(Date.now() - start).toBeLessThan(250);
  });

  it('never alters protected routes even when configured', async () => {
    const app = await build('{"/api/status":{"errorRate":1,"latencyMs":300}}', () => 0);
    const start = Date.now();
    expect((await app.inject('/api/status')).statusCode).toBe(200);
    expect(Date.now() - start).toBeLessThan(250);
  });
});
