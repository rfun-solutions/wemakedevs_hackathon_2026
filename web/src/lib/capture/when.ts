import { formatDate, formatTime, type Lang } from '../../i18n';

/** Venue time, like the schedule screens. */
export const VENUE_TZ = 'America/Denver';

/** "Mon, Nov 9 · 4:12 PM" in the given language and venue time, or null for a missing or invalid timestamp. */
export function formatNoteWhen(iso: string | undefined, lang?: Lang): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return `${formatDate(ms, VENUE_TZ, lang)} · ${formatTime(ms, VENUE_TZ, lang)}`;
}
