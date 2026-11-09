import { describe, expect, it } from 'vitest';
import { isKnownBuilding, isServiceSession, parseRoom } from './rooms';

describe('parseRoom', () => {
  it('parses building | level | room', () => {
    expect(parseRoom('Salt Palace | Level 1 | Hall DE')).toEqual({
      building: 'Salt Palace',
      level: 'Level 1',
      room: 'Hall DE',
    });
  });
  it('handles one part', () => {
    expect(parseRoom('Room TBD')).toEqual({ building: 'Room TBD', level: null, room: null });
  });
  it('handles two parts without a level', () => {
    expect(parseRoom('Hyatt Regency | Grand Ballroom')).toEqual({
      building: 'Hyatt Regency',
      level: null,
      room: 'Grand Ballroom',
    });
  });
  it('handles two parts where the second is a level', () => {
    expect(parseRoom('Salt Palace | Level 2')).toEqual({
      building: 'Salt Palace',
      level: 'Level 2',
      room: null,
    });
  });
  it('joins 5-6 part names into the room remainder', () => {
    expect(parseRoom('Hyatt Regency | Level 4 | Wing | Suite | 401 | A')).toEqual({
      building: 'Hyatt Regency',
      level: 'Level 4',
      room: 'Wing | Suite | 401 | A',
    });
  });
  it('trims and drops empty segments; null/empty give nulls', () => {
    expect(parseRoom('  Salt Palace |  | Level 3 |  Room 255 ')).toEqual({
      building: 'Salt Palace',
      level: 'Level 3',
      room: 'Room 255',
    });
    expect(parseRoom(null)).toEqual({ building: null, level: null, room: null });
    expect(parseRoom('')).toEqual({ building: null, level: null, room: null });
  });
});

describe('isKnownBuilding', () => {
  it('rejects TBD, off-site, lobby and empty', () => {
    for (const b of [
      'Room TBD',
      'Off-Site Location',
      'Offsite',
      'Hyatt Lobby',
      '',
      null,
      undefined,
    ])
      expect(isKnownBuilding(b)).toBe(false);
  });
  it('accepts real buildings', () => {
    expect(isKnownBuilding('Salt Palace')).toBe(true);
    expect(isKnownBuilding('Hyatt Regency')).toBe(true);
  });
});

describe('isServiceSession', () => {
  it('flags service sessions', () => {
    expect(isServiceSession('Registration')).toBe(true);
    expect(isServiceSession('Coat + Bag Check')).toBe(true);
    expect(isServiceSession('Anything', 'Salt Palace | Level 1 | Registration')).toBe(true);
  });
  it('keeps real talks', () => {
    expect(isServiceSession('Scaling Prometheus with Thanos')).toBe(false);
  });
});
