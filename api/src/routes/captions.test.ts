import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { devicePlugin } from '../plugins/device.js';
import { createRateLimiter } from '../lib/rateLimit.js';
import captionsRoutes from './captions.js';

const ID = { 'x-device-id': '3f2b8c1e-5d4a-4b7e-9a1c-0e6d2f4a8b10' };

async function build(opts: Parameters<typeof captionsRoutes>[1] = {}) {
  const app = Fastify();
  await app.register(devicePlugin, {});
  await app.register(captionsRoutes, opts);
  return app;
}
const post = (app: Awaited<ReturnType<typeof build>>, payload: unknown) =>
  app.inject({ method: 'POST', url: '/api/captions/sli', headers: ID, payload: payload as object });

describe('POST /api/captions/sli', () => {
  it('204 and records one histogram point per sample with engine and device_class only', async () => {
    const record = vi.fn();
    const app = await build({ record });
    const res = await post(app, {
      engine: 'whisper',
      deviceClass: 'desktop',
      samples: [1200, 4500],
    });
    expect(res.statusCode).toBe(204);
    expect(record).toHaveBeenCalledTimes(2);
    expect(record).toHaveBeenCalledWith(1200, { engine: 'whisper', device_class: 'desktop' });
    for (const call of record.mock.calls) {
      expect(Object.keys(call[1]).sort()).toEqual(['device_class', 'engine']);
      expect(JSON.stringify(call)).not.toContain(ID['x-device-id']);
    }
  });

  it.each([
    ['bad engine', { engine: 'vosk', deviceClass: 'ios', samples: [1] }],
    ['bad device class', { engine: 'webspeech', deviceClass: 'tv', samples: [1] }],
    ['no samples', { engine: 'webspeech', deviceClass: 'ios', samples: [] }],
    ['too many samples', { engine: 'webspeech', deviceClass: 'ios', samples: Array(21).fill(1) }],
    ['negative', { engine: 'webspeech', deviceClass: 'ios', samples: [-1] }],
    ['above 120000', { engine: 'webspeech', deviceClass: 'ios', samples: [120_001] }],
    ['not a number', { engine: 'webspeech', deviceClass: 'ios', samples: ['x'] }],
  ])('400 for %s', async (_n, body) => {
    const record = vi.fn();
    const res = await post(await build({ record }), body);
    expect(res.statusCode).toBe(400);
    expect(record).not.toHaveBeenCalled();
  });

  it('accepts exactly 20 samples at the 0 and 120000 bounds', async () => {
    const app = await build({ record: vi.fn() });
    const samples = [0, 120_000, ...Array(18).fill(10)];
    expect(
      (await post(app, { engine: 'webspeech', deviceClass: 'android', samples })).statusCode,
    ).toBe(204);
  });

  it('429 with Retry-After after the per-device limit', async () => {
    const app = await build({
      record: vi.fn(),
      limiter: createRateLimiter({ max: 6, windowMs: 60_000 }),
    });
    const body = { engine: 'webspeech', deviceClass: 'ios', samples: [100] };
    for (let i = 0; i < 6; i++) expect((await post(app, body)).statusCode).toBe(204);
    const res = await post(app, body);
    expect(res.statusCode).toBe(429);
    expect(Number(res.headers['retry-after'])).toBeGreaterThanOrEqual(1);
  });

  it('the default limiter (none injected) allows 6 per minute per device and answers the 7th with 429', async () => {
    const app = await build({ record: vi.fn() });
    const body = { engine: 'webspeech', deviceClass: 'ios', samples: [100] };
    for (let i = 0; i < 6; i++) expect((await post(app, body)).statusCode).toBe(204);
    const res = await post(app, body);
    expect(res.statusCode).toBe(429);
    expect(res.json().error).toBe('rate_limited');
  });

  it('limits per device, not globally', async () => {
    const app = await build({ record: vi.fn() });
    const body = { engine: 'webspeech', deviceClass: 'ios', samples: [100] };
    for (let i = 0; i < 7; i++) await post(app, body);
    const other = await app.inject({
      method: 'POST',
      url: '/api/captions/sli',
      headers: { 'x-device-id': '4f2b8c1e-5d4a-4b7e-9a1c-0e6d2f4a8b11' },
      payload: body,
    });
    expect(other.statusCode).toBe(204);
  });

  it('400 without a device id', async () => {
    const app = await build();
    const res = await app.inject({
      method: 'POST',
      url: '/api/captions/sli',
      payload: { engine: 'whisper', deviceClass: 'ios', samples: [1] },
    });
    expect(res.statusCode).toBe(400);
  });
});
