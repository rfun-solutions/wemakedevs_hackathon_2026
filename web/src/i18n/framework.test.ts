import { afterEach, describe, expect, it } from 'vitest';
import {
  LANGS,
  allKeys,
  applyDocumentLang,
  formatTime,
  matchBrowserLang,
  setLang,
  t,
} from './index';

afterEach(() => setLang('en'));

describe('i18n framework (D)', () => {
  it('ES covers every EN key', () => {
    const es = new Set(allKeys('es'));
    expect(allKeys('en').filter((k) => !es.has(k))).toEqual([]);
  });

  it('PT-BR and AR cover the shell (app.*) and display/promise (access.*) keys', () => {
    for (const l of ['pt-BR', 'ar'] as const) {
      const have = new Set(allKeys(l));
      const need = allKeys('en').filter((k) => k.startsWith('app.') || k.startsWith('access.'));
      expect(
        need.filter((k) => !have.has(k)),
        l,
      ).toEqual([]);
    }
  });

  it('falls back to EN for a key missing in PT-BR, then to the key', () => {
    const pt = new Set(allKeys('pt-BR'));
    const enOnly = allKeys('en').find((k) => !pt.has(k));
    setLang('en');
    const expected = enOnly ? t(enOnly) : undefined;
    setLang('pt-BR');
    expect(t('app.nav.home')).toBe('Início');
    if (enOnly) expect(t(enOnly)).toBe(expected);
    expect(t('no.such.key')).toBe('no.such.key');
  });

  it('interpolates {param} and leaves unknown params in place', () => {
    setLang('en');
    expect(t('access.settings.type.value', { percent: 150 })).toBe('150%');
    expect(t('access.settings.lang.announce', {})).toBe('Language changed to {name}');
  });

  it('setLang switches <html lang> and dir (AR is rtl)', () => {
    setLang('ar');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    setLang('es');
    expect(document.documentElement.lang).toBe('es');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('applyDocumentLang tolerates a missing document', () => {
    expect(() => applyDocumentLang('en', undefined)).not.toThrow();
  });

  it('maps browser tags to supported languages', () => {
    expect(matchBrowserLang('es-419')).toBe('es');
    expect(matchBrowserLang('pt-PT')).toBe('pt-BR');
    expect(matchBrowserLang('ar-EG')).toBe('ar');
    expect(matchBrowserLang('fr')).toBe('en');
    expect(matchBrowserLang(undefined)).toBe('en');
  });

  it('formatTime uses the explicit time zone, not the device zone', () => {
    const d = new Date('2026-11-10T17:00:00Z');
    expect(formatTime(d, 'America/Denver', 'en')).toMatch(/10:00\s?AM/);
    expect(formatTime(d, 'Asia/Tokyo', 'en')).toMatch(/2:00\s?AM/);
  });

  it('lists four languages', () => {
    expect([...LANGS]).toEqual(['en', 'es', 'pt-BR', 'ar']);
  });
});
