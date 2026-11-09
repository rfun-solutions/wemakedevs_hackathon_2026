import { describe, expect, it, vi } from 'vitest';
import { span } from './telemetry';
import { fetchCaptionsHealth, HEALTH_TIMEOUT_MS } from './health';

const json = (b: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(b), { status }));
const f = (impl: () => Promise<Response>) => vi.fn(impl) as unknown as typeof fetch;

describe('fetchCaptionsHealth', () => {
  it('returns a faster engine and lagging flag', async () => {
    const fn = f(() =>
      json({ source: 'live', captions: { fasterEngine: 'webspeech', lagging: true } }),
    );
    expect(await fetchCaptionsHealth('desktop', fn)).toEqual({
      fasterEngine: 'webspeech',
      lagging: true,
    });
    expect((fn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toBe(
      '/api/status/health?deviceClass=desktop',
    );
  });
  it('null faster engine (iOS) still reports lagging', async () => {
    expect(
      await fetchCaptionsHealth(
        'ios',
        f(() => json({ captions: { fasterEngine: null, lagging: true } })),
      ),
    ).toEqual({ fasterEngine: null, lagging: true });
  });
  it('404, source unavailable, bad body and network error mean no hint', async () => {
    const none = { fasterEngine: null, lagging: false };
    expect(
      await fetchCaptionsHealth(
        'desktop',
        f(() => json({}, 404)),
      ),
    ).toEqual(none);
    expect(
      await fetchCaptionsHealth(
        'desktop',
        f(() =>
          json({ source: 'unavailable', captions: { fasterEngine: 'whisper', lagging: true } }),
        ),
      ),
    ).toEqual(none);
    expect(
      await fetchCaptionsHealth(
        'desktop',
        f(() => json({ captions: { fasterEngine: 'bogus' } })),
      ),
    ).toEqual({ fasterEngine: null, lagging: false });
    expect(
      await fetchCaptionsHealth(
        'desktop',
        f(() => Promise.reject(new Error('x'))),
      ),
    ).toEqual(none);
  });
  it('times out even when fetch ignores abort and records the result', async () => {
    vi.useFakeTimers();
    const spanSpy = vi.spyOn(span, 'healthFetch');
    let signal: AbortSignal | undefined;
    const hang = ((_url: string, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    }) as typeof fetch;
    try {
      const pending = fetchCaptionsHealth('desktop', hang, HEALTH_TIMEOUT_MS);
      await vi.advanceTimersByTimeAsync(HEALTH_TIMEOUT_MS);
      expect(await pending).toEqual({ fasterEngine: null, lagging: false });
      expect(signal?.aborted).toBe(true);
      expect(spanSpy).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'timeout' }));
    } finally {
      vi.useRealTimers();
      spanSpy.mockRestore();
    }
  });
});
