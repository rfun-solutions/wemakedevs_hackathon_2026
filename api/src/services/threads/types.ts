/** Rows C reads from B's `notes` table (never written by C). */
export interface NoteRow {
  id: string;
  body: string;
  source: 'typed' | 'dictated' | 'caption';
  sessionId: string | null;
  createdAt: Date;
}

/** An open promise from B's `promises` table, read-only. */
export interface PromiseRow {
  id: string;
  text: string;
}

/** An existing thread offered to the grouper as an attachment target. */
export interface OpenThread {
  id: string;
  title: string;
  summary: string;
}

/** One grouped thread, produced identically by the LLM and the heuristic. */
export interface GroupedThread {
  /** Existing thread to attach to; undefined means create a new thread. */
  threadId?: string;
  title: string;
  summary: string;
  noteIds: string[];
  followUps: string[];
  promiseIds: string[];
}

export type FallbackReason = 'no_key' | 'cap' | 'error';

export const MAX_FOLLOW_UPS = 3;
