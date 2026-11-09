import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PROMISES } from '../src/features/access/promises';

const root = resolve(__dirname, '../..');
const load = (lang: string): Record<string, string> =>
  JSON.parse(readFileSync(resolve(root, `web/src/i18n/${lang}/access.json`), 'utf8'));

const reviewDir = resolve(root, '.gitar/review');
const reviewLines = existsSync(reviewDir)
  ? readdirSync(reviewDir)
      .filter((f) => f.endsWith('.md'))
      .flatMap((f) => readFileSync(resolve(reviewDir, f), 'utf8').split('\n'))
  : [];

describe('access promises', () => {
  it('has five ids in order', () => {
    expect(PROMISES.map((p) => p.id)).toEqual(['P1', 'P2', 'P3', 'P4', 'P5']);
  });

  it('titleKey is access.promise.<id> and exists in EN and ES', () => {
    const en = load('en');
    const es = load('es');
    for (const p of PROMISES) {
      expect(p.titleKey).toBe(`access.promise.${p.id}`);
      expect(en[p.titleKey], `EN missing ${p.titleKey}`).toBeTruthy();
      expect(es[p.titleKey], `ES missing ${p.titleKey}`).toBeTruthy();
    }
  });

  it('every IN-, DD- and A11Y- rule appears in a .gitar/review file next to its promise id', () => {
    for (const p of PROMISES) {
      for (const rule of p.ruleIds.filter((r) => /^(IN|DD|A11Y)-/.test(r))) {
        const ruleRe = new RegExp(`\\b${rule}(?!\\d)`);
        const promiseRe = new RegExp(`\\b${p.id}\\b`);
        const ok = reviewLines.some((l) => ruleRe.test(l) && promiseRe.test(l));
        expect(ok, `${rule} must appear with ${p.id} on one line in .gitar/review/*.md`).toBe(true);
      }
    }
  });
});
