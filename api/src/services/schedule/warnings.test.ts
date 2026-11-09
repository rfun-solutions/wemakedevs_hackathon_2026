import { describe, expect, it } from 'vitest';
import { buildingWarnings, walkMinutesFromEnv, type AgendaSession } from './warnings';

const s = (id: string, start: string, end: string, building: string | null): AgendaSession => ({
  id,
  startsAt: new Date(start),
  endsAt: new Date(end),
  building,
});

describe('buildingWarnings', () => {
  it('flags a tight transfer (5 min gap, 10 min buffer)', () => {
    const w = buildingWarnings(
      [
        s('a', '2026-11-10T16:15:00Z', '2026-11-10T16:50:00Z', 'Salt Palace'),
        s('b', '2026-11-10T16:55:00Z', '2026-11-10T17:30:00Z', 'Hyatt Regency'),
      ],
      10,
    );
    expect(w).toEqual([
      {
        level: 'tight',
        fromSessionId: 'a',
        toSessionId: 'b',
        gapMinutes: 5,
        walkMinutes: 10,
        fromBuilding: 'Salt Palace',
        toBuilding: 'Hyatt Regency',
      },
    ]);
  });
  it('reports ok when gap >= buffer (boundary 10)', () => {
    const w = buildingWarnings(
      [
        s('a', '2026-11-10T16:00:00Z', '2026-11-10T16:30:00Z', 'Salt Palace'),
        s('b', '2026-11-10T16:40:00Z', '2026-11-10T17:10:00Z', 'Hyatt Regency'),
      ],
      10,
    );
    expect(w[0]?.level).toBe('ok');
    expect(w[0]?.gapMinutes).toBe(10);
  });
  it('treats an overlap as tight with a negative gap', () => {
    const w = buildingWarnings(
      [
        s('a', '2026-11-10T16:00:00Z', '2026-11-10T16:30:00Z', 'Salt Palace'),
        s('b', '2026-11-10T16:20:00Z', '2026-11-10T17:00:00Z', 'Hyatt Regency'),
      ],
      10,
    );
    expect(w[0]).toMatchObject({ level: 'tight', gapMinutes: -10 });
  });
  it('produces nothing for the same building (case-insensitive)', () => {
    expect(
      buildingWarnings(
        [
          s('a', '2026-11-10T16:00:00Z', '2026-11-10T16:30:00Z', 'Salt Palace'),
          s('b', '2026-11-10T16:31:00Z', '2026-11-10T17:00:00Z', 'salt palace'),
        ],
        10,
      ),
    ).toEqual([]);
  });
  it('produces nothing when either building is unknown', () => {
    for (const b of ['Room TBD', 'Off-Site Location', 'Hyatt Lobby', null]) {
      expect(
        buildingWarnings(
          [
            s('a', '2026-11-10T16:00:00Z', '2026-11-10T16:30:00Z', 'Salt Palace'),
            s('b', '2026-11-10T16:31:00Z', '2026-11-10T17:00:00Z', b),
          ],
          10,
        ),
      ).toEqual([]);
    }
  });
  it('does not compare across venue days', () => {
    expect(
      buildingWarnings(
        [
          s('a', '2026-11-10T23:00:00Z', '2026-11-10T23:30:00Z', 'Salt Palace'),
          s('b', '2026-11-11T16:00:00Z', '2026-11-11T16:30:00Z', 'Hyatt Regency'),
        ],
        10,
      ),
    ).toEqual([]);
  });
  it('handles empty and single-item agendas', () => {
    expect(buildingWarnings([], 10)).toEqual([]);
    expect(
      buildingWarnings([s('a', '2026-11-10T16:00:00Z', '2026-11-10T16:30:00Z', 'Salt Palace')], 10),
    ).toEqual([]);
  });
});

describe('walkMinutesFromEnv', () => {
  it('defaults to 10 and honours a valid override', () => {
    expect(walkMinutesFromEnv({})).toBe(10);
    expect(walkMinutesFromEnv({ WALK_MINUTES: '15' })).toBe(15);
    expect(walkMinutesFromEnv({ WALK_MINUTES: 'abc' })).toBe(10);
    expect(walkMinutesFromEnv({ WALK_MINUTES: '-3' })).toBe(10);
  });
});
