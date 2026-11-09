import { describe, expect, it } from 'vitest';
import {
  formatDay,
  formatTimeRange,
  groupByDay,
  location,
  warningMessage,
  warningsByTarget,
  zoneAbbr,
} from './scheduleFormat';
import type { BuildingWarning } from './scheduleApi';

describe('venue-time formatting', () => {
  it('shows Denver time and MST/MDT regardless of the browser zone', () => {
    const mst = { startsAt: '2026-11-10T09:00:00-07:00', endsAt: '2026-11-10T09:35:00-07:00' };
    expect(formatTimeRange(mst, 'en-US')).toMatch(/^9:00\sAM – 9:35\sAM MST$/);
    expect(zoneAbbr('2026-10-20T09:00:00-06:00')).toBe('MDT');
  });
  it('formats a day label without drifting across zones', () => {
    expect(formatDay('2026-11-10', 'en-US')).toBe('Tue, Nov 10');
    expect(formatDay('2026-11-10', 'es-ES')).toMatch(/mar/i);
  });
  it('joins location parts and skips empty ones', () => {
    expect(location({ building: 'Salt Palace', level: null, room: 'Hall A' })).toBe(
      'Salt Palace · Hall A',
    );
  });
  it('groups by venue day, not UTC day', () => {
    const g = groupByDay([
      { startsAt: '2026-11-10T20:00:00-07:00' }, // 03:00Z next day
      { startsAt: '2026-11-11T09:00:00-07:00' },
    ]);
    expect(g.map(([d]) => d)).toEqual(['2026-11-10', '2026-11-11']);
  });
});

const w = (over: Partial<BuildingWarning>): BuildingWarning => ({
  level: 'tight',
  fromSessionId: 'a',
  toSessionId: 'b',
  gapMinutes: 5,
  walkMinutes: 10,
  fromBuilding: 'Salt Palace',
  toBuilding: 'Hyatt Regency',
  ...over,
});

describe('warningMessage', () => {
  it('tight, ok and overlap map to different keys', () => {
    expect(warningMessage(w({})).key).toBe('schedule.warning.tight');
    expect(warningMessage(w({ level: 'ok', gapMinutes: 15 })).key).toBe('schedule.warning.ok');
    const o = warningMessage(w({ gapMinutes: -5 }));
    expect(o.key).toBe('schedule.warning.overlap');
    expect(o.params.gap).toBe(0);
  });
  it('keys warnings by the target session', () => {
    expect(warningsByTarget([w({})]).get('b')?.gapMinutes).toBe(5);
  });
});
