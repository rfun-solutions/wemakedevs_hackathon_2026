// Venue time helpers. The Sessionize feed gives naive local wall times; the venue is in America/Denver.
export const VENUE_TZ = 'America/Denver';

const NAIVE_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

/** Offset (ms) of `tz` from UTC at the given instant (positive east of UTC). */
function tzOffsetMs(instantMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instantMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(instantMs / 1000) * 1000;
}

/**
 * Convert a naive wall-clock string ("2026-11-10T09:00:00") in `tz` to a UTC Date.
 * Throws on an unparseable string (fail loudly, never treat it as UTC).
 */
export function naiveToUtc(naive: string, tz: string = VENUE_TZ): Date {
  const m = NAIVE_RE.exec(naive);
  if (!m) throw new Error(`Invalid naive datetime: ${JSON.stringify(naive)}`);
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? '0'].map(Number) as [
    number, number, number, number, number, number,
  ];
  const wallAsUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  // Two-pass fixed point handles instants near a DST change.
  let guess = wallAsUtc - tzOffsetMs(wallAsUtc, tz);
  guess = wallAsUtc - tzOffsetMs(guess, tz);
  return new Date(guess);
}

/** ISO string with the venue offset, e.g. "2026-11-10T09:00:00-07:00". */
export function toVenueIso(instant: Date, tz: string = VENUE_TZ): string {
  const off = tzOffsetMs(instant.getTime(), tz);
  const local = new Date(instant.getTime() + off).toISOString().slice(0, 19);
  const sign = off < 0 ? '-' : '+';
  const abs = Math.abs(off) / 60000;
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${local}${sign}${hh}:${mm}`;
}
