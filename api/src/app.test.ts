import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

const ID = { 'x-device-id': '3f2b8c1e-5d4a-4b7e-9a1c-0e6d2f4a8b10' };

describe('app', () => {
  it('GET /api/ping returns 204 with a device id and 400 without', async () => {
    const app = await buildApp({ staticDir: null });
    expect((await app.inject({ url: '/api/ping', headers: ID })).statusCode).toBe(204);
    expect((await app.inject({ url: '/api/ping' })).statusCode).toBe(400);
  });

  it('serves web/dist with SPA fallback, never for /api', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kc-web-'));
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>shell</title>');
    writeFileSync(join(dir, 'assets', 'app-abc123.js'), 'console.log(1)');
    const app = await buildApp({ staticDir: dir });

    const root = await app.inject({ url: '/' });
    expect(root.statusCode).toBe(200);
    expect(root.headers['cache-control']).toBe('no-cache');

    const deep = await app.inject({ url: '/schedule/session/42' });
    expect(deep.statusCode).toBe(200);
    expect(deep.body).toContain('<title>shell</title>');

    const asset = await app.inject({ url: '/assets/app-abc123.js' });
    expect(asset.statusCode).toBe(200);
    expect(asset.headers['cache-control']).toContain('immutable');

    const api = await app.inject({ url: '/api/nope', headers: ID });
    expect(api.statusCode).toBe(404);
    expect(api.json()).toEqual({ error: 'not_found' });
  });

  it('answers 404 JSON for unknown paths when there is no web build', async () => {
    const app = await buildApp({ staticDir: null });
    expect((await app.inject({ url: '/anything' })).statusCode).toBe(404);
  });
});
