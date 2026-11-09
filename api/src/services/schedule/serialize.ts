import { toVenueIso, VENUE_TZ } from './time.js';

export const SESSION_COLUMNS =
  's.id, s.title, s.description, s.starts_at, s.ends_at, s.venue_tz, s.building, s.level, s.room, s.track, s.audience_level, s.access_tags';

export interface SessionDto {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  venueTz: string;
  building: string | null;
  level: string | null;
  room: string | null;
  track: string | null;
  audienceLevel: string | null;
  accessTags: string[];
}

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

/** DB row -> API shape: ISO strings with the venue offset (e.g. 2026-11-10T09:00:00-07:00). */
export function toSessionDto(row: Record<string, unknown>): SessionDto {
  const tz = str(row.venue_tz) ?? VENUE_TZ;
  return {
    id: String(row.id),
    title: String(row.title),
    description: str(row.description),
    startsAt: toVenueIso(new Date(row.starts_at as string | Date), tz),
    endsAt: toVenueIso(new Date(row.ends_at as string | Date), tz),
    venueTz: tz,
    building: str(row.building),
    level: str(row.level),
    room: str(row.room),
    track: str(row.track),
    audienceLevel: str(row.audience_level),
    accessTags: Array.isArray(row.access_tags) ? (row.access_tags as string[]) : [],
  };
}
