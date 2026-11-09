import { describe, expect, it } from 'vitest';
import { computeVerdict, savedLabel } from './verdict';

const base = { online: true, rttMs: 50, serverP95: 120, sloMs: 500 };

describe('computeVerdict', () => {
  it('slow connection, server within SLO', () => {
    expect(computeVerdict({ ...base, rttMs: 650 })).toBe('connection_slow');
  });
  it('slow server wins over a slow connection', () => {
    expect(computeVerdict({ ...base, rttMs: 650, serverP95: 900 })).toBe('server_slow');
  });
  it('all good', () => expect(computeVerdict(base)).toBe('all_good'));
  it('offline never depends on numbers', () => {
    expect(computeVerdict({ ...base, online: false, serverP95: 9999 })).toBe('offline');
  });
  it('boundaries are not slow', () => {
    expect(computeVerdict({ ...base, rttMs: 400, serverP95: 500 })).toBe('all_good');
  });
  it('unknown with no data at all; server-only data still all_good', () => {
    expect(computeVerdict({ ...base, rttMs: null, serverP95: null })).toBe('unknown');
    expect(computeVerdict({ ...base, rttMs: null })).toBe('all_good');
  });
});

describe('savedLabel', () => {
  it('null save time hides the line', () =>
    expect(savedLabel(null)).toEqual({ shown: false, ms: null }));
  it('rounds', () => expect(savedLabel(41.6)).toEqual({ shown: true, ms: 42 }));
  it('rejects negatives/NaN', () => {
    expect(savedLabel(-1).shown).toBe(false);
    expect(savedLabel(NaN).shown).toBe(false);
  });
});
