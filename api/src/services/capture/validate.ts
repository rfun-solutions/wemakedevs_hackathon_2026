// Pure request validation for notes, people and promises (no I/O, unit tested).

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const NOTE_SOURCES = ['typed', 'dictated', 'caption'] as const;
export type NoteSource = (typeof NOTE_SOURCES)[number];

export const MAX_BODY = 4000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

const fail = <T>(error: string): Result<T> => ({ ok: false, error });
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function text(v: unknown, field: string, max: number, required: boolean): Result<string | null> {
  if (v === undefined || v === null)
    return required ? fail(`${field} is required`) : { ok: true, value: null };
  if (typeof v !== 'string') return fail(`${field} must be a string`);
  const t = v.trim();
  if (t.length === 0)
    return required ? fail(`${field} must not be empty`) : { ok: true, value: null };
  if (t.length > max) return fail(`${field} must be at most ${max} characters`);
  return { ok: true, value: t };
}

/** Client time is accepted but clamped to server now; invalid dates are rejected. */
export function clampCreatedAt(v: unknown, now: Date): Result<Date> {
  if (v === undefined || v === null) return { ok: true, value: now };
  if (typeof v !== 'string') return fail('created_at must be an ISO string');
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return fail('created_at must be an ISO date');
  return { ok: true, value: d.getTime() > now.getTime() ? now : d };
}

export interface NoteInput {
  client_id: string;
  body: string;
  source: NoteSource;
  session_id: string | null;
  person_ids: string[];
  created_at: Date;
}

export function validateNote(raw: unknown, now: Date = new Date()): Result<NoteInput> {
  if (!isObject(raw)) return fail('body must be a JSON object');
  if (!isUuid(raw.client_id)) return fail('client_id must be a uuid');
  const body = text(raw.body, 'body', MAX_BODY, true);
  if (!body.ok) return body;
  if (typeof raw.source !== 'string' || !(NOTE_SOURCES as readonly string[]).includes(raw.source))
    return fail(`source must be one of ${NOTE_SOURCES.join(', ')}`);
  const session = text(raw.session_id, 'session_id', 200, false);
  if (!session.ok) return session;
  let person_ids: string[] = [];
  if (raw.person_ids !== undefined) {
    if (
      !Array.isArray(raw.person_ids) ||
      raw.person_ids.length > 50 ||
      !raw.person_ids.every(isUuid)
    )
      return fail('person_ids must be an array of up to 50 uuids');
    person_ids = raw.person_ids as string[];
  }
  const created = clampCreatedAt(raw.created_at, now);
  if (!created.ok) return created;
  return {
    ok: true,
    value: {
      client_id: raw.client_id.toLowerCase(),
      body: body.value as string,
      source: raw.source as NoteSource,
      session_id: session.value,
      person_ids,
      created_at: created.value,
    },
  };
}

export interface PersonInput {
  client_id: string;
  name: string;
  context: string | null;
  note_id: string | null;
}

export function validatePerson(raw: unknown): Result<PersonInput> {
  if (!isObject(raw)) return fail('body must be a JSON object');
  if (!isUuid(raw.client_id)) return fail('client_id must be a uuid');
  const name = text(raw.name, 'name', 200, true);
  if (!name.ok) return name;
  const context = text(raw.context, 'context', 1000, false);
  if (!context.ok) return context;
  if (raw.note_id !== undefined && raw.note_id !== null && !isUuid(raw.note_id))
    return fail('note_id must be a uuid');
  return {
    ok: true,
    value: {
      client_id: raw.client_id.toLowerCase(),
      name: name.value as string,
      context: context.value,
      note_id: (raw.note_id as string | null | undefined) ?? null,
    },
  };
}

export interface PromiseInput {
  client_id: string;
  text: string;
  person_id: string | null;
  due: string | null;
  done: boolean;
}

export function validatePromise(raw: unknown): Result<PromiseInput> {
  if (!isObject(raw)) return fail('body must be a JSON object');
  if (!isUuid(raw.client_id)) return fail('client_id must be a uuid');
  const t = text(raw.text, 'text', 1000, true);
  if (!t.ok) return t;
  if (raw.person_id !== undefined && raw.person_id !== null && !isUuid(raw.person_id))
    return fail('person_id must be a uuid');
  let due: string | null = null;
  if (raw.due !== undefined && raw.due !== null) {
    const ms = typeof raw.due === 'string' && DATE_RE.test(raw.due) ? Date.parse(raw.due) : NaN;
    // Round-trip so days that roll over (2026-02-30) are a 400, not a 500 from Postgres.
    if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== raw.due)
      return fail('due must be a YYYY-MM-DD date');
    due = raw.due as string;
  }
  if (raw.done !== undefined && typeof raw.done !== 'boolean')
    return fail('done must be a boolean');
  return {
    ok: true,
    value: {
      client_id: raw.client_id.toLowerCase(),
      text: t.value as string,
      person_id: (raw.person_id as string | null | undefined) ?? null,
      due,
      done: raw.done === true,
    },
  };
}

export function validatePromisePatch(raw: unknown): Result<{ done: boolean }> {
  if (!isObject(raw) || typeof raw.done !== 'boolean') return fail('done must be a boolean');
  return { ok: true, value: { done: raw.done } };
}

export interface ListQuery {
  limit: number;
  before: Date | null;
  session_id: string | null;
}

/** Query for GET /api/notes?limit&before&session_id (session_id added by task 2.9). */
export function validateListQuery(q: unknown): Result<ListQuery> {
  const o = isObject(q) ? q : {};
  let limit = 50;
  if (o.limit !== undefined) {
    const n = Number(o.limit);
    if (!Number.isInteger(n) || n < 1 || n > 200) return fail('limit must be an integer 1..200');
    limit = n;
  }
  let before: Date | null = null;
  if (o.before !== undefined && o.before !== '') {
    const d = new Date(String(o.before));
    if (Number.isNaN(d.getTime())) return fail('before must be an ISO date');
    before = d;
  }
  let session_id: string | null = null;
  if (o.session_id !== undefined && o.session_id !== '') {
    const s = text(o.session_id, 'session_id', 200, false);
    if (!s.ok) return s;
    session_id = s.value;
  }
  return { ok: true, value: { limit, before, session_id } };
}
