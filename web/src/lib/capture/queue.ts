// CONTRACT STUB (C0w). B (b-capture) replaces this file and keeps the signatures.
export type NoteSource = 'typed' | 'dictated' | 'caption';

export interface NoteInput {
  body: string;
  source: NoteSource;
  session_id?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function enqueueNote(_input: NoteInput): Promise<{ client_id: string }> {
  return Promise.reject(new Error('not implemented'));
}

/** Latest tap-to-durable time in ms, or null before the first save. */
export function getLastSaveMs(): number | null {
  return null;
}
