import { describe, expect, it } from 'vitest';
import { allKeys } from '../i18n';
import { ENTRIES } from './registry';
import { validateEntry } from './validate';

const files = import.meta.glob('./entries/*.json', { eager: true, import: 'default' });
const keys = { en: new Set(allKeys('en')), es: new Set(allKeys('es')) };

describe('under-the-hood registry', () => {
  it('every entry validates (schema, id equals file name, i18n keys in en and es)', () => {
    const errs = Object.entries(files).flatMap(([path, e]) =>
      validateEntry(e, path.replace('./entries/', '').replace('.json', ''), keys),
    );
    expect(errs).toEqual([]);
  });
  it('ids are unique and entries sorted by order', () => {
    const ids = ENTRIES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ENTRIES.map((e) => e.order)).toEqual([...ENTRIES.map((e) => e.order)].sort((a, b) => a - b));
  });
  it('validateEntry rejects bad entries', () => {
    expect(validateEntry({ id: 'x', order: 0, titleKey: 'nope', whatKey: 'app.hood.what', promises: [], tech: [] }, 'y', keys).length).toBeGreaterThan(3);
  });
});
