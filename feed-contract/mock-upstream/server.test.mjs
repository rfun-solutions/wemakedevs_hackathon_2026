import { describe, it, expect, afterEach } from 'vitest';
import { createServer } from './server.mjs';

let server;
async function start(opts) {
  server = createServer(opts);
  await new Promise((r) => server.listen(0, r));
  return `http://127.0.0.1:${server.address().port}/feed`;
}
afterEach(() => new Promise((r) => (server ? server.close(r) : r())));

describe('mock upstream', () => {
  it('serves v1 in ok mode', async () => {
    const res = await fetch(await start());
    expect(res.status).toBe(200);
    expect((await res.json()).sessions).toHaveLength(60);
  });
  it('serves v2 when asked', async () => {
    const res = await fetch(await start({ fixture: 'sessionize-v2' }));
    expect((await res.json()).sessions[0]).toHaveProperty('starts_at');
  });
  it('returns 429 with Retry-After for the first two requests only', async () => {
    const url = await start({ mode: '429' });
    for (let i = 0; i < 2; i++) {
      const res = await fetch(url);
      expect(res.status).toBe(429);
      expect(res.headers.get('retry-after')).toBe('1');
    }
    expect((await fetch(url)).status).toBe(200);
  });
  it('rejects path-like fixture names', () => {
    expect(() => createServer({ fixture: '../x' })).toThrow();
  });
});
