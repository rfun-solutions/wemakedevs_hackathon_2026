import { describe, expect, it } from 'vitest';
import { dailyCapUsd, decideCap, DEFAULT_DAILY_CAP_USD, worstCaseCostUsd } from './costGuard.js';

describe('dailyCapUsd', () => {
  it('defaults to 0.05 and accepts 0', () => {
    expect(dailyCapUsd({})).toBe(DEFAULT_DAILY_CAP_USD);
    expect(dailyCapUsd({ THREADS_DAILY_CAP_USD: '0' })).toBe(0);
    expect(dailyCapUsd({ THREADS_DAILY_CAP_USD: '0.2' })).toBe(0.2);
    expect(dailyCapUsd({ THREADS_DAILY_CAP_USD: 'abc' })).toBe(DEFAULT_DAILY_CAP_USD);
    expect(dailyCapUsd({ THREADS_DAILY_CAP_USD: '-1' })).toBe(DEFAULT_DAILY_CAP_USD);
  });
});

describe('cost estimates and decision', () => {
  it('worst case for Haiku with a full prompt is well under the default cap', () => {
    expect(worstCaseCostUsd('claude-haiku-5-5', 12_000, 2048)).toBeLessThan(0.01);
  });
  it('prices unknown models like Sonnet so the cap is never bypassed', () => {
    expect(worstCaseCostUsd('mystery', 3000, 1000)).toBe(
      worstCaseCostUsd('claude-sonnet-5-5', 3000, 1000),
    );
    expect(worstCaseCostUsd('mystery', 3000, 1000)).toBeGreaterThan(0);
  });
  it('allows up to and including the cap, blocks above', () => {
    expect(decideCap(0.04, 0.01, 0.05).allowed).toBe(true);
    expect(decideCap(0.045, 0.01, 0.05).allowed).toBe(false);
    expect(decideCap(0, 0.001, 0).allowed).toBe(false);
  });
});
