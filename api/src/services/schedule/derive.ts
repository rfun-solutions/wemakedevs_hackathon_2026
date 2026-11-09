// Wraps G's mapFeed and adds the derived fields. Never edit api/src/services/sessionize/*.
import { mapFeed, type MappedSession } from '../sessionize/mapper.js';
import { accessTags, type AccessTag } from './access-tags.js';
import { isServiceSession, parseRoom } from './rooms.js';
import { naiveToUtc, VENUE_TZ } from './time.js';

export interface DerivedSession {
  id: string;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  venueTz: string;
  building: string | null;
  level: string | null;
  room: string | null;
  roomRaw: string;
  track: string;
  audienceLevel: string;
  isService: boolean;
  accessTags: AccessTag[];
}

export function deriveSession(s: MappedSession): DerivedSession {
  const { building, level, room } = parseRoom(s.roomRaw);
  const startsAt = naiveToUtc(s.startsAtLocal, VENUE_TZ);
  const endsAt = naiveToUtc(s.endsAtLocal, VENUE_TZ);
  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new Error(`Session ${s.id} ends before it starts`);
  }
  return {
    id: s.id,
    title: s.title,
    description: s.description,
    startsAt,
    endsAt,
    venueTz: VENUE_TZ,
    building,
    level,
    room,
    roomRaw: s.roomRaw,
    track: s.track,
    audienceLevel: s.audienceLevel,
    isService: isServiceSession(s.title, s.roomRaw),
    accessTags: accessTags({
      title: s.title,
      description: s.description,
      audienceLevel: s.audienceLevel,
    }),
  };
}

/** Validates the feed (throws FeedShapeError on drift) and derives every session. */
export function deriveFeed(feed: unknown): DerivedSession[] {
  return mapFeed(feed).map(deriveSession);
}
