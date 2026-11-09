// Client translation: Chrome's built-in Translator when available, otherwise POST /api/translate.
// ONE handler per session: each segment id is translated at most once (the T4 test page bound its handler
// twice and translated every segment twice; the unit test pins one call per segment).
import { api } from '../api';
import { emit } from '../speech/telemetry';

export type TranslateTarget = 'en' | 'es' | 'pt-BR' | 'ar';

/** Thrown when neither path can translate (429, 503 including daily_cap, network). The caller keeps the original. */
export class TranslateUnavailableError extends Error {
  constructor(readonly reason: string) {
    super(`translate unavailable (${reason})`);
    this.name = 'TranslateUnavailableError';
  }
}

export type TranslateFn = (text: string) => Promise<string>;

/** Server path. Never throws anything but TranslateUnavailableError. */
export async function translateViaServer(text: string, target: TranslateTarget): Promise<string> {
  let res: Response;
  try {
    res = await api('/api/translate', { method: 'POST', body: JSON.stringify({ text, target }) });
  } catch {
    throw new TranslateUnavailableError('network');
  }
  if (!res.ok) throw new TranslateUnavailableError(String(res.status));
  const body = (await res.json().catch(() => null)) as { text?: unknown } | null;
  if (typeof body?.text !== 'string') throw new TranslateUnavailableError('bad_response');
  return body.text;
}

interface ChromeTranslator {
  translate(text: string): Promise<string>;
}
interface ChromeDetector {
  detect(text: string): Promise<{ detectedLanguage: string; confidence: number }[]>;
}
interface TranslatorStatic {
  availability(o: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
  create(o: { sourceLanguage: string; targetLanguage: string }): Promise<ChromeTranslator>;
}
interface DetectorStatic {
  create(): Promise<ChromeDetector>;
}

/**
 * Chrome on-device path, or null when `Translator` / `LanguageDetector` are missing or the pair is not
 * supported. `create()` needs a user gesture, so call this from the Translate toggle's click handler.
 */
export async function createChromeTranslate(
  target: TranslateTarget,
  g: Record<string, unknown> = globalThis as unknown as Record<string, unknown>,
): Promise<TranslateFn | null> {
  const T = g.Translator as TranslatorStatic | undefined;
  const D = g.LanguageDetector as DetectorStatic | undefined;
  if (!T || !D) return null;
  try {
    const detector = await D.create();
    const translators = new Map<string, ChromeTranslator | null>();
    const forSource = async (source: string): Promise<ChromeTranslator | null> => {
      if (translators.has(source)) return translators.get(source) ?? null;
      let tr: ChromeTranslator | null = null;
      try {
        const a = await T.availability({ sourceLanguage: source, targetLanguage: target });
        if (a !== 'unavailable')
          tr = await T.create({ sourceLanguage: source, targetLanguage: target });
      } catch {
        tr = null;
      }
      translators.set(source, tr);
      return tr;
    };
    // Warm the common pair inside the gesture so a model download is allowed to start.
    if (target !== 'en') await forSource('en');
    return async (text) => {
      const top = (await detector.detect(text))[0];
      if (!top || top.confidence < 0.5) throw new TranslateUnavailableError('undetected');
      if (top.detectedLanguage.split('-')[0] === target.split('-')[0]) return text;
      const tr = await forSource(top.detectedLanguage);
      if (!tr) throw new TranslateUnavailableError('pair_unavailable');
      return tr.translate(text);
    };
  } catch {
    return null;
  }
}

export interface TranslateHandler {
  /** Translates segment `id` once; repeat calls with the same id return the same promise. */
  translate(id: string, text: string): Promise<string>;
}

/** The single handler. Chrome first, then the server; reports `kc_translate_total{path}` per call. */
export function createTranslateHandler(
  target: TranslateTarget,
  chrome: TranslateFn | null,
  server: (text: string, target: TranslateTarget) => Promise<string> = translateViaServer,
): TranslateHandler {
  const done = new Map<string, Promise<string>>();
  return {
    translate(id, text) {
      let p = done.get(id);
      if (!p) {
        p = (async () => {
          if (chrome) {
            try {
              const out = await chrome(text);
              emit('kc_translate_total', { value: 1, path: 'chrome' });
              return out;
            } catch {
              /* fall through to the server */
            }
          }
          const out = await server(text, target);
          emit('kc_translate_total', { value: 1, path: 'server' });
          return out;
        })();
        done.set(id, p);
      }
      return p;
    },
  };
}
