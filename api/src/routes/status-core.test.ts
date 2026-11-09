import { describe, expect, it } from 'vitest';
import { RollingWindow, computeStatus, isMissingTable, medianRtt, parseRttBody } from './status-core';

describe('RollingWindow', () => {
  it('is null when empty', () => expect(new RollingWindow().p95()).toBeNull());
  it('computes nearest-rank p95', () => {
    const w = new RollingWindow();
    for (let i = 1; i <= 100; i++) w.push(i);
    expect(w.p95()).toBe(95);
  });
  it('keeps only the last N and ignores bad values', () => {
    const w = new RollingWindow(3);
    [1, 2, 3, 4, NaN, -1].forEach((n) => w.push(n));
    expect(w.count).toBe(3);
    expect(w.percentile(0)).toBe(2);
  });
});

describe('computeStatus', () => {
  const now = new Date('2026-11-09T18:00:00Z');
  it('computes feed age', () => {
    const s = computeStatus({ p95: 120, feedSyncedAt: new Date('2026-11-09T17:56:00Z'), now, chaosActive: true });
    expect(s).toEqual({ server_ms_p95: 120, feed_synced_at: '2026-11-09T17:56:00.000Z', feed_age_s: 240, slo_ms: 500, chaos_active: true });
  });
  it('handles missing feed (42P01 case) with nulls', () => {
    const s = computeStatus({ p95: null, feedSyncedAt: null, now, chaosActive: false });
    expect(s.feed_synced_at).toBeNull();
    expect(s.feed_age_s).toBeNull();
  });
  it('treats an invalid date as null and clamps future dates', () => {
    expect(computeStatus({ p95: 1, feedSyncedAt: 'garbage', now, chaosActive: false }).feed_synced_at).toBeNull();
    expect(computeStatus({ p95: 1, feedSyncedAt: new Date('2026-11-09T19:00:00Z'), now, chaosActive: false }).feed_age_s).toBe(0);
  });
});

describe('helpers', () => {
  it('detects 42P01', () => {
    expect(isMissingTable({ code: '42P01' })).toBe(true);
    expect(isMissingTable({ code: '23505' })).toBe(false);
    expect(isMissingTable(null)).toBe(false);
  });
  it('median', () => {
    expect(medianRtt([])).toBeNull();
    expect(medianRtt([300, 100, 200])).toBe(200);
    expect(medianRtt([100, 200])).toBe(150);
  });
  it('rtt body validation', () => {
    expect(parseRttBody({ rtt_ms: 120 })).toBe(120);
    for (const b of [null, {}, { rtt_ms: '1' }, { rtt_ms: -1 }, { rtt_ms: 70000 }, { rtt_ms: NaN }]) {
      expect(parseRttBody(b)).toBeNull();
    }
  });
});
