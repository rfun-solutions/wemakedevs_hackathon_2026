import { describe, expect, it } from 'vitest';
import { estimateCostUsd, PRICES } from './pricing.js';

describe('pricing', () => {
  it('matches the design table', () => {
    expect(PRICES['claude-haiku-5-5']).toEqual({ inPerMTok: 0.1, outPerMTok: 0.5 });
    expect(PRICES['claude-sonnet-5-5']).toEqual({ inPerMTok: 2, outPerMTok: 10 });
  });
  it('estimates cost per million tokens', () => {
    expect(estimateCostUsd('claude-haiku-5-5', 1_000_000, 1_000_000)).toBeCloseTo(0.6, 10);
    expect(estimateCostUsd('claude-sonnet-5-5', 1000, 500)).toBeCloseTo(0.007, 10);
  });
  it('returns 0 for an unknown model', () => {
    expect(estimateCostUsd('mystery', 100, 100)).toBe(0);
  });
});
