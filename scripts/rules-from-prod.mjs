/* global process, console, fetch, AbortSignal */
// Rules from production (change g-pipeline-feed-contract, G4).
// Queries Dash0 (PromQL API) for route p95 and caption-lag p95 and writes
// .gitar/review/hot-paths.md, so Gitar quotes live production numbers in reviews.
//
//   DASH0_API_TOKEN=<full-access token> node scripts/rules-from-prod.mjs [--window 15m] [--force]
//   node scripts/rules-from-prod.mjs --fixture        # initial file from fixture numbers, no network
//
// Token: DASH0_API_TOKEN (preferred) or DASH0_TOKEN. Never logged or written. An ingest-only token
// cannot query: the script then exits 0 with a clear message and writes nothing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CONFIG = {
  apiHost: 'https://api.us-west-2.aws.dash0.com',
  queryPath: '/api/prometheus/api/v1/query',
  region: 'us-west-2',
  timeZone: 'America/Denver',
  routeLabel: 'dash0_operation_name',
  fallbackRouteLabel: 'route',
  hotRouteMs: 300,
  captionLimitMs: 4000,
  maxHotRoutes: 5,
  excludedRoutes: ['/healthz', '/readyz', '/api/ping'],
  excludedRoutePrefixes: ['/api/status'],
  promiseByRoute: { '/api/notes': 'P2' },
  captionPromise: 'P1',
  captionFolder: 'web/src/lib/speech/',
  queryTimeoutMs: 10_000,
  outPath: '.gitar/review/hot-paths.md',
};

// Shared query contract: F's server poller uses the same two expressions, keep them identical.
export const routesQuery = (window) =>
  `histogram_quantile(0.95, sum by (le, dash0_operation_name) (rate(dash0_spans_duration_seconds_bucket{service_name="kubecompanion", dash0_operation_name=~"(GET|POST|PUT|PATCH|DELETE) /.+"}[${window}])))`;
export const routesFallbackQuery = (window) =>
  `histogram_quantile(0.95, sum by (le, route) (rate(kc_app_http_server_duration_bucket[${window}])))`;
export const captionsQuery = (window) =>
  `histogram_quantile(0.95, sum by (le, engine) (rate(kc_captions_segment_ms_bucket[${window}])))`;

export class QueryError extends Error {
  constructor(message, kind) {
    super(message);
    this.name = 'QueryError';
    this.kind = kind; // 'auth' | 'http' | 'timeout' | 'network' | 'shape'
  }
}

export async function queryPromQL(expr, { token, config = CONFIG, fetchImpl = fetch } = {}) {
  const url = `${config.apiHost}${config.queryPath}?${new URLSearchParams({ query: expr })}`;
  let res;
  try {
    res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(config.queryTimeoutMs),
    });
  } catch (err) {
    const timedOut = err && (err.name === 'TimeoutError' || err.name === 'AbortError');
    throw new QueryError(timedOut ? 'Dash0 query timed out' : `Dash0 query failed: ${err?.message ?? err}`, timedOut ? 'timeout' : 'network');
  }
  if (res.status === 401 || res.status === 403) throw new QueryError(`Dash0 rejected the token (HTTP ${res.status}); it cannot query (ingest-only?)`, 'auth');
  if (!res.ok) throw new QueryError(`Dash0 query returned HTTP ${res.status}`, 'http');
  let body;
  try {
    body = await res.json();
  } catch {
    throw new QueryError('Dash0 query returned non-JSON', 'shape');
  }
  if (body?.status !== 'success' || !Array.isArray(body?.data?.result)) throw new QueryError('Dash0 query returned an unexpected shape', 'shape');
  return body.data.result;
}

/** Instant-vector samples -> [{ label, value }] with finite numbers only. */
function samples(result, label) {
  return result
    .map((s) => ({ label: s.metric?.[label], value: Number(s.value?.[1]) }))
    .filter((s) => s.label && Number.isFinite(s.value));
}

/** Route p95 in ms per route (method prefix stripped; max across methods). */
export function extractRoutes(result, config = CONFIG) {
  const byRoute = new Map();
  for (const s of [...samples(result, config.routeLabel), ...samples(result, config.fallbackRouteLabel)]) {
    const route = s.label.replace(/^(GET|POST|PUT|PATCH|DELETE)\s+/, '');
    const ms = s.value * 1000; // both route histograms are in seconds
    byRoute.set(route, Math.max(byRoute.get(route) ?? 0, ms));
  }
  return [...byRoute].map(([route, p95Ms]) => ({ route, p95Ms }));
}

/** Caption lag p95 in ms per engine (kc_captions_segment_ms is already in ms). */
export function extractCaptions(result) {
  return samples(result, 'engine').map((s) => ({ engine: s.label, p95Ms: s.value }));
}

const isExcluded = (route, config) =>
  config.excludedRoutes.includes(route) || config.excludedRoutePrefixes.some((p) => route.startsWith(p));

export function hotRoutes(routes, config = CONFIG) {
  return routes
    .filter((r) => !isExcluded(r.route, config) && r.p95Ms > config.hotRouteMs)
    .sort((a, b) => b.p95Ms - a.p95Ms)
    .slice(0, config.maxHotRoutes);
}

export const fmtMs = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(1).replace(/\.0$/, '')} s` : `${Math.round(ms)} ms`);

export function fmtTime(now, config = CONFIG) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: config.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
}

/**
 * Pure: returns the file text. Every rule sentence carries its limit, the live p95 and HH:MM,
 * because Gitar quotes rule sentences, not the header (T10).
 * input: { routes: [{route,p95Ms}], captions: [{engine,p95Ms}] }; opts: { window, source: 'dash0'|'fixture' }
 */
export function renderHotPaths({ routes, captions }, now, { window = '1h', source = 'dash0', config = CONFIG } = {}) {
  const hhmm = fmtTime(now, config);
  const hot = hotRoutes(routes, config);
  const limit = fmtMs(config.hotRouteMs);
  const capLimit = fmtMs(config.captionLimitMs);
  const iso = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const origin = source === 'fixture' ? 'Generated from fixture, not production,' : 'Generated from Dash0';
  const label = source === 'fixture' ? 'fixture' : 'production';
  const top = routes
    .filter((r) => !isExcluded(r.route, config))
    .sort((a, b) => b.p95Ms - a.p95Ms)
    .slice(0, config.maxHotRoutes);
  const measured = top.length ? top.map((r) => `${r.route} ${fmtMs(r.p95Ms)}`).join('; ') : 'no routes measured';
  const capSummary = captions.length ? captions.map((c) => `${c.engine} ${fmtMs(c.p95Ms)}`).join(', ') : 'no caption traffic measured';
  const where = source === 'fixture' ? 'fixture numbers' : `Dash0, ${window} window`;

  const lines = [
    '<!-- Generated by rules-from-prod. Do not edit by hand; the next run overwrites it. -->',
    '# Hot paths (written by production telemetry)',
    `${origin} at ${hhmm} ${config.timeZone} (${iso}), window ${window}, region ${config.region}.`,
    `Measured p95: ${measured}. Caption lag p95: ${capSummary}.`,
    '',
    '## Rules',
  ];
  if (!hot.length) lines.push(`- No route is over ${limit} as of ${hhmm} (${where}).`);
  hot.forEach((r, i) => {
    const promise = config.promiseByRoute[r.route] ? ` (Promise ${config.promiseByRoute[r.route]})` : '';
    lines.push(
      `- HP-${i + 1}${promise}: Changes to the handler for \`${r.route}\` must keep p95 under ${limit} and must keep database queries out of loops (one query or one batched query per request); ${label} p95 is ${fmtMs(r.p95Ms)} as of ${hhmm} (${where}).`,
    );
  });
  const breached = captions.some((c) => c.p95Ms > config.captionLimitMs);
  const capMeasured = captions.length
    ? `${label} caption lag p95 is ${captions.map((c) => `${fmtMs(c.p95Ms)} on ${c.engine}`).join(' and ')} as of ${hhmm}, ${breached ? 'over the limit' : 'within the limit'}`
    : `no caption traffic was measured as of ${hhmm}, within the limit`;
  lines.push(
    `- CAP-1 (Promise ${config.captionPromise}): Changes under \`${config.captionFolder}\` must keep caption lag p95 under ${capLimit} and the chunk length at or under 5 s; ${capMeasured}.`,
  );
  return `${lines.join('\n')}\n`;
}

/** Hot-route set, source and caption-breach state of a rendered file (what shouldCommit compares). */
export function summarize(text) {
  if (!text) return null;
  const routes = [...text.matchAll(/^- HP-\d+(?: \(Promise P\d+\))?: .*?for `([^`]+)`/gm)].map((m) => m[1]).sort();
  const cap = text.split('\n').find((l) => l.startsWith('- CAP-1'));
  const fixture = text.includes('Generated from fixture, not production');
  return { routes, fixture, breached: !!cap && /over the limit\.$/.test(cap) };
}

export function shouldCommit(prev, next, force = false) {
  if (force) return true;
  const a = summarize(prev);
  const b = summarize(next);
  if (!a || !b) return true;
  return a.fixture !== b.fixture || a.breached !== b.breached || a.routes.join('|') !== b.routes.join('|');
}

/** The only path this script may write. */
export function resolveOutPath(repoRoot, requested = CONFIG.outPath) {
  const allowed = path.resolve(repoRoot, CONFIG.outPath);
  if (path.resolve(repoRoot, requested) !== allowed) throw new Error(`refusing to write ${requested}: only ${CONFIG.outPath} may be written`);
  return allowed;
}

export const FIXTURE_INPUT = {
  routes: [
    { route: '/api/agenda', p95Ms: 2100 },
    { route: '/api/sessions', p95Ms: 240 },
  ],
  captions: [
    { engine: 'whisper', p95Ms: 3200 },
    { engine: 'webspeech', p95Ms: 1100 },
  ],
};

function parseArgs(argv) {
  const args = { window: '1h', force: false, fixture: false, out: CONFIG.outPath, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--window') args.window = argv[++i];
    else if (a === '--force') args.force = true;
    else if (a === '--fixture') args.fixture = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--out') args.out = argv[++i];
    else throw new Error(`unknown argument: ${a}`);
  }
  if (!/^\d+[smhd]$/.test(args.window)) throw new Error(`invalid --window: ${args.window}`);
  return args;
}

export async function main(argv = process.argv.slice(2), env = process.env, { fetchImpl = fetch, now = new Date(), repoRoot } = {}) {
  const args = parseArgs(argv);
  const root = repoRoot ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const outFile = resolveOutPath(root, args.out);
  const prev = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : null;

  let input;
  let source = 'dash0';
  if (args.fixture) {
    input = FIXTURE_INPUT;
    source = 'fixture';
  } else {
    const token = env.DASH0_API_TOKEN || env.DASH0_TOKEN;
    if (!token) {
      console.log('rules-from-prod: no DASH0_API_TOKEN or DASH0_TOKEN set; skipping, nothing written.');
      return 0;
    }
    try {
      let routes = extractRoutes(await queryPromQL(routesQuery(args.window), { token, fetchImpl }));
      if (!routes.length) routes = extractRoutes(await queryPromQL(routesFallbackQuery(args.window), { token, fetchImpl }));
      if (!routes.length) {
        console.log('rules-from-prod: Dash0 returned no finite route series; nothing written.');
        return 0;
      }
      const captionResult = await queryPromQL(captionsQuery(args.window), { token, fetchImpl });
      input = { routes, captions: extractCaptions(captionResult) };
    } catch (err) {
      if (err instanceof QueryError) {
        console.log(`rules-from-prod: ${err.message}; nothing written.`);
        return 0;
      }
      throw err;
    }
  }

  const text = renderHotPaths(input, now, { window: args.window, source });
  if (!shouldCommit(prev, text, args.force || args.fixture)) {
    console.log('rules-from-prod: hot routes and caption state unchanged; nothing written.');
    return 0;
  }
  if (args.dryRun) {
    console.log(text);
    return 0;
  }
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, text);
  console.log(`rules-from-prod: wrote ${CONFIG.outPath} (${source}, ${fmtTime(now)} ${CONFIG.timeZone}).`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(`rules-from-prod: ${err.message}`);
      process.exit(1);
    },
  );
}
