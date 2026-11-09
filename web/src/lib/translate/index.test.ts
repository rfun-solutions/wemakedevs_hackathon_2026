import { describe, expect, it, vi } from 'vitest';

vi.mock('../speech/telemetry', () => ({ emit: vi.fn() }));
const apiMock = vi.fn();
vi.mock('../api', () => ({ api: (...a: unknown[]) => apiMock(...a) }));

import {
  TranslateUnavailableError,
  createChromeTranslate,
  createTranslateHandler,
  translateViaServer,
} from './index';

describe('createTranslateHandler', () => {
  it('makes one call per segment even when asked repeatedly', async () => {
    const server = vi.fn().mockResolvedValue('hola');
    const h = createTranslateHandler('es', null, server);
    await Promise.all([h.translate('s1', 'hello'), h.translate('s1', 'hello')]);
    await h.translate('s1', 'hello');
    expect(server).toHaveBeenCalledTimes(1);
    await h.translate('s2', 'bye');
    expect(server).toHaveBeenCalledTimes(2);
  });

  it('prefers Chrome and does not call the server', async () => {
    const chrome = vi.fn().mockResolvedValue('hola');
    const server = vi.fn();
    const out = await createTranslateHandler('es', chrome, server).translate('s1', 'hello');
    expect(out).toBe('hola');
    expect(chrome).toHaveBeenCalledTimes(1);
    expect(server).not.toHaveBeenCalled();
  });

  it('falls back to the server when Chrome fails', async () => {
    const chrome = vi.fn().mockRejectedValue(new Error('x'));
    const server = vi.fn().mockResolvedValue('hola');
    expect(await createTranslateHandler('es', chrome, server).translate('s1', 'hi')).toBe('hola');
  });
});

describe('timeouts and retries', () => {
  it('falls back to the server when Chrome stalls', async () => {
    const chrome = vi.fn().mockReturnValue(new Promise(() => undefined));
    const server = vi.fn().mockResolvedValue('hola');
    const h = createTranslateHandler('es', chrome, server, 20);
    expect(await h.translate('s1', 'hi')).toBe('hola');
    expect(server).toHaveBeenCalledTimes(1);
  });

  it('forgets a failed segment so it can be retried', async () => {
    const server = vi
      .fn()
      .mockRejectedValueOnce(new TranslateUnavailableError('429'))
      .mockResolvedValue('hola');
    const h = createTranslateHandler('es', null, server);
    await expect(h.translate('s1', 'hi')).rejects.toBeInstanceOf(TranslateUnavailableError);
    expect(await h.translate('s1', 'hi')).toBe('hola');
  });
});

describe('createChromeTranslate', () => {
  it('is null without Translator or LanguageDetector', async () => {
    expect(await createChromeTranslate('es', {})).toBeNull();
    expect(await createChromeTranslate('es', { Translator: {} })).toBeNull();
  });

  it('detects the source, translates, and skips same-language lines', async () => {
    const translate = vi.fn().mockResolvedValue('hola');
    const g = {
      Translator: {
        availability: vi.fn().mockResolvedValue('available'),
        create: vi.fn().mockResolvedValue({ translate }),
      },
      LanguageDetector: {
        create: async () => ({
          detect: async (t: string) => [
            { detectedLanguage: t === 'hola' ? 'es' : 'en', confidence: 0.9 },
          ],
        }),
      },
    };
    const fn = (await createChromeTranslate('es', g))!;
    expect(await fn('hello')).toBe('hola');
    expect(await fn('hola')).toBe('hola');
    expect(translate).toHaveBeenCalledTimes(1);
  });
});

describe('translateViaServer', () => {
  it('returns the text on 200', async () => {
    apiMock.mockResolvedValue({ ok: true, json: async () => ({ text: 'hola' }) });
    expect(await translateViaServer('hi', 'es')).toBe('hola');
  });
  it.each([503, 429])('throws TranslateUnavailableError on %i', async (status) => {
    apiMock.mockResolvedValue({ ok: false, status });
    await expect(translateViaServer('hi', 'es')).rejects.toBeInstanceOf(TranslateUnavailableError);
  });
  it('throws TranslateUnavailableError when offline', async () => {
    apiMock.mockRejectedValue(new TypeError('fail'));
    await expect(translateViaServer('hi', 'es')).rejects.toBeInstanceOf(TranslateUnavailableError);
  });
});
