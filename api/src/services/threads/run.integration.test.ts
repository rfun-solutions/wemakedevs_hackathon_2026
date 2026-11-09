import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LlmUnavailableError } from '../llm/client.js';
import threadsRoutes from '../../routes/threads.js';
import { runThreading } from './run.js';
import {
  addNote,
  addPromise,
  createTestDb,
  denverNoon,
  DEVICE_A,
  DEVICE_B,
  fakeLlm,
  type TestDb,
} from './testSupport.js';

// Needs a real Postgres (DATABASE_URI); skipped in plain `npm test` without one.
const uri = process.env.DATABASE_URI;
describe.skipIf(!uri)('threading against Postgres', () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb(uri!);
  });
  afterAll(() => db?.drop());

  const reset = () => db.pool.query('TRUNCATE notes, promises, threads, llm_usage CASCADE');
  const llmReply = (noteIds: string[], promiseIds: string[] = []) =>
    JSON.stringify({
      threads: [
        {
          threadId: null,
          title: 'Tail sampling',
          summary: 'Sampling talk',
          noteIds,
          followUps: ['Try tail sampling'],
          promiseIds,
        },
      ],
    });

  it('migrations apply to an empty database and create the C tables', async () => {
    const r = await db.pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_name IN ('threads','thread_notes','llm_usage','thread_actions') ORDER BY 1`,
    );
    expect(r.rows.map((x) => x.table_name)).toEqual([
      'llm_usage',
      'thread_actions',
      'thread_notes',
      'threads',
    ]);
  });

  it('LLM path: persists threads, notes, follow-ups and a promise action; second run is idempotent', async () => {
    await reset();
    const n1 = await addNote(db.pool, DEVICE_A, 'OpenTelemetry tail sampling talk', denverNoon(10));
    const n2 = await addNote(db.pool, DEVICE_A, 'Sampling config question', denverNoon(10, 13));
    const p = await addPromise(db.pool, DEVICE_A, 'Send Ana the sampling config');
    const llm = fakeLlm([llmReply([n1, n2], [p])]);
    const r = await runThreading({
      pool: db.pool,
      deviceId: DEVICE_A,
      date: '2026-11-10',
      complete: llm.complete,
    });
    expect(r.mode).toBe('llm');
    expect(r.threads).toHaveLength(1);
    expect(r.threads[0]!.noteIds).toEqual([n1, n2]);
    expect(r.threads[0]!.actions.map((a) => a.kind).sort()).toEqual(['follow_up', 'promise']);
    expect(r.threads[0]!.actions.find((a) => a.kind === 'promise')!.text).toBe(
      'Send Ana the sampling config',
    );
    expect(r.usage.costUsd).toBeGreaterThan(0);

    const again = await runThreading({
      pool: db.pool,
      deviceId: DEVICE_A,
      date: '2026-11-10',
      complete: llm.complete,
    });
    expect(again.notesIn).toBe(0);
    expect(llm.calls).toHaveLength(1);
    expect((await db.pool.query('SELECT count(*)::int n FROM threads')).rows[0].n).toBe(1);
  });

  it('a later-day note attaches to the open thread and extends its day range', async () => {
    await reset();
    const n1 = await addNote(db.pool, DEVICE_A, 'Gateway API migration', denverNoon(10));
    await runThreading({
      pool: db.pool,
      deviceId: DEVICE_A,
      date: '2026-11-10',
      complete: fakeLlm([new LlmUnavailableError('no_key')]).complete,
    });
    const n2 = await addNote(db.pool, DEVICE_A, 'More Gateway API migration notes', denverNoon(11));
    const r = await runThreading({
      pool: db.pool,
      deviceId: DEVICE_A,
      date: '2026-11-11',
      complete: fakeLlm([new LlmUnavailableError('no_key')]).complete,
    });
    expect(r.threads).toHaveLength(1);
    expect(r.threads[0]).toMatchObject({
      firstDay: '2026-11-10',
      lastDay: '2026-11-11',
      noteIds: [n1, n2],
    });
  });

  it('no key: heuristic fallback with reason no_key and a follow-up from an action-verb note', async () => {
    await reset();
    await addNote(db.pool, DEVICE_A, 'Follow up with Ana about eBPF profiling', denverNoon(10));
    const r = await runThreading({
      pool: db.pool,
      deviceId: DEVICE_A,
      date: '2026-11-10',
      complete: fakeLlm([new LlmUnavailableError('no_key')]).complete,
    });
    expect(r).toMatchObject({ mode: 'heuristic', reason: 'no_key' });
    expect(r.threads[0]!.source).toBe('heuristic');
    expect(r.threads[0]!.actions[0]).toMatchObject({
      kind: 'follow_up',
      text: 'Follow up with Ana about eBPF profiling',
    });
  });

  it('cap 0 forces the heuristic without calling the LLM', async () => {
    await reset();
    await addNote(db.pool, DEVICE_A, 'Anything', denverNoon(10));
    const llm = fakeLlm(['{}']);
    const r = await runThreading({
      pool: db.pool,
      deviceId: DEVICE_A,
      date: '2026-11-10',
      complete: llm.complete,
      env: { THREADS_DAILY_CAP_USD: '0' },
    });
    expect(r).toMatchObject({ mode: 'heuristic', reason: 'cap' });
    expect(llm.calls).toHaveLength(0);
  });

  it('spend recorded today blocks the next run once the cap is reached', async () => {
    await reset();
    const n1 = await addNote(db.pool, DEVICE_A, 'First sampling note', denverNoon(10));
    const llm = fakeLlm([llmReply([n1])], { inputTokens: 1_000_000, outputTokens: 0 }); // costs 0.1 USD on Haiku
    const first = await runThreading({
      pool: db.pool,
      deviceId: DEVICE_A,
      date: '2026-11-10',
      complete: llm.complete,
      env: { THREADS_DAILY_CAP_USD: '0.5' },
    });
    expect(first.mode).toBe('llm');
    await addNote(db.pool, DEVICE_A, 'Second unrelated cooking note', denverNoon(10, 14));
    const second = await runThreading({
      pool: db.pool,
      deviceId: DEVICE_A,
      date: '2026-11-10',
      complete: llm.complete,
      env: { THREADS_DAILY_CAP_USD: '0.05' },
    });
    expect(second).toMatchObject({ mode: 'heuristic', reason: 'cap' });
    expect(llm.calls).toHaveLength(1);
  });

  it('parallel taps cannot double spend: one LLM call, the other run sees no new notes', async () => {
    await reset();
    const n1 = await addNote(db.pool, DEVICE_A, 'Parallel sampling note', denverNoon(10));
    const llm = fakeLlm([llmReply([n1])]);
    const [a, b] = await Promise.all([
      runThreading({
        pool: db.pool,
        deviceId: DEVICE_A,
        date: '2026-11-10',
        complete: llm.complete,
      }),
      runThreading({
        pool: db.pool,
        deviceId: DEVICE_A,
        date: '2026-11-10',
        complete: llm.complete,
      }),
    ]);
    expect(llm.calls).toHaveLength(1);
    expect([a.notesIn, b.notesIn].sort()).toEqual([0, 1]);
  });

  it('records the LLM cost even when the reply is invalid and the heuristic takes over', async () => {
    await reset();
    await addNote(db.pool, DEVICE_A, 'Bad json day', denverNoon(10));
    const r = await runThreading({
      pool: db.pool,
      deviceId: DEVICE_A,
      date: '2026-11-10',
      complete: fakeLlm(['x']).complete,
    });
    expect(r).toMatchObject({ mode: 'heuristic', reason: 'error' });
    const u = await db.pool.query('SELECT tokens_in, mode, reason FROM llm_usage');
    expect(u.rows[0]).toMatchObject({ tokens_in: 2000, mode: 'heuristic', reason: 'error' });
  });

  it('uses the Denver day: a note at 23:30 Denver (06:30Z next day) belongs to that Denver day', async () => {
    await reset();
    await addNote(db.pool, DEVICE_A, 'Late night sampling', '2026-11-11T06:30:00Z');
    const none = await runThreading({
      pool: db.pool,
      deviceId: DEVICE_A,
      date: '2026-11-11',
      complete: fakeLlm(['x']).complete,
    });
    expect(none.notesIn).toBe(0);
    const yes = await runThreading({
      pool: db.pool,
      deviceId: DEVICE_A,
      date: '2026-11-10',
      complete: fakeLlm([new LlmUnavailableError('no_key')]).complete,
    });
    expect(yes.notesIn).toBe(1);
  });

  describe('routes', () => {
    const headers = (d: string) => ({ 'x-device-id': d });
    const make = async (complete = fakeLlm([new LlmUnavailableError('no_key')]).complete) => {
      // An isolated instance: the device plugin plus this route plugin with injected pool and fake LLM.
      const { default: Fastify } = await import('fastify');
      const { devicePlugin } = await import('../../plugins/device.js');
      const a = Fastify();
      await a.register(devicePlugin, {});
      await a.register(threadsRoutes, { pool: db.pool, complete, cronToken: 'secret-token' });
      return a;
    };

    it('run, list, detail, rename, unlink and device isolation', async () => {
      await reset();
      const n1 = await addNote(db.pool, DEVICE_A, 'Gateway API notes', denverNoon(10));
      await addNote(db.pool, DEVICE_B, 'Gateway API notes of someone else', denverNoon(10));
      const app = await make();
      const run = await app.inject({
        method: 'POST',
        url: '/api/threads/run',
        headers: headers(DEVICE_A),
        payload: { date: '2026-11-10' },
      });
      expect(run.statusCode).toBe(200);
      const t = run.json().threads[0];

      const listA = (
        await app.inject({ method: 'GET', url: '/api/threads', headers: headers(DEVICE_A) })
      ).json().threads;
      const listB = (
        await app.inject({ method: 'GET', url: '/api/threads', headers: headers(DEVICE_B) })
      ).json().threads;
      expect(listA).toHaveLength(1);
      expect(listB).toHaveLength(0);
      expect(
        (
          await app.inject({
            method: 'GET',
            url: `/api/threads/${t.id}`,
            headers: headers(DEVICE_B),
          })
        ).statusCode,
      ).toBe(404);
      const detail = (
        await app.inject({ method: 'GET', url: `/api/threads/${t.id}`, headers: headers(DEVICE_A) })
      ).json();
      expect(detail.notes[0]).toMatchObject({ id: n1, body: 'Gateway API notes' });

      const ren = await app.inject({
        method: 'PATCH',
        url: `/api/threads/${t.id}`,
        headers: headers(DEVICE_A),
        payload: { title: 'Renamed' },
      });
      expect(ren.json().title).toBe('Renamed');
      expect(
        (
          await app.inject({
            method: 'PATCH',
            url: `/api/threads/${t.id}`,
            headers: headers(DEVICE_B),
            payload: { title: 'Hijack' },
          })
        ).statusCode,
      ).toBe(404);
      expect(
        (
          await app.inject({
            method: 'PATCH',
            url: `/api/threads/${t.id}`,
            headers: headers(DEVICE_A),
            payload: { title: '' },
          })
        ).statusCode,
      ).toBe(400);

      expect(
        (
          await app.inject({
            method: 'DELETE',
            url: `/api/threads/${t.id}/notes/${n1}`,
            headers: headers(DEVICE_B),
          })
        ).statusCode,
      ).toBe(404);
      expect(
        (
          await app.inject({
            method: 'DELETE',
            url: `/api/threads/${t.id}/notes/${n1}`,
            headers: headers(DEVICE_A),
          })
        ).statusCode,
      ).toBe(204);
      const after = (
        await app.inject({ method: 'GET', url: `/api/threads/${t.id}`, headers: headers(DEVICE_A) })
      ).json();
      expect(after.noteIds).toEqual([]);
      // An unlinked note is not re-threaded.
      const rerun = (
        await app.inject({
          method: 'POST',
          url: '/api/threads/run',
          headers: headers(DEVICE_A),
          payload: { date: '2026-11-10' },
        })
      ).json();
      expect(rerun.notesIn).toBe(0);

      const runs = (
        await app.inject({ method: 'GET', url: '/api/threads/runs', headers: headers(DEVICE_A) })
      ).json().runs;
      expect(runs[0]).toMatchObject({ mode: 'heuristic', reason: 'no_key' });
      await app.close();
    });

    it('actions: follow-up toggle, promise toggle rejected with 400, open list reflects B promise done', async () => {
      await reset();
      await addNote(db.pool, DEVICE_A, 'Send the sampling repo to Ana', denverNoon(10));
      const p = await addPromise(db.pool, DEVICE_A, 'Send sampling repo');
      const app = await make();
      const run = (
        await app.inject({
          method: 'POST',
          url: '/api/threads/run',
          headers: headers(DEVICE_A),
          payload: { date: '2026-11-10' },
        })
      ).json();
      const t = run.threads[0];
      const follow = t.actions.find((a: { kind: string }) => a.kind === 'follow_up');
      const prom = t.actions.find((a: { kind: string }) => a.kind === 'promise');
      expect(follow && prom).toBeTruthy();

      expect(
        (
          await app.inject({
            method: 'PATCH',
            url: `/api/threads/${t.id}/actions/${prom.id}`,
            headers: headers(DEVICE_A),
            payload: { done: true },
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await app.inject({
            method: 'PATCH',
            url: `/api/threads/${t.id}/actions/${follow.id}`,
            headers: headers(DEVICE_B),
            payload: { done: true },
          })
        ).statusCode,
      ).toBe(404);
      expect(
        (
          await app.inject({
            method: 'PATCH',
            url: `/api/threads/${t.id}/actions/${follow.id}`,
            headers: headers(DEVICE_A),
            payload: { done: 'yes' },
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await app.inject({
            method: 'PATCH',
            url: `/api/threads/${t.id}/actions/${follow.id}`,
            headers: headers(DEVICE_A),
            payload: { done: true },
          })
        ).statusCode,
      ).toBe(204);

      let open = (
        await app.inject({
          method: 'GET',
          url: '/api/threads/actions?open=1',
          headers: headers(DEVICE_A),
        })
      ).json().actions;
      expect(open.map((a: { kind: string }) => a.kind)).toEqual(['promise']);
      expect(open[0].threadTitle).toBe(t.title);
      await db.pool.query('UPDATE promises SET done = true WHERE id = $1', [p]); // B's PATCH /api/promises
      open = (
        await app.inject({
          method: 'GET',
          url: '/api/threads/actions?open=1',
          headers: headers(DEVICE_A),
        })
      ).json().actions;
      expect(open).toEqual([]);
      await app.close();
    });

    it('cron token: required, constant-time checked, runs all devices with notes that day', async () => {
      await reset();
      await addNote(db.pool, DEVICE_A, 'Cron note A', denverNoon(10));
      await addNote(db.pool, DEVICE_B, 'Cron note B', denverNoon(10));
      const app = await make();
      const post = (h: Record<string, string>, payload: object) =>
        app.inject({ method: 'POST', url: '/api/threads/run', headers: h, payload });
      expect((await post({}, { allDevices: true })).statusCode).toBe(401);
      expect(
        (await post({ 'x-cron-token': 'wrong-token!' }, { allDevices: true })).statusCode,
      ).toBe(401);
      expect((await post({ 'x-cron-token': 'secret-token' }, {})).statusCode).toBe(400);
      const ok = await post(
        { 'x-cron-token': 'secret-token' },
        { allDevices: true, date: '2026-11-10' },
      );
      expect(ok.statusCode).toBe(200);
      expect(ok.json()).toMatchObject({ devices: 2 });
      await app.close();
    });
  });
});
