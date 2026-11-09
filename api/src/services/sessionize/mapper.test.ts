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
  it('throws FeedShapeError naming the missing required fields on v2', () => {
    expect(() => mapFeed(load('sessionize-v2'))).toThrow(FeedShapeError);
    expect(() => mapFeed(load('sessionize-v2'))).toThrow(/startsAt/);
  });
  it('throws on non-object input', () => expect(() => mapFeed(null)).toThrow(FeedShapeError));

  describe('tolerant reader (incident: upstream added session fields)', () => {
    const withExtras = () => {
      const feed = load('sessionize-v1');
      feed.sessions = feed.sessions.map((s: object, i: number) => ({
        ...s,
        isServiceSession: false,
        isPlenumSession: i === 0,
        speakers: [`fictional-speaker-${i}`],
      }));
      return feed;
    };
    it('accepts unknown session properties and maps the same sessions', () => {
      const out = mapFeed(withExtras());
      expect(out).toEqual(mapped);
    });
    it('does not leak speaker data into the mapped output', () =>
      expect(JSON.stringify(mapFeed(withExtras()))).not.toMatch(/speaker|isPlenum|isService/i));
    it('still rejects a feed missing a required session field', () => {
      const feed = withExtras();
      delete feed.sessions[0].startsAt;
      expect(() => mapFeed(feed)).toThrow(FeedShapeError);
      expect(() => mapFeed(feed)).toThrow(/startsAt/);
    });
    it('still rejects a wrongly typed required field', () => {
      const feed = withExtras();
      feed.sessions[0].roomId = 'one';
      expect(() => mapFeed(feed)).toThrow(FeedShapeError);
    });
  });

  describe('tolerant reader (incident 2: live feed shape, sanitised)', () => {
    // Structure of the live Sessionize schedule feed checked 2026-11-09: extra top-level keys
    // (speakers, questions), and sort/type on rooms, categories and category items. All values
    // here are fictional; no real names, emails or text.
    const liveShape = () => {
      const feed = load('sessionize-v1');
      feed.speakers = [{ id: 'fictional-speaker-0', fullName: 'Fictional Person' }];
      feed.questions = [{ id: 1, question: 'Fictional question?', questionType: 'Short_Text' }];
      feed.rooms = feed.rooms.map((r: object, i: number) => ({ ...r, sort: i }));
      feed.categories = feed.categories.map((c: { items: object[] }, i: number) => ({
        ...c,
        sort: i,
        type: 'Session',
        items: c.items.map((it, j) => ({ ...it, sort: j })),
      }));
      feed.sessions = feed.sessions.map((s: object) => ({
        ...s,
        isServiceSession: false,
        isPlenumSession: false,
        speakers: ['fictional-speaker-0'],
        questionAnswers: [],
        liveUrl: null,
        recordingUrl: null,
        status: 'Accepted',
        isInformed: true,
        isConfirmed: true,
      }));
      return feed;
    };
    it('accepts sort/type on rooms, categories and category items plus extra top-level keys', () =>
      expect(mapFeed(liveShape())).toEqual(mapped));
    it('stores no speaker or question data', () =>
      expect(JSON.stringify(mapFeed(liveShape()))).not.toMatch(
        /fictional-speaker|Fictional Person|Fictional question|speaker/i,
      ));
    it('still rejects a room without a name', () => {
      const feed = liveShape();
      delete feed.rooms[0].name;
      expect(() => mapFeed(feed)).toThrow(/name/);
    });
    it('still rejects a category item without a name', () => {
      const feed = liveShape();
      delete feed.categories[0].items[0].name;
      expect(() => mapFeed(feed)).toThrow(FeedShapeError);
    });
    it('still rejects a wrongly typed room id', () => {
      const feed = liveShape();
      feed.rooms[0].id = 'x';
      expect(() => mapFeed(feed)).toThrow(FeedShapeError);
    });
  });
});
