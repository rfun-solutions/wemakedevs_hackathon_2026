import { metrics, trace } from '@opentelemetry/api';
import {
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
  AggregationTemporality,
} from '@opentelemetry/sdk-metrics';
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  TracerProvider,
} from '@opentelemetry/sdk-trace';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { configFromEnv, shutdownTelemetry, startTelemetry } from './telemetry.js';

const ID = { 'x-device-id': '3f2b8c1e-5d4a-4b7e-9a1c-0e6d2f4a8b10' };

describe('startTelemetry', () => {
  it('is disabled with no token and no endpoint, and the service still works', async () => {
    expect(startTelemetry({})).toBeUndefined();
    expect(configFromEnv({})).toEqual({});
    await expect(shutdownTelemetry()).resolves.toBeUndefined();
    const app = await buildApp({ staticDir: null });
    expect((await app.inject({ url: '/api/ping', headers: ID })).statusCode).toBe(204);
  });

  it('reads token, endpoint and version from the environment', () => {
    expect(
      configFromEnv({ DASH0_TOKEN: 't', DASH0_ENDPOINT: 'http://x', APP_VERSION: '1.2.3' }),
    ).toEqual({
      token: 't',
      endpoint: 'http://x',
      version: '1.2.3',
    });
  });
});

describe('route templates for per-route p95 (task 2.5a)', () => {
  const spans = new InMemorySpanExporter();
  const metricExporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
  const reader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 3_600_000,
  });

  beforeAll(() => {
    trace.setGlobalTracerProvider(
      new TracerProvider({ spanProcessors: [new SimpleSpanProcessor({ exporter: spans })] }),
    );
    metrics.setGlobalMeterProvider(new MeterProvider({ readers: [reader] }));
  });
  afterAll(async () => {
    trace.disable();
    metrics.disable();
    await reader.shutdown();
  });

  it('sets http.route to the template, names the span after it, and labels the histogram with it', async () => {
    const app = await buildApp({
      staticDir: null,
      extraRoutes: (a) => {
        a.get('/api/test/:id', async (req) => ({ id: (req.params as { id: string }).id }));
      },
    });
    expect((await app.inject({ url: '/api/ping', headers: ID })).statusCode).toBe(204);
    const raw = 'session-8f3a9c';
    expect((await app.inject({ url: `/api/test/${raw}`, headers: ID })).statusCode).toBe(200);

    const finished = spans.getFinishedSpans();
    const ping = finished.find((s) => s.name === 'GET /api/ping');
    const param = finished.find((s) => s.name === 'GET /api/test/:id');
    expect(ping?.attributes['http.route']).toBe('/api/ping');
    expect(param?.attributes['http.route']).toBe('/api/test/:id');
    for (const s of finished) {
      expect(s.name).not.toContain(raw);
      expect(JSON.stringify(s.attributes['http.route'] ?? '')).not.toContain(raw);
    }

    await reader.forceFlush();
    const hist = metricExporter
      .getMetrics()
      .flatMap((r) => r.scopeMetrics)
      .flatMap((s) => s.metrics)
      .find((m) => m.descriptor.name === 'kc_app_http_server_duration');
    expect(hist).toBeDefined();
    const routes = hist!.dataPoints.map((p) => p.attributes.route).sort();
    expect(routes).toEqual(['/api/ping', '/api/test/:id']);
    const p = hist!.dataPoints.find((d) => d.attributes.route === '/api/test/:id')!;
    expect(p.attributes).toMatchObject({ method: 'GET', status_class: '2xx' });
    expect(JSON.stringify(hist!.dataPoints.map((d) => d.attributes))).not.toContain(raw);
  });
});
