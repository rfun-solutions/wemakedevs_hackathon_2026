import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { mapFeed, FeedShapeError } from './mapper';

const load = (n: string) =>
  JSON.parse(
    fs.readFileSync(
      new URL(`../../../../feed-contract/fixtures/${n}.json`, import.meta.url),
      'utf8',
    ),
  );

describe('mapFeed (v1)', () => {
  const mapped = mapFeed(load('sessionize-v1'));
  // Narrowing for noUncheckedIndexedAccess; throws (fails the test) if nothing was mapped.
  const first = () => {
    const s = mapped[0];
    if (!s) throw new Error('no sessions mapped');
    return s;
  };
  it('maps all 60 sessions', () => expect(mapped).toHaveLength(60));
  it('keeps naive local time and the venue zone', () => {
    expect(first().startsAtLocal).toMatch(/^2026-11-1\dT\d\d:00:00$/);
    expect(first().venueTz).toBe('America/Denver');
  });
  it('resolves room, track and level', () => {
    expect(first().roomRaw).toContain(' | ');
    expect(first().track).not.toBe('');
    expect(['Beginner', 'Intermediate', 'Advanced']).toContain(first().audienceLevel);
    expect(first().categories).toHaveLength(2);
  });
  it('has no speaker fields', () => expect(Object.keys(first()).join()).not.toMatch(/speaker/i));
  it('throws FeedShapeError naming the drifted fields on v2', () => {
    expect(() => mapFeed(load('sessionize-v2'))).toThrow(FeedShapeError);
    expect(() => mapFeed(load('sessionize-v2'))).toThrow(/starts_at/);
  });
  it('throws on non-object input', () => expect(() => mapFeed(null)).toThrow(FeedShapeError));
});
