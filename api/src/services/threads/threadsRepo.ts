import type { Queryable } from './db.js';
import { loadThreadNotes } from './notesRepo.js';

export interface ActionView {
  id: string;
  threadId: string;
  kind: 'follow_up' | 'promise';
  text: string;
  done: boolean;
  promiseId?: string;
}

export interface ThreadView {
  id: string;
  title: string;
  summary: string;
  firstDay: string;
  lastDay: string;
  source: 'llm' | 'heuristic';
  noteIds: string[];
  notes?: { id: string; body: string; source: string; createdAt: string }[];
  actions: ActionView[];
}

export interface OpenActionView extends ActionView {
  threadTitle: string;
}

export interface RunView {
  runId: string;
  day: string;
  mode: 'llm' | 'heuristic';
  reason: string | null;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  traceId: string | null;
  createdAt: string;
}

const ACTION_SELECT = `
  SELECT a.id, a.thread_id, a.kind, COALESCE(p.text, a.text) AS text,
         COALESCE(p.done, a.done) AS done, a.promise_id
    FROM thread_actions a LEFT JOIN promises p ON p.id = a.promise_id AND p.device_id = a.device_id`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toAction = (x: any): ActionView => ({
  id: x.id,
  threadId: x.thread_id,
  kind: x.kind,
  text: x.text ?? '',
  done: x.done,
  ...(x.promise_id ? { promiseId: x.promise_id } : {}),
});

async function hydrate(
  db: Queryable,
  deviceId: string,
  rows: Record<string, unknown>[],
  withNotes: boolean,
): Promise<ThreadView[]> {
  const ids = rows.map((r) => r.id as string);
  if (ids.length === 0) return [];
  const [notes, actions] = await Promise.all([
    loadThreadNotes(db, deviceId, ids),
    db.query(
      `${ACTION_SELECT} WHERE a.device_id = $1 AND a.thread_id = ANY($2::uuid[]) ORDER BY a.created_at, a.id`,
      [deviceId, ids],
    ),
  ]);
  return rows.map((r) => {
    const mine = notes.filter((n) => n.threadId === r.id);
    return {
      id: r.id as string,
      title: r.title as string,
      summary: r.summary as string,
      firstDay: r.first_day as string,
      lastDay: r.last_day as string,
      source: r.source as 'llm' | 'heuristic',
      noteIds: mine.map((n) => n.id),
      ...(withNotes
        ? {
            notes: mine.map(({ id, body, source, createdAt }) => ({ id, body, source, createdAt })),
          }
        : {}),
      actions: actions.rows.filter((a) => a.thread_id === r.id).map(toAction),
    };
  });
}

const THREAD_COLS = `id, title, summary, first_day::text AS first_day, last_day::text AS last_day, source`;

export async function listThreads(db: Queryable, deviceId: string): Promise<ThreadView[]> {
  const r = await db.query(
    `SELECT ${THREAD_COLS} FROM threads WHERE device_id = $1 ORDER BY last_day DESC, updated_at DESC, id LIMIT 100`,
    [deviceId],
  );
  return hydrate(db, deviceId, r.rows, false);
}

export async function getThread(
  db: Queryable,
  deviceId: string,
  id: string,
): Promise<ThreadView | undefined> {
  const r = await db.query(`SELECT ${THREAD_COLS} FROM threads WHERE device_id = $1 AND id = $2`, [
    deviceId,
    id,
  ]);
  return (await hydrate(db, deviceId, r.rows, true))[0];
}

export async function getThreadsByIds(
  db: Queryable,
  deviceId: string,
  ids: string[],
): Promise<ThreadView[]> {
  if (ids.length === 0) return [];
  const r = await db.query(
    `SELECT ${THREAD_COLS} FROM threads WHERE device_id = $1 AND id = ANY($2::uuid[]) ORDER BY last_day DESC, updated_at DESC, id`,
    [deviceId, ids],
  );
  return hydrate(db, deviceId, r.rows, false);
}

export async function renameThread(
  db: Queryable,
  deviceId: string,
  id: string,
  title: string,
): Promise<boolean> {
  const r = await db.query(
    `UPDATE threads SET title = $3, updated_at = now() WHERE device_id = $1 AND id = $2 RETURNING id`,
    [deviceId, id, title],
  );
  return r.rows.length > 0;
}

/** Marks the note unlinked (kept so later runs do not re-thread it). */
export async function unlinkNote(
  db: Queryable,
  deviceId: string,
  threadId: string,
  noteId: string,
): Promise<boolean> {
  const r = await db.query(
    `UPDATE thread_notes SET unlinked = true WHERE device_id = $1 AND thread_id = $2 AND note_id = $3 AND unlinked = false RETURNING note_id`,
    [deviceId, threadId, noteId],
  );
  return r.rows.length > 0;
}

export type PatchActionResult = 'ok' | 'not_found' | 'promise';

export async function patchFollowUp(
  db: Queryable,
  deviceId: string,
  threadId: string,
  actionId: string,
  done: boolean,
): Promise<PatchActionResult> {
  const cur = await db.query(
    `SELECT kind FROM thread_actions WHERE device_id = $1 AND thread_id = $2 AND id = $3`,
    [deviceId, threadId, actionId],
  );
  if (cur.rows.length === 0) return 'not_found';
  if (cur.rows[0].kind === 'promise') return 'promise';
  await db.query(
    `UPDATE thread_actions SET done = $4 WHERE device_id = $1 AND thread_id = $2 AND id = $3`,
    [deviceId, threadId, actionId, done],
  );
  return 'ok';
}

/** All open actions across the device's threads, newest thread activity first. */
export async function listOpenActions(db: Queryable, deviceId: string): Promise<OpenActionView[]> {
  const r = await db.query(
    `${ACTION_SELECT.replace('FROM thread_actions a', ', t.title AS thread_title FROM thread_actions a JOIN threads t ON t.id = a.thread_id')}
      WHERE a.device_id = $1 AND COALESCE(p.done, a.done) = false
      ORDER BY t.last_day DESC, t.updated_at DESC, a.created_at, a.id`,
    [deviceId],
  );
  return r.rows.map((x) => ({ ...toAction(x), threadTitle: x.thread_title as string }));
}

export async function listRuns(db: Queryable, deviceId: string): Promise<RunView[]> {
  const r = await db.query(
    `SELECT run_id, day::text AS day, mode, reason, model, tokens_in, tokens_out, cost_usd::float8 AS cost_usd,
            latency_ms, trace_id, created_at
       FROM llm_usage WHERE device_id = $1 ORDER BY created_at DESC, id LIMIT 10`,
    [deviceId],
  );
  return r.rows.map((x) => ({
    runId: x.run_id,
    day: x.day,
    mode: x.mode,
    reason: x.reason ?? null,
    model: x.model,
    tokensIn: x.tokens_in,
    tokensOut: x.tokens_out,
    costUsd: x.cost_usd,
    latencyMs: x.latency_ms,
    traceId: x.trace_id ?? null,
    createdAt: new Date(x.created_at).toISOString(),
  }));
}
