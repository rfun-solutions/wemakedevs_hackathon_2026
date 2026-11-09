// Offline capture queue logic, independent of IndexedDB and fetch so it is unit tested.
// queue.ts wires it to idb-keyval, fetch, window events and the service worker.

export type NoteSource = 'typed' | 'dictated' | 'caption';

export interface EnqueueInput {
  body: string;
  source: NoteSource;
  session_id?: string;
}

/** What a queued item becomes on the wire. `body` holds the note text, person name or promise text. */
export type ItemKind = 'note' | 'person' | 'promise';

export interface EnqueueKindInput {
  kind: ItemKind;
  body: string;
  /** Extra wire fields: person `context`; promise `due`, `person_id`. */
  extra?: Record<string, string>;
  source?: NoteSource;
  session_id?: string;
}

export type ItemStatus = 'pending' | 'needs_attention';

export interface QueueItem {
  client_id: string;
  /** Absent means 'note'. */
  kind?: ItemKind;
  body: string;
  source: NoteSource;
  session_id?: string;
  extra?: Record<string, string>;
  /** Device that saved the item, so the service worker (no localStorage) can replay it. */
  device_id?: string;
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
  deviceId?: () => string;
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
  let rerun = false;
  let rerunForce = false;

  async function enqueue(input: EnqueueInput): Promise<{ client_id: string }> {
    return enqueueKind({ kind: 'note', ...input });
  }

  async function enqueueKind(input: EnqueueKindInput): Promise<{ client_id: string }> {
    const t0 = perfNow();
    const created = new Date(now()).toISOString();
    const client_id = uuid();
    const item: QueueItem = {
      client_id,
      kind: input.kind,
      body: input.body,
      source: input.source ?? 'typed',
      ...(input.session_id ? { session_id: input.session_id } : {}),
      ...(input.extra ? { extra: input.extra } : {}),
      ...(deps.deviceId ? { device_id: deps.deviceId() } : {}),
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
    const all = await list();
    for (const item of all) {
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

  /**
   * Posts pending items oldest first. Concurrent calls share one run, but a call that arrives while a run
   * is in flight schedules another pass, so an item enqueued after that run listed the store is not missed.
   * `force` ignores backoff (online, foreground).
   */
  function flush(opts: { force?: boolean } = {}): Promise<void> {
    if (flushing) {
      rerun = true;
      rerunForce ||= opts.force === true;
      return flushing;
    }
    flushing = (async () => {
      let force = opts.force === true;
      try {
        do {
          rerun = false;
          await runFlush(force);
          force = rerunForce;
          rerunForce = false;
        } while (rerun);
      } finally {
        // Cleared in the same tick as the final `rerun` check, so a caller can never join a run that is ending.
        flushing = null;
      }
    })();
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

  return {
    enqueue,
    enqueueKind,
    flush,
    list,
    retry,
    remove,
    nextDueAt,
    getLastSaveMs: () => lastSaveMs,
  };
}

export type CaptureQueue = ReturnType<typeof createQueue>;

/** Wire path and JSON body for an item (the service worker copy in public/sw-capture-sync.js mirrors this). */
export function toRequest(item: QueueItem): { path: string; body: Record<string, unknown> } {
  const kind = item.kind ?? 'note';
  if (kind === 'person') {
    return {
      path: '/api/people',
      body: { client_id: item.client_id, name: item.body, ...item.extra },
    };
  }
  if (kind === 'promise') {
    return {
      path: '/api/promises',
      body: { client_id: item.client_id, text: item.body, ...item.extra },
    };
  }
  return {
    path: '/api/notes',
    body: {
      client_id: item.client_id,
      body: item.body,
      source: item.source,
      created_at: item.created_at,
      ...(item.session_id ? { session_id: item.session_id } : {}),
    },
  };
}
