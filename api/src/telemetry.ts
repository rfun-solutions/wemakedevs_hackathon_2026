import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { defaultResource, resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';

/**
 * Telemetry bootstrap (design D3). Load first: `node --import ./dist/telemetry.js dist/server.js`.
 * OTLP/HTTP straight to Dash0 (T2, T3). With no DASH0_TOKEN (and no explicit endpoint override) the SDK
 * is not started and the service runs normally. The token is read from the environment only.
 */
export const DASH0_INGRESS = 'https://ingress.us-west-2.aws.dash0.com';

export interface TelemetryConfig {
  token?: string;
  /** Base URL; defaults to the Dash0 ingress. An explicit override alone enables export (local collectors). */
  endpoint?: string;
  version?: string;
}

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): TelemetryConfig {
  const c: TelemetryConfig = {};
  if (env.DASH0_TOKEN) c.token = env.DASH0_TOKEN;
  if (env.DASH0_ENDPOINT) c.endpoint = env.DASH0_ENDPOINT;
  if (env.APP_VERSION) c.version = env.APP_VERSION;
  return c;
}

/** Starts the SDK and returns it, or undefined when disabled (no token, no endpoint override). */
export function startTelemetry(config: TelemetryConfig = configFromEnv()): NodeSDK | undefined {
  if (!config.token && !config.endpoint) return undefined;
  const base = (config.endpoint ?? DASH0_INGRESS).replace(/\/$/, '');
  const headers: Record<string, string> = config.token
    ? { Authorization: `Bearer ${config.token}` }
    : {};
  const exporterCfg = (path: string) => ({ url: `${base}/v1/${path}`, headers });

  const sdk = new NodeSDK({
    resource: defaultResource().merge(
      resourceFromAttributes({
        'service.name': 'kubecompanion',
        'service.version': config.version ?? 'dev',
      }),
    ),
    traceExporter: new OTLPTraceExporter(exporterCfg('traces')),
    // `metricReaders` (plural): the singular form is silently ignored (T2).
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter(exporterCfg('metrics')),
        exportIntervalMillis: 15_000,
      }),
    ],
    logRecordProcessors: [
      new BatchLogRecordProcessor({ exporter: new OTLPLogExporter(exporterCfg('logs')) }),
    ],
    instrumentations: [
      getNodeAutoInstrumentations({
        // Noisy and not useful for p95 or the demo.
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
        // pino bridge: trace ids on log lines and log records sent through the SDK's LoggerProvider.
        '@opentelemetry/instrumentation-pino': {
          disableLogSending: false,
          disableLogCorrelation: false,
        },
      }),
    ],
  });
  sdk.start();
  return sdk;
}

export const sdk: NodeSDK | undefined = process.env.VITEST ? undefined : startTelemetry();

/** Flush and stop exporters (call on SIGTERM). Safe when telemetry is disabled. */
export async function shutdownTelemetry(): Promise<void> {
  try {
    await sdk?.shutdown();
  } catch {
    // Exporter failures at shutdown must not block exit.
  }
}
