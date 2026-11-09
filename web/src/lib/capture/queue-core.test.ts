import { describe, expect, it } from 'vitest';
import {
  backoffMs,
  classify,
  createQueue,
  toRequest,
  type QueueItem,
  type QueueStore,
} from './queue-core.js';

function memStore(): QueueStore & { map: Map<string, QueueItem> } {
  const map = new Map<string, QueueItem>();
  return {
    map,
    getAll: async () => [...map.values()].map((i) => ({ ...i })),
    put: async (i) => void map.set(i.client_id, { ...i }),
    delete: async (id) => void map.delete(id),
  };
}

function setup(post: (i: QueueItem) => Promise<{ status: number }>) {
  const store = memStore();
  let t = Date.parse('2026-11-10T10:00:00Z');
  let n = 0;
  let perf = 0;
  const synced: string[] = [];
  const q = createQueue({
    store,
    post,
    now: () => (t += 1),
    perfNow: () => (perf += 7),
    uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    onSynced: (i) => synced.push(i.client_id),
  });
  return { q, store, synced, advance: (ms: number) => (t += ms) };
}

describe('classify / backoff', () => {
  it('classifies statuses', () => {
    expect(classify(201)).toBe('synced');
    expect(classify(200)).toBe('synced');
    expect(classify(null)).toBe('retry');
    expect(classify(503)).toBe('retry');
    expect(classify(429)).toBe('retry');
    expect(classify(400)).toBe('rejected');
    expect(classify(404)).toBe('rejected');
  });
  it('doubles up to a cap', () => {
    expect([1, 2, 3, 4].map(backoffMs)).toEqual([1000, 2000, 4000, 8000]);
    expect(backoffMs(30)).toBe(60_000);
  });
});

describe('queue', () => {
  it('writes to the store before any post and records saved_ms', async () => {
    const s = setup(async () => ({ status: 201 }));
    const { client_id } = await s.q.enqueue({
      body: 'hello',
      source: 'typed',
      session_id: 'sess-1',
    });
    expect(s.store.map.get(client_id)).toMatchObject({
      body: 'hello',
      session_id: 'sess-1',
      status: 'pending',
      saved_ms: 7,
    });
    expect(s.q.getLastSaveMs()).toBe(7);
  });

  it('omits session_id when absent', async () => {
    const s = setup(async () => ({ status: 201 }));
    const { client_id } = await s.q.enqueue({ body: 'a', source: 'caption' });
    expect('session_id' in s.store.map.get(client_id)!).toBe(false);
  });

  it('flushes in order and empties the queue', async () => {
    const order: string[] = [];
    const s = setup(async (i) => (order.push(i.body), { status: 201 }));
    await s.q.enqueue({ body: 'one', source: 'typed' });
    await s.q.enqueue({ body: 'two', source: 'typed' });
    await s.q.flush({ force: true });
    expect(order).toEqual(['one', 'two']);
    expect(s.store.map.size).toBe(0);
    expect(s.synced).toHaveLength(2);
  });

  it('keeps items on network error and backs off', async () => {
    const s = setup(async () => {
      throw new Error('offline');
    });
    const { client_id } = await s.q.enqueue({ body: 'x', source: 'typed' });
    await s.q.flush({ force: true });
    const item = s.store.map.get(client_id)!;
    expect(item).toMatchObject({ status: 'pending', attempts: 1, last_error: 'offline' });
    expect(item.next_attempt_at).toBeGreaterThan(Date.parse('2026-11-10T10:00:00Z') + 900);
  });

  it('skips items still in backoff unless forced', async () => {
    let calls = 0;
    const s = setup(async () => (calls++, { status: 503 }));
    await s.q.enqueue({ body: 'x', source: 'typed' });
    await s.q.flush({ force: true });
    await s.q.flush();
    expect(calls).toBe(1);
    s.advance(2000);
    await s.q.flush();
    expect(calls).toBe(2);
  });

  it('stops at the first retryable failure to keep order', async () => {
    const bodies: string[] = [];
    const s = setup(async (i) => (bodies.push(i.body), { status: 500 }));
    await s.q.enqueue({ body: 'a', source: 'typed' });
    await s.q.enqueue({ body: 'b', source: 'typed' });
    await s.q.flush({ force: true });
    expect(bodies).toEqual(['a']);
  });

  it('moves a 400 to needs_attention, continues, never drops it', async () => {
    const s = setup(async (i) => ({ status: i.body === 'bad' ? 400 : 201 }));
    const bad = await s.q.enqueue({ body: 'bad', source: 'typed' });
    await s.q.enqueue({ body: 'good', source: 'typed' });
    await s.q.flush({ force: true });
    expect(s.store.map.size).toBe(1);
    expect(s.store.map.get(bad.client_id)).toMatchObject({
      status: 'needs_attention',
      last_error: 'HTTP 400',
    });
    // not re-posted on later flushes
    await s.q.flush({ force: true });
    expect(s.synced).toHaveLength(1);
  });

  it('retry() resets a needs_attention item, remove() deletes it', async () => {
    let status = 400;
    const s = setup(async () => ({ status }));
    const a = await s.q.enqueue({ body: 'a', source: 'typed' });
    await s.q.flush({ force: true });
    status = 201;
    await s.q.retry(a.client_id);
    await s.q.flush({ force: true });
    expect(s.store.map.size).toBe(0);
    const b = await s.q.enqueue({ body: 'b', source: 'typed' });
    await s.q.remove(b.client_id);
    expect(s.store.map.size).toBe(0);
  });

  it('lost response then retry reuses the same client_id (no duplicates)', async () => {
    const seen: string[] = [];
    let fail = true;
    const s = setup(async (i) => {
      seen.push(i.client_id);
      if (fail) throw new Error('response lost');
      return { status: 200 };
    });
    await s.q.enqueue({ body: 'x', source: 'typed' });
    await s.q.flush({ force: true });
    fail = false;
    await s.q.flush({ force: true });
    expect(new Set(seen).size).toBe(1);
    expect(s.store.map.size).toBe(0);
  });

  it('concurrent flushes share one run', async () => {
    let calls = 0;
    const s = setup(async () => (calls++, { status: 201 }));
    await s.q.enqueue({ body: 'x', source: 'typed' });
    await Promise.all([s.q.flush({ force: true }), s.q.flush({ force: true })]);
    expect(calls).toBe(1);
  });

  it('an item enqueued while a flush is listing is still posted (no missed pass)', async () => {
    const bodies: string[] = [];
    const s = setup(async (i) => (bodies.push(i.body), { status: 201 }));
    await s.q.enqueue({ body: 'one', source: 'typed' });
    const first = s.q.flush({ force: true });
    await s.q.enqueue({ body: 'two', source: 'typed' });
    await Promise.all([first, s.q.flush({ force: true })]);
    expect(bodies).toEqual(['one', 'two']);
    expect(s.store.map.size).toBe(0);
  });

  it('nextDueAt reports the earliest pending item', async () => {
    const s = setup(async () => ({ status: 503 }));
    expect(await s.q.nextDueAt()).toBeNull();
    await s.q.enqueue({ body: 'x', source: 'typed' });
    await s.q.flush({ force: true });
    expect(await s.q.nextDueAt()).toBeGreaterThan(0);
  });
});

describe('kinds and wire format', () => {
  it('enqueueKind stores person/promise payloads and the device id', async () => {
    const store = memStore();
    const q = createQueue({
      store,
      post: async () => ({ status: 201 }),
      uuid: () => '00000000-0000-4000-8000-000000000009',
      deviceId: () => 'dev-1',
    });
    const { client_id } = await q.enqueueKind({
      kind: 'promise',
      body: 'send repo',
      extra: { due: '2026-11-12' },
    });
    const item = store.map.get(client_id)!;
    expect(item).toMatchObject({ kind: 'promise', device_id: 'dev-1' });
    expect(toRequest(item)).toEqual({
      path: '/api/promises',
      body: { client_id, text: 'send repo', due: '2026-11-12' },
    });
  });

  it('maps notes (default kind) and people', () => {
    const base = {
      client_id: 'c',
      body: 'b',
      source: 'dictated',
      created_at: 'T',
      saved_ms: 1,
      status: 'pending',
      attempts: 0,
      next_attempt_at: 0,
    } as const;
    expect(toRequest({ ...base, session_id: 's1' })).toEqual({
      path: '/api/notes',
      body: { client_id: 'c', body: 'b', source: 'dictated', created_at: 'T', session_id: 's1' },
    });
    expect(toRequest({ ...base, kind: 'person', body: 'Ana', extra: { context: 'x' } })).toEqual({
      path: '/api/people',
      body: { client_id: 'c', name: 'Ana', context: 'x' },
    });
  });
});
