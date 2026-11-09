import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FeedShapeError } from '../sessionize/mapper.js';
import { deriveFeed, deriveSession } from './derive.js';

const fixture = JSON.parse(
  readFileSync(
    new URL('../../../../feed-contract/fixtures/sessionize-v1.json', import.meta.url),
    'utf8',
  ),
);

describe('deriveFeed on the G fixture', () => {
  const out = deriveFeed(fixture);
  it('derives all 60 sessions', () => expect(out).toHaveLength(60));
  it('converts naive Denver time to UTC with venue tz', () => {
    const first = out.find((s) => s.id === '100000')!;
    expect(first.startsAt.toISOString()).toBe('2026-11-10T16:00:00.000Z');
    expect(first.venueTz).toBe('America/Denver');
  });
  it('splits building, level and room', () => {
    const first = out.find((s) => s.id === '100000')!;
    expect(first.building).toBeTruthy();
    expect(first.room).toBeTruthy();
    const roomRaw = first.roomRaw;
    expect(roomRaw.startsWith(first.building!)).toBe(true);
    // Level is optional in the feed (some fixtures omit it); when present it is a "Level N" segment.
    if (first.level !== null) expect(first.level).toMatch(/^Level/);
  });
  it('parses a level when the room string has one', () => {
    const d = deriveSession({
      id: 'x',
      title: 'Hand-written',
      description: '',
      startsAtLocal: '2026-11-10T09:00:00',
      endsAtLocal: '2026-11-10T09:35:00',
      venueTz: 'America/Denver',
      roomRaw: 'Hyatt Regency | Level 3 | Mesa Ballroom',
      track: '',
      audienceLevel: '',
      categories: [],
    });
    expect([d.building, d.level, d.room]).toEqual(['Hyatt Regency', 'Level 3', 'Mesa Ballroom']);
  });
  it('flags registration and lunch as service, and nothing else', () => {
    const service = new Set(out.filter((s) => s.isService).map((s) => s.title));
    expect(service).toEqual(new Set(['Registration and Badge Pickup', 'Lunch Break']));
  });
  it('always carries captions-unknown', () => {
    expect(out.every((s) => s.accessTags.includes('captions-unknown'))).toBe(true);
  });
  it('is stable: every end is after its start', () => {
    expect(out.every((s) => s.endsAt > s.startsAt)).toBe(true);
  });
});

describe('drift', () => {
  it('fails loudly (FeedShapeError) when the shape drifts', () => {
    const drifted = {
      ...fixture,
      sessions: fixture.sessions.map(({ startsAt, ...r }: Record<string, unknown>) => ({
        ...r,
        starts_at: startsAt,
      })),
    };
    expect(() => deriveFeed(drifted)).toThrow(FeedShapeError);
  });
  it('rejects a non-object feed', () => {
    expect(() => deriveFeed(null)).toThrow(FeedShapeError);
  });
});
