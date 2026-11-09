import { beforeEach, describe, expect, it } from 'vitest';
import { setLang } from '../../i18n';
import { fetchLiveData, resolveLive, type HealthSnapshotLite } from './live';

beforeEach(() => setLang('en'));

const snap: HealthSnapshotLite = {
  source: 'dash0',
  polledAt: '2026-11-09T22:52:10Z', // 15:52 in America/Denver (MST)
  routes: [
    { route: 'GET /api/agenda', p95Ms: 180.4, slow: false },
    { route: '/api/notes', p95Ms: 650, slow: true },
  ],
  promises: { P1: { state: 'ok' }, P2: { state: 'degraded' }, P3: { state: 'unknown' } },
};

describe('resolveLive promises', () => {
  it('ok, degraded, unknown, and a promise missing from the snapshot', () => {
    expect(resolveLive('promise:P1', snap, null)).toEqual({ state: 'ok', text: 'Working' });
    expect(resolveLive('promise:P2', snap, null)).toEqual({
      state: 'degraded',
      text: 'Slower than promised',
    });
    expect(resolveLive('promise:P3', snap, null).text).toBe('Not measured right now');
    expect(resolveLive('promise:P5', snap, null).state).toBe('unknown');
  });
});

describe('resolveLive routes', () => {
  it('explains route latency in plain language and includes the Denver time', () => {
    expect(resolveLive('route:GET /api/agenda', snap, null).text).toBe(
      '95 in 100 requests take 180 ms or less, measured 15:52',
    );
  });
  it('matches a path-only route and flags slow', () => {
    const r = resolveLive('route:POST /api/notes', snap, null);
    expect(r.state).toBe('degraded');
    expect(r.text).toContain('95 in 100 requests take 650 ms or less');
  });
  it('absent route is "No live data right now", never a number', () => {
    expect(resolveLive('route:GET /api/nope', snap, null)).toEqual({
      state: 'none',
      text: 'No live data right now',
    });
  });
});

describe('resolveLive release', () => {
  const at = '2026-11-09T22:52:00Z';
  it('full record', () => {
    const r = resolveLive('release', null, {
      releasedAt: at,
      gitarReviewed: true,
      radarUrl: 'https://radar.example/x',
    });
    expect(r.text).toBe('Last release 15:52, Gitar-reviewed, Radar all-clear');
  });
  it('partial record drops missing clauses', () => {
    expect(resolveLive('release', null, { releasedAt: at }).text).toBe('Last release 15:52');
    expect(resolveLive('release', null, { gitarReviewed: true }).text).toBe('Gitar-reviewed');
  });
  it('204 (null) and an empty record show no live data', () => {
    expect(resolveLive('release', null, null).state).toBe('none');
    expect(resolveLive('release', null, {}).state).toBe('none');
  });
});

describe('resolveLive snapshot failures', () => {
  it('null and unavailable snapshots give no live data', () => {
    expect(resolveLive('promise:P1', null, null).state).toBe('none');
    expect(
      resolveLive('route:GET /api/agenda', { ...snap, source: 'unavailable' }, null).state,
    ).toBe('none');
  });
  it('Spanish strings', () => {
    setLang('es');
    expect(resolveLive('promise:P1', snap, null).text).toBe('Funciona');
    expect(resolveLive('route:GET /api/agenda', snap, null).text).toBe(
      'En la medición de las 15:52, 95 de cada 100 solicitudes tardan 180 ms o menos',
    );
  });
});

const res = (status: number, body?: unknown) =>
  Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status }));

describe('fetchLiveData', () => {
  it('returns both records on 200', async () => {
    const f = ((u: string) =>
      u.endsWith('health') ? res(200, snap) : res(200, { sha: 'a' })) as never;
    const d = await fetchLiveData(f);
    expect(d.snapshot?.source).toBe('dash0');
    expect(d.release?.sha).toBe('a');
  });
  it('404, 204, 500 and thrown errors become null', async () => {
    const f = ((u: string) => (u.endsWith('health') ? res(404) : res(204))) as never;
    expect(await fetchLiveData(f)).toEqual({ snapshot: null, release: null });
    const g = (() => Promise.reject(new Error('offline'))) as never;
    expect(await fetchLiveData(g)).toEqual({ snapshot: null, release: null });
    const h = (() => res(500)) as never;
    expect(await fetchLiveData(h)).toEqual({ snapshot: null, release: null });
  });
  it('a hung call times out to null', async () => {
    const hang = ((_u: string, init: RequestInit) =>
      new Promise((_, rej) =>
        init.signal!.addEventListener('abort', () => rej(new Error('abort'))),
      )) as never;
    expect(await fetchLiveData(hang, 20)).toEqual({ snapshot: null, release: null });
  });
  it('bad JSON becomes null', async () => {
    const f = (() => Promise.resolve(new Response('not json', { status: 200 }))) as never;
    expect((await fetchLiveData(f)).snapshot).toBeNull();
  });
});
