// Offline capture queue logic, independent of IndexedDB and fetch so it is unit tested.
// queue.ts wires it to idb-keyval, fetch, window events and the service worker.

export type NoteSource = 'typed' | 'dictated' | 'caption';

export interface EnqueueInput {
  body: string;
  source: NoteSource;
  session_id?: string;
}

export type ItemStatus = 'pending' | 'needs_attention';

export interface QueueItem {
  client_id: string;
  body: string;
  source: NoteSource;
  session_id?: string;
  /** ISO time of the tap; sent as created_at (server clamps to its now). */
  created_at: string;
  /** Tap-to-durable-write time, reported once in X-Capture-Saved-Ms. */
  saved_ms: number;
  status: ItemStatus;
  attempts: number;
  next_attempt_at: number;
  last_error?: string;
}

export interface QueueStore {
  getAll(): Promise<QueueItem[]>;
  put(item: QueueItem): Promise<void>;
  delete(client_id: string): Promise<void>;
}

export interface PostResult {
  status: number;
}

export interface QueueDeps {
  store: QueueStore;
  /** Rejects on network error; resolves with the HTTP status otherwise. */
  post(item: QueueItem): Promise<PostResult>;
  now?: () => number;
  perfNow?: () => number;
  uuid?: () => string;
  onChange?: () => void;
  onSynced?: (item: QueueItem) => void;
}

export type Outcome = 'synced' | 'retry' | 'rejected';

export const BACKOFF_BASE_MS = 1000;
export const BACKOFF_MAX_MS = 60_000;

export function backoffMs(attempts: number): number {
  const n = Math.max(1, attempts);
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** (n - 1));
}

/** 2xx synced; network error, 5xx and 429 retry; other 4xx need attention. */
export function classify(status: number | null): Outcome {
  if (status === null) return 'retry';
  if (status >= 200 && status < 300) return 'synced';
  if (status === 429 || status >= 500) return 'retry';
  if (status >= 400 && status < 500) return 'rejected';
  return 'retry'; // 1xx/3xx: unexpected, keep the note
}

export function createQueue(deps: QueueDeps) {
  const now = deps.now ?? Date.now;
  const perfNow = deps.perfNow ?? (() => performance.now());
  const uuid = deps.uuid ?? (() => crypto.randomUUID());
  const changed = () => deps.onChange?.();
  let lastSaveMs: number | null = null;
  let flushing: Promise<void> | null = null;

  async function enqueue(input: EnqueueInput): Promise<{ client_id: string }> {
    const t0 = perfNow();
    const created = new Date(now()).toISOString();
    const client_id = uuid();
    const item: QueueItem = {
      client_id,
      body: input.body,
      source: input.source,
      ...(input.session_id ? { session_id: input.session_id } : {}),
      created_at: created,
      saved_ms: 0,
      status: 'pending',
      attempts: 0,
      next_attempt_at: 0,
    };
    await deps.store.put(item);
    item.saved_ms = Math.max(0, Math.round(perfNow() - t0));
    lastSaveMs = item.saved_ms;
    // Second write records saved_ms; the note is already durable, so a failure here only loses the metric.
    await deps.store.put(item).catch(() => undefined);
    changed();
    return { client_id };
  }

  async function list(): Promise<QueueItem[]> {
    const all = await deps.store.getAll();
    return all.sort(
      (a, b) => a.created_at.localeCompare(b.created_at) || a.client_id.localeCompare(b.client_id),
    );
  }

  async function runFlush(force: boolean): Promise<void> {
    for (const item of await list()) {
      if (item.status !== 'pending') continue;
      if (!force && item.next_attempt_at > now()) break; // keep order: wait for the oldest
      let status: number | null = null;
      let error: string | undefined;
      try {
        status = (await deps.post(item)).status;
      } catch (e) {
        error = e instanceof Error ? e.message : 'network error';
      }
      const outcome = classify(status);
      if (outcome === 'synced') {
        await deps.store.delete(item.client_id);
        deps.onSynced?.(item);
        changed();
      } else if (outcome === 'rejected') {
        await deps.store.put({ ...item, status: 'needs_attention', last_error: `HTTP ${status}` });
        changed();
      } else {
        const attempts = item.attempts + 1;
        await deps.store.put({
          ...item,
          attempts,
          next_attempt_at: now() + backoffMs(attempts),
          last_error: error ?? `HTTP ${status}`,
        });
        changed();
        break; // preserve order; later items would likely fail too
      }
    }
  }

  /** Posts pending items oldest first. Concurrent calls share one run. `force` ignores backoff (online, foreground). */
  function flush(opts: { force?: boolean } = {}): Promise<void> {
    if (!flushing) {
      flushing = runFlush(opts.force === true).finally(() => {
        flushing = null;
      });
    }
    return flushing;
  }

  /** Earliest time a pending item is due, or null when nothing is waiting. */
  async function nextDueAt(): Promise<number | null> {
    const due = (await list()).filter((i) => i.status === 'pending').map((i) => i.next_attempt_at);
    return due.length ? Math.min(...due) : null;
  }

  async function retry(client_id: string): Promise<void> {
    const item = (await deps.store.getAll()).find((i) => i.client_id === client_id);
    if (!item) return;
    await deps.store.put({
      ...item,
      status: 'pending',
      attempts: 0,
      next_attempt_at: 0,
      last_error: undefined,
    });
    changed();
  }

  async function remove(client_id: string): Promise<void> {
    await deps.store.delete(client_id);
    changed();
  }

  return { enqueue, flush, list, retry, remove, nextDueAt, getLastSaveMs: () => lastSaveMs };
}

export type CaptureQueue = ReturnType<typeof createQueue>;
