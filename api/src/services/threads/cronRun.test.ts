import { describe, expect, it } from 'vitest';
import { cronRun } from './cronRun.js';

describe('cronRun', () => {
  it('posts allDevices with the cron token and reports success', async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const fetchFn = (async (url: URL, init: RequestInit) => {
      seen = { url: String(url), init };
      return new Response('{"devices":2}', { status: 200 });
    }) as unknown as typeof fetch;
    const r = await cronRun('http://app', 'tok', fetchFn);
    expect(r).toMatchObject({ ok: true, status: 200 });
    expect(seen!.url).toBe('http://app/api/threads/run');
    expect((seen!.init.headers as Record<string, string>)['x-cron-token']).toBe('tok');
    expect(seen!.init.body).toBe('{"allDevices":true}');
  });

  it('fails without calling the network when the token is missing', async () => {
    let called = false;
    const fetchFn = (async () => ((called = true), new Response('{}'))) as unknown as typeof fetch;
    expect(await cronRun('http://app', undefined, fetchFn)).toMatchObject({ ok: false, status: 0 });
    expect(called).toBe(false);
  });

  it('turns HTTP errors and network errors into ok:false, never throws', async () => {
    const e401 = (async () => new Response('no', { status: 401 })) as unknown as typeof fetch;
    expect(await cronRun('http://app', 't', e401)).toMatchObject({ ok: false, status: 401 });
    const boom = (async () => {
      throw new Error('down');
    }) as unknown as typeof fetch;
    expect(await cronRun('http://app', 't', boom)).toMatchObject({ ok: false, body: 'down' });
  });
});
