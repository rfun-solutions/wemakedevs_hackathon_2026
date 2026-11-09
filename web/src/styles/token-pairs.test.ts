import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  TOKEN_PAIRS,
  TOKEN_PAIRS_HIGH,
  checkPairs,
  contrastRatio,
  parseTokens,
} from './token-pairs';

const css = readFileSync(resolve(__dirname, 'tokens.css'), 'utf8');
const rootBlock = /:root\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
const highBlock = /html\[data-contrast=['"]high['"]\]\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
const defaults = parseTokens(rootBlock);
const high = { ...defaults, ...parseTokens(highBlock) };

describe('contrast helper', () => {
  it('black on white is 21:1 and same colour is 1:1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#123456', '#123456')).toBeCloseTo(1, 5);
  });

  it('failure message names pair, ratio, minimum and colours', () => {
    const msgs = checkPairs([{ fg: '--a', bg: '--b', min: 4.5, kind: 'text' }], {
      '--a': '#777777',
      '--b': '#888888',
    });
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatch(/--a on --b is 1\.\d\d:1, minimum 4\.5:1 \(#777777 on #888888\)/);
  });

  it('reports a missing token instead of passing', () => {
    expect(checkPairs([{ fg: '--x', bg: '--y', min: 3, kind: 'ui' }], {})).toHaveLength(1);
  });
});

describe('token pairs', () => {
  it('default set meets its minimums', () => {
    expect(checkPairs(TOKEN_PAIRS, defaults)).toEqual([]);
  });

  it('high-contrast set meets its minimums', () => {
    expect(checkPairs(TOKEN_PAIRS_HIGH, high)).toEqual([]);
  });
});
