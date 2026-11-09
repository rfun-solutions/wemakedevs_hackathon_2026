// Card text lookup by CARD language (independent of the UI language). Strings live in
// `i18n/<lang>/access-cards.json`; they are imported directly so a card can be shown in a
// language other than the UI language (spec: "Card language").
import en from '../../i18n/en/access-cards.json';
import es from '../../i18n/es/access-cards.json';
import ptBR from '../../i18n/pt-BR/access-cards.json';
import ar from '../../i18n/ar/access-cards.json';

export type CardLang = 'en' | 'es' | 'pt-BR' | 'ar';
export const CARD_LANGS: readonly CardLang[] = ['en', 'es', 'pt-BR', 'ar'];

/** Preset ids; the phrase key is `access.card.<id>`. Only the id is ever sent to telemetry. */
export const PRESET_IDS = ['deaf', 'slower', 'repeat', 'face', 'stutter', 'thanks'] as const;
export type PresetId = (typeof PRESET_IDS)[number];

const DICTS: Record<CardLang, Record<string, string>> = { en, es, 'pt-BR': ptBR, ar };

/** Text in a card language, falling back to English, then to the key. */
export function cardText(lang: CardLang, key: string, params?: Record<string, string>): string {
  const raw = DICTS[lang][key] ?? DICTS.en[key] ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, n: string) => params[n] ?? m);
}

export function isCardLang(v: unknown): v is CardLang {
  return typeof v === 'string' && (CARD_LANGS as readonly string[]).includes(v);
}

export function dirFor(lang: CardLang): 'rtl' | 'ltr' {
  return lang === 'ar' ? 'rtl' : 'ltr';
}

const KEY = 'kc.cardlang';
/** Card language: the saved choice, else the UI language when we have cards for it, else English. */
export function loadCardLang(uiLang: string): CardLang {
  try {
    const saved = globalThis.localStorage?.getItem(KEY);
    if (isCardLang(saved)) return saved;
  } catch {
    /* storage blocked: use the default */
  }
  return isCardLang(uiLang) ? uiLang : 'en';
}
export function saveCardLang(lang: CardLang): void {
  try {
    globalThis.localStorage?.setItem(KEY, lang);
  } catch {
    /* ignore */
  }
}
