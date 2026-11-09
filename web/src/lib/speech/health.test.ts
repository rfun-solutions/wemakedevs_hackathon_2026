import { describe, expect, it, vi } from 'vitest';
import { fetchCaptionsHealth } from './health';

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
  it('times out after the given limit', async () => {
    const hang = ((_: string, init?: RequestInit) =>
      new Promise((_res, rej) =>
        init?.signal?.addEventListener('abort', () => rej(new Error('abort'))),
      )) as unknown as typeof fetch;
    expect(await fetchCaptionsHealth('desktop', hang, 20)).toEqual({
      fasterEngine: null,
      lagging: false,
    });
  });
});
