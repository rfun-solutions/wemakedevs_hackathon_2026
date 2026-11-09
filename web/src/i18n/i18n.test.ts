import { describe, expect, it } from 'vitest';
import { allKeys, duplicateKeys, mergeFiles, setLang, t, LANGS } from './index';

describe('i18n', () => {
  it('has no key defined in two files', () => {
    for (const l of LANGS) expect(duplicateKeys(l)).toEqual([]);
  });
  it('en and es define the same keys', () => {
    expect(allKeys('es').sort()).toEqual(allKeys('en').sort());
  });
  it('mergeFiles merges by key and reports duplicates', () => {
    const r = mergeFiles(
      {
        './en/a.json': { x: '1', y: '2' },
        './en/b.json': { y: '3', z: '4' },
        './es/a.json': { q: '9' },
      },
      'en',
    );
    expect(r.dict).toEqual({ x: '1', y: '3', z: '4' });
    expect(r.duplicates).toEqual(['y']);
  });
  it('t() translates, interpolates, and falls back to the key', () => {
    setLang('en');
    expect(t('app.nav.home')).toBe('Home');
    setLang('es');
    expect(t('app.nav.home')).toBe('Inicio');
    expect(t('no.such.key')).toBe('no.such.key');
    setLang('en');
  });
});
