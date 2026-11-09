// i18n loader. Every `<lang>/*.json` file is merged BY KEY, never by file name, so a change can own
// its own file (e.g. `access-cards.json`). A key defined in two files is a bug and fails a unit test.
// Key prefixes follow the telemetry domain: app, access, pipeline, schedule, capture, status,
// captions, translate, threads, hood. The signature `t(key, params?)` is the stable contract.
export type Lang = 'en' | 'es';
export const LANGS: readonly Lang[] = ['en', 'es'];

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

const dicts: Record<Lang, MergeResult> = {
  en: mergeFiles(files, 'en'),
  es: mergeFiles(files, 'es'),
};

export function allKeys(lang: Lang): string[] {
  return Object.keys(dicts[lang].dict);
}
export function duplicateKeys(lang: Lang): string[] {
  return dicts[lang].duplicates;
}

const STORAGE_KEY = 'kc.lang';

function detect(): Lang {
  try {
    const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'es') return saved;
  } catch {
    /* storage unavailable: fall through to the browser language */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en';
  return nav.toLowerCase().startsWith('es') ? 'es' : 'en';
}

let current: Lang = detect();

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
}

/** Translate a key, falling back to English, then to the key itself. `{name}` params are filled in. */
export function t(key: string, params?: Record<string, string | number>): string {
  const raw = dicts[current].dict[key] ?? dicts.en.dict[key] ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in params ? String(params[name]) : m,
  );
}
