// "Jump to now": pick the session in progress, or the next one, using instants (venue time is
// America/Denver; API ISO strings carry the offset, so comparing instants is correct in any browser zone).
export type TimedItem = { id: string; startsAt: string; endsAt: string };
export type NowResult<T extends TimedItem> = { session: T; state: 'current' | 'next' } | null;

export const VENUE_TZ = 'America/Denver';

/** Venue-local calendar day key (YYYY-MM-DD) for an instant. */
export function venueDay(instant: Date | string): string {
  return new Date(instant).toLocaleDateString('en-CA', { timeZone: VENUE_TZ });
}

/**
 * Returns the session in progress at `now` (earliest start if several overlap), otherwise the next
 * session to start. Returns null for an empty list or when every session has already ended.
 */
export function currentOrNextSession<T extends TimedItem>(items: readonly T[], now: Date): NowResult<T> {
  const t = now.getTime();
  const sorted = [...items]
    .map((s) => ({ s, start: Date.parse(s.startsAt), end: Date.parse(s.endsAt) }))
    .filter((x) => Number.isFinite(x.start) && Number.isFinite(x.end))
    .sort((a, b) => a.start - b.start);
  const current = sorted.find((x) => x.start <= t && t < x.end);
  if (current) return { session: current.s, state: 'current' };
  const next = sorted.find((x) => x.start > t);
  return next ? { session: next.s, state: 'next' } : null;
}
