// Pure formatting helpers for the schedule screens. Times are always shown in venue time (America/Denver).
import type { BuildingWarning, Session } from './scheduleApi';
import { VENUE_TZ, venueDay } from './scheduleNow';

/** Zone abbreviation for the venue at that instant ("MST" / "MDT"), always from en-US. */
export function zoneAbbr(instant: Date | string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: VENUE_TZ,
    timeZoneName: 'short',
  }).formatToParts(new Date(instant));
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? 'MT';
}

export function formatTimeRange(s: Pick<Session, 'startsAt' | 'endsAt'>, lang: string): string {
  const f = new Intl.DateTimeFormat(lang, {
    timeZone: VENUE_TZ,
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${f.format(new Date(s.startsAt))} – ${f.format(new Date(s.endsAt))} ${zoneAbbr(s.startsAt)}`;
}

/** "Tue, Nov 10" for a YYYY-MM-DD venue day, independent of the browser zone. */
export function formatDay(day: string, lang: string, long = false): string {
  return new Intl.DateTimeFormat(lang, {
    timeZone: 'UTC',
    weekday: long ? 'long' : 'short',
    month: long ? 'long' : 'short',
    day: 'numeric',
  }).format(new Date(`${day}T12:00:00Z`));
}

export function location(s: Pick<Session, 'building' | 'level' | 'room'>): string {
  return [s.building, s.level, s.room].filter(Boolean).join(' · ');
}

export function groupByDay<T extends Pick<Session, 'startsAt'>>(items: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const d = venueDay(it.startsAt);
    map.set(d, [...(map.get(d) ?? []), it]);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

/** Warnings keyed by the id of the session the traveller is walking TO. */
export function warningsByTarget(ws: BuildingWarning[]): Map<string, BuildingWarning> {
  return new Map(ws.map((w) => [w.toSessionId, w]));
}

/** i18n key + params for one warning. Tight means the gap is shorter than the walk. */
export function warningMessage(w: BuildingWarning): {
  key: string;
  params: Record<string, string | number>;
} {
  const params = {
    from: w.fromBuilding,
    to: w.toBuilding,
    walk: w.walkMinutes,
    gap: Math.max(0, w.gapMinutes),
  };
  if (w.level === 'tight')
    return {
      key: w.gapMinutes < 0 ? 'schedule.warning.overlap' : 'schedule.warning.tight',
      params,
    };
  return { key: 'schedule.warning.ok', params };
}
