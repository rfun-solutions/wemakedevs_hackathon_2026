import { describe, expect, it } from 'vitest';
import { DEFAULT_CHAOS, getChaos } from './chaos.js';

describe('chaos stub', () => {
  it('always returns the default flags and never throws', () => {
    expect(DEFAULT_CHAOS).toEqual({ latencyMs: 0, errorRate: 0, naive: false });
    expect(getChaos('agenda')).toBe(DEFAULT_CHAOS);
    expect(getChaos('')).toBe(DEFAULT_CHAOS);
  });
});
