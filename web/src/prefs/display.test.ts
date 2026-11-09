import { describe, expect, it, vi } from 'vitest';
import {
  PREFS_STORAGE_KEYS,
  applyPrefs,
  clampTypeScale,
  readStored,
  resolvePrefs,
  setPrefs,
} from './display';

const store = (v: string | null) => ({ getItem: () => v });
const win = (matches: Record<string, boolean>) => ({
  matchMedia: (q: string) => ({ matches: !!matches[q] }) as MediaQueryList,
});

describe('display prefs', () => {
  it('exports the storage keys F seeds through', () => {
    expect(PREFS_STORAGE_KEYS.display).toBe('kc.display.v1');
    expect(PREFS_STORAGE_KEYS.lang).toBe('kc.lang');
  });

  it('clamps and steps the type scale', () => {
    expect(clampTypeScale(0.5)).toBe(1);
    expect(clampTypeScale(3)).toBe(2);
    expect(clampTypeScale(1.46)).toBe(1.5);
    expect(clampTypeScale('x')).toBe(1);
  });

  it('defaults: Atkinson, normal contrast, normal motion', () => {
    expect(resolvePrefs(store(null), win({}))).toEqual({
      typeScale: 1,
      font: 'atkinson',
      contrast: 'normal',
      motion: 'normal',
    });
  });

  it('honours prefers-contrast and prefers-reduced-motion when nothing is saved', () => {
    const p = resolvePrefs(
      store(null),
      win({ '(prefers-contrast: more)': true, '(prefers-reduced-motion: reduce)': true }),
    );
    expect(p.contrast).toBe('high');
    expect(p.motion).toBe('reduced');
  });

  it('a saved choice overrides the system value', () => {
    const p = resolvePrefs(
      store(JSON.stringify({ contrast: 'normal', motion: 'normal', typeScale: 1.5 })),
      win({ '(prefers-contrast: more)': true, '(prefers-reduced-motion: reduce)': true }),
    );
    expect(p).toMatchObject({ contrast: 'normal', motion: 'normal', typeScale: 1.5 });
  });

  it('ignores junk and storage that throws', () => {
    expect(readStored(store('{not json'))).toEqual({});
    expect(readStored(store(JSON.stringify({ font: 'comic', typeScale: 'big' })))).toEqual({});
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readStored(throwing)).toEqual({});
    expect(resolvePrefs(throwing, win({})).typeScale).toBe(1);
  });

  it('applyPrefs writes the html attributes', () => {
    const root = document.createElement('html');
    applyPrefs({ typeScale: 1.5, font: 'system', contrast: 'high', motion: 'reduced' }, root);
    expect(root.getAttribute('data-type-scale')).toBe('1.5');
    expect(root.style.getPropertyValue('--type-scale')).toBe('1.5');
    expect(root.getAttribute('data-font')).toBe('system');
    expect(root.getAttribute('data-contrast')).toBe('high');
    expect(root.getAttribute('data-motion')).toBe('reduced');
    applyPrefs({ typeScale: 1, font: 'atkinson', contrast: 'normal', motion: 'normal' }, root);
    expect(root.hasAttribute('data-contrast')).toBe(false);
    expect(root.hasAttribute('data-motion')).toBe(false);
  });

  it('setPrefs persists, notifies, and survives blocked storage', () => {
    const next = setPrefs({ typeScale: 1.7, contrast: 'high' });
    expect(next.typeScale).toBe(1.7);
    expect(JSON.parse(localStorage.getItem(PREFS_STORAGE_KEYS.display)!)).toMatchObject({
      typeScale: 1.7,
      contrast: 'high',
    });
    expect(document.documentElement.getAttribute('data-contrast')).toBe('high');
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => setPrefs({ motion: 'reduced' })).not.toThrow();
    expect(document.documentElement.getAttribute('data-motion')).toBe('reduced');
    spy.mockRestore();
    setPrefs({ typeScale: 1, contrast: 'normal', motion: 'normal' });
  });
});
