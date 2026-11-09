import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enqueueNote, enqueueItem, getLastSaveMs, listQueue, removeItem } from './queue';

// The service worker script is a classic script; load it as text like sw.test.ts does.
const swSrc = readFileSync(resolve(process.cwd(), 'web/public/sw-capture-sync.js'), 'utf8');
const kcCaptureFlush = new Function(`${swSrc}; return kcCaptureFlush;`)() as (
  idb: IDBFactory,
  fetchFn: (path: string, init: RequestInit) => Promise<{ status: number }>,
) => Promise<number>;

describe('queue.ts (IndexedDB + fetch wiring)', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
  });
  afterEach(async () => {
    for (const i of await listQueue()) await removeItem(i.client_id);
    vi.unstubAllGlobals();
  });

  it('keeps the stub contract: getLastSaveMs is null before a save, a number after', async () => {
    expect(getLastSaveMs()).toBeNull();
    const { client_id } = await enqueueNote({
      body: 'offline note',
      source: 'caption',
      session_id: 's-1',
    });
    expect(client_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(getLastSaveMs()).toBeGreaterThanOrEqual(0);
    const [item] = await listQueue();
    expect(item).toMatchObject({
      body: 'offline note',
      source: 'caption',
      session_id: 's-1',
      status: 'pending',
    });
    expect(item?.device_id).toBeTruthy();
  });

  it('service worker flush replays queued items in order and empties the store', async () => {
    await enqueueNote({ body: 'first', source: 'typed' });
    await enqueueItem({ kind: 'promise', body: 'send repo', extra: { due: '2026-11-12' } });
    const calls: {
      path: string;
      body: Record<string, unknown>;
      headers: Record<string, string>;
    }[] = [];
    const synced = await kcCaptureFlush(indexedDB, async (path, init) => {
      calls.push({
        path,
        body: JSON.parse(init.body as string),
        headers: init.headers as Record<string, string>,
      });
      return { status: 201 };
    });
    expect(synced).toBe(2);
    expect(calls.map((c) => c.path)).toEqual(['/api/notes', '/api/promises']);
    expect(calls[1]?.body).toMatchObject({ text: 'send repo', due: '2026-11-12' });
    expect(calls[0]?.headers['X-Device-Id']).toBeTruthy();
    expect(await listQueue()).toHaveLength(0);
  });

  it('service worker flush rejects on 503 so Background Sync retries, and keeps the item', async () => {
    await enqueueNote({ body: 'keep me', source: 'typed' });
    await expect(kcCaptureFlush(indexedDB, async () => ({ status: 503 }))).rejects.toThrow(/retry/);
    expect(await listQueue()).toHaveLength(1);
  });

  it('service worker leaves a 400 item in place (page shows Needs attention)', async () => {
    await enqueueNote({ body: 'bad', source: 'typed' });
    expect(await kcCaptureFlush(indexedDB, async () => ({ status: 400 }))).toBe(0);
    expect(await listQueue()).toHaveLength(1);
  });
});
