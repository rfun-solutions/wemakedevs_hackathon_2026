import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  CONFIG,
  queryPromQL,
  extractRoutes,
  extractCaptions,
  hotRoutes,
  renderHotPaths,
  shouldCommit,
  summarize,
  resolveOutPath,
  main,
  routesQuery,
  captionsQuery,
  QueryError,
} from './rules-from-prod.mjs';

// 22:52Z on 2026-11-09 is 15:52 MST (America/Denver, UTC-7 after the 2026-11-01 change).
const NOW = new Date('2026-11-09T22:52:00Z');
const vec = (rows, label) => rows.map(([l, v]) => ({ metric: { [label]: l }, value: [0, String(v)] }));
const routesResult = (rows) => vec(rows.map(([r, s]) => [`GET ${r}`, s]), CONFIG.routeLabel);
const capResult = (rows) => vec(rows, 'engine');
const ok = (result) => ({ ok: true, status: 200, json: async () => ({ status: 'success', data: { resultType: 'vector', result } }) });
const status = (code) => ({ ok: false, status: code, json: async () => ({}) });

const input = (routes, captions = [['whisper', 3200], ['webspeech', 1100]]) => ({
  routes: extractRoutes(routesResult(routes)),
  captions: extractCaptions(capResult(captions)),
});

describe('extract and select', () => {
  it('strips the method prefix, converts seconds to ms and falls back to the route label', () => {
    expect(extractRoutes(routesResult([['/api/agenda', 2.1]]))).toEqual([{ route: '/api/agenda', p95Ms: 2100 }]);
    expect(extractRoutes(vec([['/api/x', 0.5]], 'route'))).toEqual([{ route: '/api/x', p95Ms: 500 }]);
  });
  it('drops NaN samples', () => {
    expect(extractRoutes(routesResult([['/api/a', 'NaN']]))).toEqual([]);
  });
  it('excludes health/status routes, sorts slowest first and caps at 5', () => {
    const routes = [
      ['/healthz', 5], ['/readyz', 5], ['/api/ping', 5], ['/api/status/db', 5],
      ['/a', 0.4], ['/b', 0.9], ['/c', 0.5], ['/d', 0.6], ['/e', 0.7], ['/f', 0.8], ['/g', 0.1],
    ];
    expect(hotRoutes(input(routes).routes).map((r) => r.route)).toEqual(['/b', '/f', '/e', '/d', '/c']);
  });
});

describe('renderHotPaths', () => {
  it('two hot routes: header in Denver and UTC, one HP rule each, plus CAP-1', () => {
    const text = renderHotPaths(input([['/api/agenda', 2.1], ['/api/sessions', 0.45], ['/api/other', 0.1]]), NOW, { window: '15m' });
    expect(text).toContain('Generated from Dash0 at 15:52 America/Denver (2026-11-09T22:52:00Z), window 15m, region us-west-2.');
    expect(text).toContain('Measured p95: /api/agenda 2.1 s; /api/sessions 450 ms; /api/other 100 ms.');
    expect(text.match(/^- HP-\d/gm)).toHaveLength(2);
    expect(text).toMatch(/HP-1: Changes to the handler for `\/api\/agenda` must keep p95 under 300 ms and must keep database queries out of loops .*production p95 is 2\.1 s as of 15:52/);
    expect(text).toMatch(/HP-2: .*`\/api\/sessions`.*production p95 is 450 ms as of 15:52/);
  });
  it('no hot routes: says so and still has CAP-1', () => {
    const text = renderHotPaths(input([['/api/agenda', 0.2]]), NOW);
    expect(text).toContain('- No route is over 300 ms as of 15:52 (Dash0, 1h window).');
    expect(text).not.toMatch(/^- HP-/m);
    expect(text).toMatch(/^- CAP-1 /m);
  });
  it('caption breach is marked over the limit and names the folder and chunk limit', () => {
    const text = renderHotPaths(input([['/api/agenda', 0.2]], [['whisper', 4500], ['webspeech', 900]]), NOW);
    const cap = text.split('\n').find((l) => l.startsWith('- CAP-1'));
    expect(cap).toContain('`web/src/lib/speech/`');
    expect(cap).toContain('chunk length at or under 5 s');
    expect(cap).toMatch(/4\.5 s on whisper.*as of 15:52, over the limit\.$/);
  });
  it('within the limit when no engine is over 4 s; no caption traffic still gives a CAP-1 line', () => {
    expect(renderHotPaths(input([['/a', 0.1]]), NOW)).toMatch(/3\.2 s on whisper.*within the limit\.$/m);
    const none = renderHotPaths(input([['/a', 0.1]], []), NOW);
    expect(none).toMatch(/CAP-1 \(Promise P1\): .*no caption traffic was measured as of 15:52, within the limit\.$/m);
  });
  it('more than five hot routes: only five HP rules', () => {
    const rows = ['/a', '/b', '/c', '/d', '/e', '/f', '/g'].map((r, i) => [r, 1 + i / 10]);
    expect(renderHotPaths(input(rows), NOW).match(/^- HP-\d/gm)).toHaveLength(5);
  });
  it('every rule line carries its limit, a p95 clause and HH:MM', () => {
    const text = renderHotPaths(input([['/api/agenda', 2.1], ['/api/notes', 0.8]]), NOW);
    const rules = text.split('\n').filter((l) => /^- (HP|CAP)-/.test(l));
    expect(rules).toHaveLength(3);
    for (const l of rules) {
      expect(l).toMatch(/p95 is \d+(\.\d)? (s|ms)/);
      expect(l).toContain('as of 15:52');
      expect(l).toMatch(/under \d+ (s|ms)/);
    }
  });
  it('CAP-1 and a hot /api/notes rule carry their promise ids; other routes do not', () => {
    const text = renderHotPaths(input([['/api/agenda', 2.1], ['/api/notes', 0.8]]), NOW);
    expect(text).toMatch(/^- CAP-1 \(Promise P1\): /m);
    expect(text).toMatch(/^- HP-2 \(Promise P2\): .*`\/api\/notes`/m);
    expect(text).toMatch(/^- HP-1: .*`\/api\/agenda`/m);
  });
  it('fixture source is labelled and never says production', () => {
    const text = renderHotPaths(input([['/api/agenda', 2.1]]), NOW, { source: 'fixture' });
    expect(text).toContain('Generated from fixture, not production,');
    expect(text).not.toMatch(/production p95|production caption/);
  });
});

describe('shouldCommit', () => {
  const a = renderHotPaths(input([['/api/agenda', 2.1]]), NOW);
  it('same hot set and breach state, different numbers: no commit', () => {
    const b = renderHotPaths(input([['/api/agenda', 1.9]]), new Date('2026-11-09T23:52:00Z'));
    expect(shouldCommit(a, b)).toBe(false);
  });
  it('commits when the hot set changes, breach flips, there is no previous file, or force', () => {
    expect(shouldCommit(a, renderHotPaths(input([['/api/sessions', 1]]), NOW))).toBe(true);
    expect(shouldCommit(a, renderHotPaths(input([['/api/agenda', 2.1]], [['whisper', 9000]]), NOW))).toBe(true);
    expect(shouldCommit(null, a)).toBe(true);
    expect(shouldCommit(a, a, true)).toBe(true);
  });
  it('summarize reads routes and breach back from the text', () => {
    expect(summarize(renderHotPaths(input([['/api/agenda', 2.1], ['/api/notes', 0.8]], [['w', 9000]]), NOW))).toEqual({ routes: ['/api/agenda', '/api/notes'], breached: true });
  });
});

describe('queryPromQL', () => {
  const opts = (fetchImpl) => ({ token: 'tok', fetchImpl });
  it('returns the result vector and sends the bearer token to the verified path', async () => {
    let seen;
    const f = async (url, init) => ((seen = { url, init }), ok([{ metric: {}, value: [0, '1'] }]));
    expect(await queryPromQL('up', opts(f))).toHaveLength(1);
    expect(seen.url).toContain('https://api.us-west-2.aws.dash0.com/api/prometheus/api/v1/query?query=up');
    expect(seen.init.headers.Authorization).toBe('Bearer tok');
  });
  it('401 is an auth QueryError', async () => {
    await expect(queryPromQL('up', opts(async () => status(401)))).rejects.toMatchObject({ kind: 'auth' });
  });
  it('timeout is a timeout QueryError', async () => {
    const f = async () => { const e = new Error('t'); e.name = 'TimeoutError'; throw e; };
    await expect(queryPromQL('up', opts(f))).rejects.toMatchObject({ kind: 'timeout' });
  });
  it('500 and bad shape are QueryErrors', async () => {
    await expect(queryPromQL('up', opts(async () => status(500)))).rejects.toBeInstanceOf(QueryError);
    await expect(queryPromQL('up', opts(async () => ({ ok: true, status: 200, json: async () => ({}) })))).rejects.toMatchObject({ kind: 'shape' });
  });
  it('query strings follow the shared contract', () => {
    expect(routesQuery('15m')).toContain('dash0_spans_duration_seconds_bucket{service_name="kubecompanion"');
    expect(routesQuery('15m')).toContain('[15m]');
    expect(captionsQuery('1h')).toBe('histogram_quantile(0.95, sum by (le, engine) (rate(kc_captions_segment_ms_bucket[1h])))');
  });
});

describe('main', () => {
  let dir;
  afterEach(() => dir && fs.rmSync(dir, { recursive: true, force: true }));
  const setup = () => ((dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfp-'))), dir);
  const outFile = () => path.join(dir, CONFIG.outPath);
  const fetchOk = async (url) => (url.includes('kc_captions') ? ok(capResult([['whisper', 3200]])) : ok(routesResult([['/api/agenda', 2.1]])));

  it('writes the file from live-shaped data', async () => {
    setup();
    expect(await main(['--window', '15m'], { DASH0_API_TOKEN: 't' }, { fetchImpl: fetchOk, now: NOW, repoRoot: dir })).toBe(0);
    expect(fs.readFileSync(outFile(), 'utf8')).toContain('HP-1: Changes to the handler for `/api/agenda`');
  });
  it('writes nothing and exits 0 with no token, a 401, a timeout, or an empty result', async () => {
    setup();
    const run = (env, f) => main([], env, { fetchImpl: f, now: NOW, repoRoot: dir });
    expect(await run({}, fetchOk)).toBe(0);
    expect(await run({ DASH0_TOKEN: 't' }, async () => status(401))).toBe(0);
    expect(await run({ DASH0_TOKEN: 't' }, async () => { const e = new Error('t'); e.name = 'TimeoutError'; throw e; })).toBe(0);
    expect(await run({ DASH0_TOKEN: 't' }, async () => ok([]))).toBe(0);
    expect(fs.existsSync(outFile())).toBe(false);
  });
  it('skips the write when unchanged, writes with --force', async () => {
    setup();
    const env = { DASH0_API_TOKEN: 't' };
    await main([], env, { fetchImpl: fetchOk, now: NOW, repoRoot: dir });
    const first = fs.statSync(outFile()).mtimeMs;
    await main([], env, { fetchImpl: fetchOk, now: new Date('2026-11-09T23:52:00Z'), repoRoot: dir });
    expect(fs.readFileSync(outFile(), 'utf8')).toContain('as of 15:52');
    await main(['--force'], env, { fetchImpl: fetchOk, now: new Date('2026-11-09T23:52:00Z'), repoRoot: dir });
    expect(fs.readFileSync(outFile(), 'utf8')).toContain('as of 16:52');
    expect(first).toBeGreaterThan(0);
  });
  it('--fixture writes the fixture file with no network', async () => {
    setup();
    await main(['--fixture'], {}, { fetchImpl: () => { throw new Error('network'); }, now: NOW, repoRoot: dir });
    expect(fs.readFileSync(outFile(), 'utf8')).toContain('Generated from fixture, not production');
  });
  it('refuses any path other than the rule file', async () => {
    setup();
    expect(() => resolveOutPath(dir, '.gitar/review/other.md')).toThrow(/refusing/);
    expect(() => resolveOutPath(dir, '../x')).toThrow(/refusing/);
    await expect(main(['--fixture', '--out', 'README.md'], {}, { repoRoot: dir, now: NOW })).rejects.toThrow(/refusing/);
    expect(resolveOutPath(dir)).toBe(path.join(dir, CONFIG.outPath));
  });
});
