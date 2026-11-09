// Offline capture queue: IndexedDB (idb-keyval) + fetch + flush triggers. Logic lives in queue-core.ts.
// Exports `enqueueNote` and `getLastSaveMs` keep the exact signatures of the C0 stub (E and F import them).
import { createStore, del, entries, set } from 'idb-keyval';
import { getDeviceId } from '../device';
import {
  createQueue,
  toRequest,
  type CaptureQueue,
  type EnqueueKindInput,
  type NoteSource,
  type QueueItem,
  type QueueStore,
} from './queue-core';
import { markSave, reportSaved } from './telemetry';

export type { NoteSource, QueueItem } from './queue-core';

export interface NoteInput {
  body: string;
  source: NoteSource;
  session_id?: string;
}

/** The service worker (public/sw-capture-sync.js) reads this same database, store and layout. */
export const DB_NAME = 'kc-capture';
export const STORE_NAME = 'queue';
export const SYNC_TAG = 'kc-capture-flush';

type Listener = () => void;
const listeners = new Set<Listener>();
const syncedListeners = new Set<Listener>();
let queue: CaptureQueue | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let memory: Map<string, QueueItem> | undefined; // fallback when IndexedDB is unavailable

function makeStore(): QueueStore {
  try {
    const idb = createStore(DB_NAME, STORE_NAME);
    return {
      getAll: async () => (await entries<string, QueueItem>(idb)).map(([, v]) => v),
      put: (item) => set(item.client_id, item, idb),
      delete: (id) => del(id, idb),
    };
  } catch {
    memory = new Map();
    return {
      getAll: async () => [...memory!.values()],
      put: async (item) => void memory!.set(item.client_id, item),
      delete: async (id) => void memory!.delete(id),
    };
  }
}

async function post(item: QueueItem): Promise<{ status: number }> {
  const { path, body } = toRequest(item);
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': item.device_id ?? getDeviceId(),
      'X-Capture-Saved-Ms': String(item.saved_ms),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status };
}

function scheduleNext(): void {
  clearTimeout(timer);
  void queue?.nextDueAt().then((due) => {
    if (due === null) return;
    timer = setTimeout(() => void flushNow(false), Math.max(500, due - Date.now()));
  });
}

async function flushNow(force: boolean): Promise<void> {
  await queue?.flush({ force });
  scheduleNext();
}

function get(): CaptureQueue {
  if (queue) return queue;
  queue = createQueue({
    store: makeStore(),
    post,
    deviceId: getDeviceId,
    onChange: () => listeners.forEach((l) => l()),
    onSynced: () => syncedListeners.forEach((l) => l()),
  });
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => void flushNow(true));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void flushNow(true);
    });
    void flushNow(true); // app start
    navigator.serviceWorker?.addEventListener?.('message', (e: MessageEvent) => {
      if ((e.data as { type?: string } | null)?.type === 'kc-capture-flushed') {
        listeners.forEach((l) => l());
        syncedListeners.forEach((l) => l());
      }
    });
  }
  return queue;
}

/** Ask the browser for a Background Sync wake-up where SyncManager exists (not iOS Safari). */
function requestBackgroundSync(): void {
  try {
    void navigator.serviceWorker?.ready
      .then((reg) =>
        (
          reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }
        ).sync?.register(SYNC_TAG),
      )
      .catch(() => undefined);
  } catch {
    /* progressive enhancement only */
  }
}

async function afterEnqueue(client_id: string, startedAt: number): Promise<{ client_id: string }> {
  const q = get();
  const savedMs = q.getLastSaveMs() ?? 0;
  markSave(startedAt, savedMs);
  const online = typeof navigator === 'undefined' ? true : navigator.onLine;
  void reportSaved({ saved_ms: savedMs, queued: true, online });
  requestBackgroundSync();
  if (online) void flushNow(true);
  else scheduleNext();
  return { client_id };
}

export async function enqueueNote(input: NoteInput): Promise<{ client_id: string }> {
  const startedAt = performance.now();
  const { client_id } = await get().enqueue(input);
  return afterEnqueue(client_id, startedAt);
}

/** Quick-add for a person met or a promise made; same queue, same replay rules. */
export async function enqueueItem(input: EnqueueKindInput): Promise<{ client_id: string }> {
  const startedAt = performance.now();
  const { client_id } = await get().enqueueKind(input);
  return afterEnqueue(client_id, startedAt);
}

/** Latest tap-to-durable time in ms, or null before the first save. */
export function getLastSaveMs(): number | null {
  return queue?.getLastSaveMs() ?? null;
}

export function listQueue(): Promise<QueueItem[]> {
  return get().list();
}
export const retryItem = (id: string): Promise<void> =>
  get()
    .retry(id)
    .then(() => flushNow(true));
export const removeItem = (id: string): Promise<void> => get().remove(id);
export const flushQueue = (): Promise<void> => flushNow(true);

export function onQueueChange(fn: Listener): () => void {
  get();
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function onQueueSynced(fn: Listener): () => void {
  get();
  syncedListeners.add(fn);
  return () => syncedListeners.delete(fn);
}
