import { metrics, trace } from '@opentelemetry/api';
import type { FastifyInstance } from 'fastify';
import { createRateLimiter, type RateLimiter } from '../lib/rateLimit.js';

export const ENGINES = ['whisper', 'webspeech'] as const;
export const DEVICE_CLASSES = ['ios', 'android', 'desktop'] as const;
export const MAX_SAMPLES = 20;
export const MAX_SAMPLE_MS = 120_000;
export const SEGMENT_BUCKETS = [500, 1000, 2000, 3000, 4000, 5000, 7500, 10_000, 20_000];

export type Engine = (typeof ENGINES)[number];
export type DeviceClass = (typeof DEVICE_CLASSES)[number];

export interface SliBody {
  engine: Engine;
  deviceClass: DeviceClass;
  samples: number[];
}

/** Returns the validated body or a short reason. */
export function validateSli(
  body: unknown,
): { ok: true; value: SliBody } | { ok: false; reason: string } {
  if (typeof body !== 'object' || body === null)
    return { ok: false, reason: 'body must be an object' };
  const b = body as Record<string, unknown>;
  if (!ENGINES.includes(b.engine as Engine))
    return { ok: false, reason: 'engine must be whisper or webspeech' };
  if (!DEVICE_CLASSES.includes(b.deviceClass as DeviceClass)) {
    return { ok: false, reason: 'deviceClass must be ios, android or desktop' };
  }
  if (!Array.isArray(b.samples) || b.samples.length < 1 || b.samples.length > MAX_SAMPLES) {
    return { ok: false, reason: `samples must hold 1 to ${MAX_SAMPLES} numbers` };
  }
  for (const s of b.samples) {
    if (typeof s !== 'number' || !Number.isFinite(s) || s < 0 || s > MAX_SAMPLE_MS) {
      return { ok: false, reason: `each sample must be 0 to ${MAX_SAMPLE_MS} ms` };
    }
  }
  return { ok: true, value: b as unknown as SliBody };
}

export interface CaptionsRouteOptions {
  /** Test seam: replaces the OTel histogram. Receives labels `engine` and `device_class` only. */
  record?: (ms: number, labels: { engine: Engine; device_class: DeviceClass }) => void;
  limiter?: RateLimiter;
}

/** POST /api/captions/sli: client-reported caption lag samples. 6 per minute per device. */
export default async function captionsRoutes(
  app: FastifyInstance,
  opts: CaptionsRouteOptions = {},
): Promise<void> {
  const limiter = opts.limiter ?? createRateLimiter({ max: 6, windowMs: 60_000 });
  let hist: ReturnType<ReturnType<typeof metrics.getMeter>['createHistogram']> | undefined;
  const record =
    opts.record ??
    ((ms, labels) => {
      hist ??= metrics.getMeter('kubecompanion').createHistogram('kc_captions_segment_ms', {
        unit: 'ms',
        description: 'Caption segment lag reported by clients',
        advice: { explicitBucketBoundaries: SEGMENT_BUCKETS },
      });
      hist.record(ms, labels);
    });

  app.post('/api/captions/sli', async (request, reply) => {
    const rl = limiter.take(request.deviceId ?? 'anonymous');
    if (!rl.ok) {
      return reply
        .code(429)
        .header('Retry-After', String(rl.retryAfterS))
        .send({ error: 'rate_limited', retryAfterS: rl.retryAfterS });
    }
    const v = validateSli(request.body);
    if (!v.ok) return reply.code(400).send({ error: 'invalid_body', message: v.reason });
    const { engine, deviceClass, samples } = v.value;
    trace.getTracer('kubecompanion').startActiveSpan('kc.captions.sli_report', (span) => {
      span.setAttributes({
        'kc.captions.engine': engine,
        'kc.captions.device_class': deviceClass,
        'kc.captions.samples': samples.length,
      });
      for (const ms of samples) record(ms, { engine, device_class: deviceClass });
      span.end();
    });
    return reply.code(204).send();
  });
}
