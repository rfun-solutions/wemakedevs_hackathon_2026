// Sessionize baseline owned by change g-pipeline-feed-contract.
// A wraps mapFeed in schedule/derive.ts and never edits this file.
// v1 only: naive local time strings, venue time zone America/Denver, no speaker fields.
// Tolerant reader: unknown session properties are ignored (never mapped); required fields stay strict.
import Ajv from 'ajv';
import schema from './schema.json' with { type: 'json' };

export interface MappedSession {
  id: string;
  title: string;
  description: string;
  startsAtLocal: string;
  endsAtLocal: string;
  venueTz: 'America/Denver';
  roomRaw: string;
  track: string;
  audienceLevel: string;
  categories: string[];
}

export class FeedShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeedShapeError';
  }
}

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);

export function mapFeed(feed: unknown): MappedSession[] {
  if (!validate(feed)) {
    const detail = (validate.errors ?? [])
      .slice(0, 8)
      .map((e) => {
        const extra =
          e.params && 'additionalProperty' in e.params
            ? ` (${String(e.params.additionalProperty)})`
            : '';
        return `${e.instancePath || '/'} ${e.message}${extra}`;
      })
      .join('; ');
    throw new FeedShapeError(`Feed does not match the v1 schema: ${detail}`);
  }
  const data = feed as {
    sessions: {
      id: string;
      title: string;
      description?: string | null;
      startsAt: string;
      endsAt: string;
      roomId: number;
      categoryItems: number[];
    }[];
    rooms: { id: number; name: string }[];
    categories: { title: string; items: { id: number; name: string }[] }[];
  };
  const rooms = new Map(data.rooms.map((r) => [r.id, r.name]));
  const items = new Map<number, { group: string; name: string }>();
  for (const c of data.categories)
    for (const i of c.items) items.set(i.id, { group: c.title, name: i.name });

  return data.sessions.map((s) => {
    const cats = s.categoryItems
      .map((id) => items.get(id))
      .filter((x): x is { group: string; name: string } => !!x);
    return {
      id: s.id,
      title: s.title,
      description: s.description ?? '',
      startsAtLocal: s.startsAt,
      endsAtLocal: s.endsAt,
      venueTz: 'America/Denver',
      roomRaw: rooms.get(s.roomId) ?? '',
      track: cats.find((c) => c.group === 'Track')?.name ?? '',
      audienceLevel: cats.find((c) => c.group === 'Level')?.name ?? '',
      categories: cats.map((c) => c.name),
    };
  });
}
