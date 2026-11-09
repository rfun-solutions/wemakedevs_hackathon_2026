import { readFileSync } from 'node:fs';
import Fastify, { type FastifyInstance } from 'fastify';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { devicePlugin } from '../plugins/device.js';
import { DEMO_DEVICE_ID } from '../services/capture/seed.js';
import noteRoutes from './notes.js';
import peopleRoutes from './people.js';
import promiseRoutes from './promises.js';

// Needs a real Postgres (DATABASE_URI); skipped otherwise. Runs in its own schema.
const uri = process.env.DATABASE_URI;
const SCHEMA = 'kc_capture_test';
const A = '22222222-2222-4222-8222-222222222222';
const B = '33333333-3333-4333-8333-333333333333';
const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;

describe.skipIf(!uri)('capture API against Postgres', () => {
  const admin = new pg.Pool({ connectionString: uri });
  const pool = new pg.Pool({ connectionString: uri, options: `-c search_path=${SCHEMA}` });
  let app: FastifyInstance;
  const as = (device: string) => ({ 'x-device-id': device });

  beforeAll(async () => {
    await admin.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await admin.query(`CREATE SCHEMA ${SCHEMA}`);
    for (const f of ['200_notes', '201_people', '202_promises']) {
      await pool.query(readFileSync(new URL(`../../migrations/${f}.sql`, import.meta.url), 'utf8'));
    }
    app = Fastify();
    await app.register(devicePlugin);
    await app.register(noteRoutes, { db: pool });
    await app.register(peopleRoutes, { db: pool });
    await app.register(promiseRoutes, { db: pool });
  });
  afterAll(async () => {
    await app?.close();
    await admin.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await pool.end();
    await admin.end();
    delete process.env.KC_DEMO_SEED;
  });

  const post = (device: string, payload: unknown, extra: Record<string, string> = {}) =>
    app.inject({
      method: 'POST',
      url: '/api/notes',
      headers: { ...as(device), ...extra },
      payload: payload as object,
    });

  it('creates a note (201) and replays idempotently (200, one row)', async () => {
    const body = { client_id: id(1), body: 'hello', source: 'caption' };
    const first = await post(A, body, { 'x-capture-saved-ms': '120' });
    expect(first.statusCode).toBe(201);
    expect(first.json()).toMatchObject({ client_id: id(1) });
    const second = await post(A, body);
    expect(second.statusCode).toBe(200);
    expect(second.json().id).toBe(first.json().id);
    const n = await pool.query('SELECT count(*)::int AS n FROM notes WHERE client_id = $1', [
      id(1),
    ]);
    expect(n.rows[0].n).toBe(1);
  });

  it('isolates devices: same client_id from B is a new row, A never sees B', async () => {
    expect((await post(B, { client_id: id(1), body: 'b note', source: 'typed' })).statusCode).toBe(
      201,
    );
    const list = (await app.inject({ method: 'GET', url: '/api/notes', headers: as(A) })).json()
      .notes;
    expect(list.map((n: { body: string }) => n.body)).toEqual(['hello']);
  });

  it('filters by session_id and lists unfiltered notes including ones without a session', async () => {
    await post(A, {
      client_id: id(2),
      body: 'in session',
      source: 'typed',
      session_id: 'keynote-1',
    });
    await post(A, { client_id: id(3), body: 'no session', source: 'typed' });
    const all = (await app.inject({ method: 'GET', url: '/api/notes', headers: as(A) })).json()
      .notes;
    expect(all).toHaveLength(3);
    const filtered = (
      await app.inject({ method: 'GET', url: '/api/notes?session_id=keynote-1', headers: as(A) })
    ).json().notes;
    expect(filtered.map((n: { body: string }) => n.body)).toEqual(['in session']);
    expect(filtered[0].session_id).toBe('keynote-1');
    expect(all.find((n: { body: string }) => n.body === 'no session').session_id).toBeNull();
  });

  it('deletes only the caller own note', async () => {
    const created = (await post(A, { client_id: id(4), body: 'temp', source: 'typed' })).json();
    expect(
      (await app.inject({ method: 'DELETE', url: `/api/notes/${created.id}`, headers: as(B) }))
        .statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ method: 'DELETE', url: `/api/notes/${created.id}`, headers: as(A) }))
        .statusCode,
    ).toBe(204);
  });

  it('people and promises: idempotent create, list, toggle done', async () => {
    const p = { client_id: id(10), name: 'Ana', context: 'mesh' };
    const h = as(A);
    expect(
      (await app.inject({ method: 'POST', url: '/api/people', headers: h, payload: p })).statusCode,
    ).toBe(201);
    expect(
      (await app.inject({ method: 'POST', url: '/api/people', headers: h, payload: p })).statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ method: 'GET', url: '/api/people', headers: h })).json().people,
    ).toHaveLength(1);

    const pr = { client_id: id(11), text: 'send repo', due: '2026-11-12' };
    const made = await app.inject({
      method: 'POST',
      url: '/api/promises',
      headers: h,
      payload: pr,
    });
    expect(made.statusCode).toBe(201);
    expect(made.json()).toMatchObject({ done: false, due: '2026-11-12' });
    expect(
      (await app.inject({ method: 'POST', url: '/api/promises', headers: h, payload: pr }))
        .statusCode,
    ).toBe(200);
    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/promises/${made.json().id}`,
      headers: h,
      payload: { done: true },
    });
    expect(patched.json().done).toBe(true);
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/api/promises/${made.json().id}`,
          headers: as(B),
          payload: { done: true },
        })
      ).statusCode,
    ).toBe(404);
  });

  it('seed: 404 when flag off; idempotent when on', async () => {
    delete process.env.KC_DEMO_SEED;
    expect((await app.inject({ method: 'POST', url: '/api/capture/seed' })).statusCode).toBe(404);
    process.env.KC_DEMO_SEED = '1';
    const one = await app.inject({ method: 'POST', url: '/api/capture/seed' });
    const two = await app.inject({ method: 'POST', url: '/api/capture/seed' });
    expect(one.statusCode).toBe(200);
    expect(two.json()).toEqual(one.json());
    expect(one.json()).toMatchObject({ device_id: DEMO_DEVICE_ID, people: 4, promises: 3 });
    expect(one.json().notes).toBeGreaterThanOrEqual(12);
    const joined = await pool.query(
      'SELECT count(*)::int AS n FROM promises WHERE device_id = $1 AND person_id IS NOT NULL',
      [DEMO_DEVICE_ID],
    );
    expect(joined.rows[0].n).toBe(3);
  });
});
