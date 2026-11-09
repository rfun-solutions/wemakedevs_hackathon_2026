import { describe, expect, it } from 'vitest';
import { naiveToUtc, toVenueIso } from './time';

describe('naiveToUtc (America/Denver)', () => {
  it('converts an MST date (UTC-7)', () => {
    expect(naiveToUtc('2026-11-10T09:00:00').toISOString()).toBe('2026-11-10T16:00:00.000Z');
  });
  it('converts an MDT date (UTC-6)', () => {
    expect(naiveToUtc('2026-10-20T09:00:00').toISOString()).toBe('2026-10-20T15:00:00.000Z');
  });
  it('handles the DST end boundary (2026-11-01)', () => {
    expect(naiveToUtc('2026-11-01T00:30:00').toISOString()).toBe('2026-11-01T06:30:00.000Z'); // MDT
    expect(naiveToUtc('2026-11-01T03:00:00').toISOString()).toBe('2026-11-01T10:00:00.000Z'); // MST
  });
  it('handles the DST start boundary (2026-03-08)', () => {
    expect(naiveToUtc('2026-03-08T01:00:00').toISOString()).toBe('2026-03-08T08:00:00.000Z'); // MST
    expect(naiveToUtc('2026-03-08T03:00:00').toISOString()).toBe('2026-03-08T09:00:00.000Z'); // MDT
  });
  it('accepts minutes-only strings and a space separator', () => {
    expect(naiveToUtc('2026-11-10 09:00').toISOString()).toBe('2026-11-10T16:00:00.000Z');
  });
  it('is not hard-wired to Denver', () => {
    expect(naiveToUtc('2026-11-10T09:00:00', 'UTC').toISOString()).toBe('2026-11-10T09:00:00.000Z');
  });
  it('throws on garbage and on offset-bearing strings', () => {
    expect(() => naiveToUtc('tomorrow')).toThrow();
    expect(() => naiveToUtc('2026-11-10T09:00:00Z')).toThrow();
    expect(() => naiveToUtc('')).toThrow();
  });
});

describe('toVenueIso', () => {
  it('renders -07:00 in MST and -06:00 in MDT', () => {
    expect(toVenueIso(new Date('2026-11-10T16:00:00Z'))).toBe('2026-11-10T09:00:00-07:00');
    expect(toVenueIso(new Date('2026-10-20T15:00:00Z'))).toBe('2026-10-20T09:00:00-06:00');
  });
  it('round-trips with naiveToUtc', () => {
    const n = '2026-11-12T13:45:00';
    expect(toVenueIso(naiveToUtc(n)).startsWith(n)).toBe(true);
  });
});
