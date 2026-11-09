import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDeviceId } from '../device';
import { createSliReporter } from './reporter';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup() {
  const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  const target = new EventTarget();
  const r = createSliReporter({
    deviceClass: 'desktop',
    fetchFn: fetchFn as unknown as typeof fetch,
    target,
  });
  return { fetchFn, target, r };
}

describe('sli reporter', () => {
  it('flushes every 10 s with X-Device-Id and keepalive', async () => {
    const { fetchFn, r } = setup();
    r.start();
    r.add('whisper', 1200.4);
    r.add('whisper', 3000);
    expect(fetchFn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10_000);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('/api/captions/sli');
    expect(init.keepalive).toBe(true);
    expect(init.method).toBe('POST');
    expect(init.headers['X-Device-Id']).toBe(getDeviceId());
    expect(JSON.parse(init.body)).toEqual({
      engine: 'whisper',
      deviceClass: 'desktop',
      samples: [1200, 3000],
    });
    r.stop();
  });
  it('sends nothing when empty', () => {
    const { fetchFn, r } = setup();
    r.start();
    vi.advanceTimersByTime(30_000);
    r.stop();
    expect(fetchFn).not.toHaveBeenCalled();
  });
  it('flushes on stop and on pagehide', () => {
    const { fetchFn, target, r } = setup();
    r.start();
    r.add('webspeech', 500);
    target.dispatchEvent(new Event('pagehide'));
    expect(fetchFn).toHaveBeenCalledTimes(1);
    r.add('webspeech', 700);
    r.stop();
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn.mock.calls[1]![1].keepalive).toBe(true);
  });
  it('caps a request at 20 samples and clamps out-of-range values', () => {
    const { fetchFn, r } = setup();
    for (let i = 0; i < 20; i++) r.add('webspeech', i === 0 ? 999_999 : 100);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchFn.mock.calls[0]![1].body);
    expect(body.samples).toHaveLength(20);
    expect(body.samples[0]).toBe(120_000);
  });
  it('flushes the old engine batch when the engine changes', () => {
    const { fetchFn, r } = setup();
    r.add('whisper', 5000);
    r.add('webspeech', 400);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchFn.mock.calls[0]![1].body).engine).toBe('whisper');
  });
  it('a failing fetch never throws', () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('net'));
    const r = createSliReporter({
      deviceClass: 'ios',
      fetchFn: fetchFn as unknown as typeof fetch,
      target: new EventTarget(),
    });
    r.add('webspeech', 1);
    expect(() => r.flush()).not.toThrow();
  });
});
