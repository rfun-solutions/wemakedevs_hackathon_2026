// Maps Sessionize room names ("Salt Palace | Level 1 | Hall DE") to building / level / room.
export type RoomParts = { building: string | null; level: string | null; room: string | null };

const UNKNOWN_BUILDING = /^(room tbd|tbd|off-?site( location)?|hyatt lobby)$/i;

export function parseRoom(raw: string | null | undefined): RoomParts {
  const parts = (raw ?? '')
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return { building: null, level: null, room: null };
  const [building, ...rest] = parts as [string, ...string[]];
  let level: string | null = null;
  if (rest[0] && /^level\b/i.test(rest[0])) level = rest.shift() ?? null;
  return { building, level, room: rest.length ? rest.join(' | ') : null };
}

/** True when the building is a real, known venue building (warnings only apply to these). */
export function isKnownBuilding(building: string | null | undefined): boolean {
  const b = (building ?? '').trim();
  return b !== '' && !UNKNOWN_BUILDING.test(b);
}

const SERVICE_RE =
  /\b(registration|coat\s*\+?\s*(and\s*)?bag check|bag check|badge pickup|speaker (ready|lounge)|lunch|coffee break|breakfast|reception|check-?in)\b/i;
const SERVICE_ROOM_RE = /\b(registration|coat|bag check)\b/i;

/** Service sessions (registration, coat check, meals) are hidden from the default list. */
export function isServiceSession(title: string, roomRaw?: string | null): boolean {
  return SERVICE_RE.test(title) || SERVICE_ROOM_RE.test(roomRaw ?? '');
}
