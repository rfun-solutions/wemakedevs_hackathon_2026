import { describe, expect, it } from 'vitest';
import { currentOrNextSession, venueDay } from './scheduleNow';

const items = [
  { id: 'b', startsAt: '2026-11-10T10:00:00-07:00', endsAt: '2026-11-10T10:35:00-07:00' },
  { id: 'a', startsAt: '2026-11-10T09:00:00-07:00', endsAt: '2026-11-10T09:35:00-07:00' },
];

describe('currentOrNextSession', () => {
  it('returns the session in progress', () => {
    expect(currentOrNextSession(items, new Date('2026-11-10T16:10:00Z'))).toEqual({ session: items[1], state: 'current' });
  });
  it('returns the next session between talks', () => {
    expect(currentOrNextSession(items, new Date('2026-11-10T16:50:00Z'))?.session.id).toBe('b');
    expect(currentOrNextSession(items, new Date('2026-11-10T16:50:00Z'))?.state).toBe('next');
  });
  it('treats end as exclusive and start as inclusive', () => {
    expect(currentOrNextSession(items, new Date('2026-11-10T16:35:00Z'))?.state).toBe('next');
    expect(currentOrNextSession(items, new Date('2026-11-10T17:00:00Z'))).toMatchObject({ session: { id: 'b' }, state: 'current' });
  });
  it('returns the first session before the day starts', () => {
    expect(currentOrNextSession(items, new Date('2026-11-10T12:00:00Z'))?.session.id).toBe('a');
  });
  it('returns null after the last talk', () => {
    expect(currentOrNextSession(items, new Date('2026-11-10T18:00:00Z'))).toBeNull();
  });
  it('returns null for an empty day', () => {
    expect(currentOrNextSession([], new Date())).toBeNull();
  });
  it('prefers the earliest-starting session when several overlap', () => {
    const overlap = [
      { id: 'late', startsAt: '2026-11-10T09:10:00-07:00', endsAt: '2026-11-10T10:00:00-07:00' },
      { id: 'early', startsAt: '2026-11-10T09:00:00-07:00', endsAt: '2026-11-10T10:00:00-07:00' },
    ];
    expect(currentOrNextSession(overlap, new Date('2026-11-10T16:20:00Z'))?.session.id).toBe('early');
  });
  it('is independent of the browser zone (instants, not wall strings)', () => {
    const r = currentOrNextSession(items, new Date('2026-11-10T09:10:00-07:00'));
    expect(r?.session.id).toBe('a');
  });
});

describe('venueDay', () => {
  it('uses Denver, not UTC', () => {
    expect(venueDay('2026-11-11T03:00:00Z')).toBe('2026-11-10');
  });
});
