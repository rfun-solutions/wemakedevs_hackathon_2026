import { readFileSync } from 'node:fs';
import { metrics, trace } from '@opentelemetry/api';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  TracerProvider,
} from '@opentelemetry/sdk-trace';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PoolLike } from './ingest.js';

let runIngest: (typeof import('./ingest.js'))['runIngest'];

const fixture = JSON.parse(
  readFileSync(
    new URL('../../../../feed-contract/fixtures/sessionize-v1.json', import.meta.url),
    'utf8',
  ),
);
const spanExporter = new InMemorySpanExporter();
const metricExporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
const metricReader = new PeriodicExportingMetricReader({
  exporter: metricExporter,
  exportIntervalMillis: 3_600_000,
});

beforeAll(async () => {
  trace.setGlobalTracerProvider(
    new TracerProvider({ spanProcessors: [new SimpleSpanProcessor({ exporter: spanExporter })] }),
  );
  metrics.setGlobalMeterProvider(new MeterProvider({ readers: [metricReader] }));
  ({ runIngest } = await import('./ingest.js'));
});
afterAll(async () => {
  trace.disable();
  metrics.disable();
  await metricReader.shutdown();
});

function fakePool() {
  const log: { text: string; params?: unknown[] }[] = [];
  const q = async (text: string, params?: unknown[]) => {
    log.push({ text, params });
    return { rows: text.includes('RETURNING id') ? [{ id: 7 }] : [] };
  };
  const pool: PoolLike = {
    query: q,
    connect: async () => ({ query: q, release: () => undefined }),
  };
  return { pool, log };
}

describe('runIngest', () => {
  it('upserts all sessions in one transaction and records ok', async () => {
    const { pool, log } = fakePool();
    const r = await runIngest({ pool, fetchFeedImpl: async () => fixture });
    expect(r).toEqual({ status: 'ok', sessionCount: 60 });
    expect(log.filter((l) => l.text.includes('INSERT INTO sessions'))).toHaveLength(60);
    const texts = log.map((l) => l.text.trim());
    expect(texts).toContain('BEGIN');
    expect(texts).toContain('COMMIT');
    const done = log.find((l) => l.text.includes("status='ok'"))!;
    expect(done.params).toEqual([7, 60]);
  });
  it('records an error and writes nothing when the shape drifts', async () => {
    const { pool, log } = fakePool();
    const r = await runIngest({ pool, fetchFeedImpl: async () => ({ sessions: [] }) });
    expect(r.status).toBe('error');
    expect(log.some((l) => l.text.includes('INSERT INTO sessions'))).toBe(false);
    expect(log.some((l) => l.text.includes("status='error'"))).toBe(true);
  });
  it('records an error when the fetch fails (no retry)', async () => {
    const { pool } = fakePool();
    let calls = 0;
    const r = await runIngest({
      pool,
      fetchFeedImpl: async () => {
        calls++;
        throw new Error('HTTP 429');
      },
    });
    expect(r).toMatchObject({ status: 'error' });
    expect(calls).toBe(1);
  });
  it('reports feed age from the latest successful database run', async () => {
    const { pool } = fakePool();
    const query = pool.query;
    let ageQuery = '';
    pool.query = async (text, params) => {
      if (text.includes('max(finished_at)')) {
        ageQuery = text;
        return { rows: [{ age_s: '45.25' }] };
      }
      return query(text, params);
    };

    await runIngest({ pool, fetchFeedImpl: async () => fixture });
    await metricReader.forceFlush();

    const gauge = metricExporter
      .getMetrics()
      .flatMap((resource) => resource.scopeMetrics)
      .flatMap((scope) => scope.metrics)
      .find((metric) => metric.descriptor.name === 'kc_schedule_feed_age_seconds');
    expect(ageQuery).toContain("WHERE status='ok'");
    expect(gauge?.dataPoints[0]?.value).toBe(45.25);
  });
  it('ends the span when creating a feed run fails', async () => {
    const { pool } = fakePool();
    pool.query = async (text) => {
      if (text.includes('INSERT INTO feed_runs')) throw new Error('database unavailable');
      return { rows: [] };
    };
    const previousSpans = spanExporter
      .getFinishedSpans()
      .filter((span) => span.name === 'kc.schedule.ingest').length;

    await expect(runIngest({ pool })).rejects.toThrow('database unavailable');

    const finishedSpans = spanExporter
      .getFinishedSpans()
      .filter((span) => span.name === 'kc.schedule.ingest');
    expect(finishedSpans).toHaveLength(previousSpans + 1);
  });
});
