import type { Queryable } from './db.js';
import type { NoteRow, OpenThread } from './types.js';

export const VENUE_TZ = 'America/Denver';
export const MAX_NOTES_PER_RUN = 200;

/** Today's calendar date in Denver, as YYYY-MM-DD. */
export async function denverToday(db: Queryable): Promise<string> {
  const r = await db.query(`SELECT (now() AT TIME ZONE '${VENUE_TZ}')::date::text AS d`);
  return r.rows[0].d as string;
}

/**
 * B's notes for the device on the given Denver day that are not yet in any thread (including unlinked ones, so
 * a note the user removed from a thread is not re-threaded). The only reader of B's `notes` table.
 */
export async function loadUnthreadedNotes(
  db: Queryable,
  deviceId: string,
  day: string,
): Promise<NoteRow[]> {
  const r = await db.query(
    `SELECT n.id, n.body, n.source, n.session_id, n.created_at
       FROM notes n
      WHERE n.device_id = $1
        AND (n.created_at AT TIME ZONE '${VENUE_TZ}')::date = $2::date
        AND NOT EXISTS (SELECT 1 FROM thread_notes t WHERE t.note_id = n.id)
      ORDER BY n.created_at, n.id
      LIMIT ${MAX_NOTES_PER_RUN}`,
    [deviceId, day],
  );
  return r.rows.map((x) => ({
    id: x.id as string,
    body: x.body as string,
    source: x.source as NoteRow['source'],
    sessionId: (x.session_id as string | null) ?? null,
    createdAt: new Date(x.created_at as string | Date),
  }));
}

/** Up to 10 of the device's threads active in the 7 days before `day`. */
export async function loadOpenThreads(
  db: Queryable,
  deviceId: string,
  day: string,
): Promise<OpenThread[]> {
  const r = await db.query(
    `SELECT id, title, summary FROM threads
      WHERE device_id = $1 AND last_day >= $2::date - 7 AND last_day <= $2::date
      ORDER BY last_day DESC, updated_at DESC, id
      LIMIT 10`,
    [deviceId, day],
  );
  return r.rows.map((x) => ({
    id: x.id as string,
    title: x.title as string,
    summary: x.summary as string,
  }));
}

export interface ThreadNoteRow {
  id: string;
  threadId: string;
  body: string;
  source: string;
  createdAt: string;
}

/** Notes (with bodies) of the given threads, linked only, in time order. Device-scoped. */
export async function loadThreadNotes(
  db: Queryable,
  deviceId: string,
  threadIds: string[],
): Promise<ThreadNoteRow[]> {
  if (threadIds.length === 0) return [];
  const r = await db.query(
    `SELECT n.id, tn.thread_id, n.body, n.source, n.created_at
       FROM thread_notes tn JOIN notes n ON n.id = tn.note_id
      WHERE tn.device_id = $1 AND n.device_id = $1 AND tn.unlinked = false AND tn.thread_id = ANY($2::uuid[])
      ORDER BY n.created_at, n.id`,
    [deviceId, threadIds],
  );
  return r.rows.map((x) => ({
    id: x.id as string,
    threadId: x.thread_id as string,
    body: x.body as string,
    source: x.source as string,
    createdAt: new Date(x.created_at as string | Date).toISOString(),
  }));
}
