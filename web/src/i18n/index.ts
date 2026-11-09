// i18n loader. Every `<lang>/*.json` file is merged BY KEY, never by file name, so a change can own
// its own file (e.g. `access-cards.json`). A key defined in two files is a bug and fails a unit test.
// Key prefixes follow the telemetry domain: app, access, pipeline, schedule, capture, status,
// captions, translate, threads, hood. The signature `t(key, params?)` is the stable contract.
// EN and ES have every key; PT-BR and AR are smoke level and fall back to EN per key.
import { useEffect, useState } from 'preact/hooks';

export type Lang = 'en' | 'es' | 'pt-BR' | 'ar';
export const LANGS: readonly Lang[] = ['en', 'es', 'pt-BR', 'ar'];
/** Languages written right to left. */
export const RTL_LANGS: readonly Lang[] = ['ar'];
/** Each language written in itself, for the language picker (never translated). */
export const LANG_NAMES: Record<Lang, string> = {
  en: 'English',
  es: 'Español',
  'pt-BR': 'Português (Brasil)',
  ar: 'العربية',
};

type Dict = Record<string, string>;
const files = import.meta.glob<Dict>('./*/*.json', { eager: true, import: 'default' });

export interface MergeResult {
  dict: Dict;
  duplicates: string[];
}

/** Merge per-file dictionaries for one language; reports keys defined in more than one file. */
export function mergeFiles(entries: Record<string, Dict>, lang: string): MergeResult {
  const dict: Dict = {};
  const duplicates: string[] = [];
  for (const [path, content] of Object.entries(entries)) {
    if (!path.startsWith(`./${lang}/`)) continue;
    for (const [key, value] of Object.entries(content)) {
      if (key in dict) duplicates.push(key);
      dict[key] = value;
    }
  }
  return { dict, duplicates };
}

const dicts = Object.fromEntries(LANGS.map((l) => [l, mergeFiles(files, l)])) as Record<
  Lang,
  MergeResult
>;

export function allKeys(lang: Lang): string[] {
  return Object.keys(dicts[lang].dict);
}
export function duplicateKeys(lang: Lang): string[] {
  return dicts[lang].duplicates;
}

/** Storage keys owned by i18n; F's Synthetic Kay seeds the language through this. */
export const LANG_STORAGE_KEY = 'kc.lang';
const STORAGE_KEY = LANG_STORAGE_KEY;

export function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && (LANGS as readonly string[]).includes(v);
}

/** Map a browser language tag such as `pt-PT` or `es-419` to a supported language, else EN. */
export function matchBrowserLang(tag: string | undefined): Lang {
  const l = (tag ?? '').toLowerCase();
  if (l.startsWith('es')) return 'es';
  if (l.startsWith('pt')) return 'pt-BR';
  if (l.startsWith('ar')) return 'ar';
  return 'en';
}

function detect(): Lang {
  try {
    const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch {
    /* storage unavailable: fall through to the browser language */
  }
  return matchBrowserLang(typeof navigator !== 'undefined' ? navigator.language : 'en');
}

let current: Lang = detect();
const listeners = new Set<(l: Lang) => void>();

/** Set `<html lang dir>` for a language (AR is right to left). */
export function applyDocumentLang(
  lang: Lang,
  doc: Document | undefined = globalThis.document,
): void {
  if (!doc) return;
  doc.documentElement.lang = lang;
  doc.documentElement.dir = RTL_LANGS.includes(lang) ? 'rtl' : 'ltr';
}

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore: preference just is not remembered */
  }
  applyDocumentLang(lang);
  listeners.forEach((fn) => fn(lang));
}

/** Subscribe to language changes; returns an unsubscribe function. */
export function onLangChange(fn: (l: Lang) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Active language, re-rendering the caller when it changes. */
export function useLang(): Lang {
  const [lang, setState] = useState<Lang>(current);
  useEffect(() => {
    setState(current);
    return onLangChange(setState);
  }, []);
  return lang;
}

/** Translate a key, falling back to English, then to the key itself. `{name}` params are filled in. */
export function t(key: string, params?: Record<string, string | number>): string {
  let raw = dicts[current].dict[key] ?? dicts.en.dict[key];
  if (raw === undefined) {
    if (import.meta.env?.DEV) console.warn(`i18n: missing key "${key}"`);
    raw = key;
  }
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in params ? String(params[name]) : m,
  );
}

/** Format a time in the active language. The caller always passes the time zone (never the device's). */
export function formatTime(date: Date | number, timeZone: string, lang: Lang = current): string {
  return new Intl.DateTimeFormat(lang, { hour: 'numeric', minute: '2-digit', timeZone }).format(
    date,
  );
}

/** Format a date in the active language, in an explicit time zone. */
export function formatDate(date: Date | number, timeZone: string, lang: Lang = current): string {
  return new Intl.DateTimeFormat(lang, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone,
  }).format(date);
}
