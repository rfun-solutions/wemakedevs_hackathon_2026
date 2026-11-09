export const VENUE_TZ = 'America/Denver';

const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: VENUE_TZ,
  hourCycle: 'h23',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Venue time (America/Denver) as HH:MM:SS, whatever the phone's own time zone is. */
export function venueTime(date: Date = new Date()): string {
  return fmt.format(date);
}

/** Note text for a time mark: `[mark HH:MM:SS] <last caption line>`; just the tag when there is no line yet. */
export function markNoteBody(time: string, lastLine: string | undefined): string {
  const line = lastLine?.trim();
  return line ? `[mark ${time}] ${line}` : `[mark ${time}]`;
}
