import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { devicePlugin } from '../plugins/device.js';
import type { CaptureDb } from '../services/capture/db.js';
import noteRoutes from './notes.js';
import peopleRoutes from './people.js';
import promiseRoutes from './promises.js';

const DEV = '22222222-2222-4222-8222-222222222222';
const CID = '11111111-1111-4111-8111-111111111111';

async function build(db: CaptureDb): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(devicePlugin);
  await app.register(noteRoutes, { db });
  await app.register(peopleRoutes, { db });
  await app.register(promiseRoutes, { db });
  return app;
}

/** A db that records calls; these tests cover validation and gating, which never reach SQL. */
const calls: string[] = [];
const fakeDb: CaptureDb = {
  async query(sql) {
    calls.push(sql);
    return { rows: [], rowCount: 0 };
  },
};

afterEach(() => {
  calls.length = 0;
  delete process.env.KC_DEMO_SEED;
});

describe('capture routes without SQL', () => {
  it('requires X-Device-Id', async () => {
    const app = await build(fakeDb);
    const res = await app.inject({
      method: 'POST',
      url: '/api/notes',
      payload: { client_id: CID, body: 'x', source: 'typed' },
    });
    expect(res.statusCode).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('rejects an empty body and a bad source with 400 before touching the db', async () => {
    const app = await build(fakeDb);
    const h = { 'x-device-id': DEV };
    const empty = await app.inject({
      method: 'POST',
      url: '/api/notes',
      headers: h,
      payload: { client_id: CID, body: ' ', source: 'typed' },
    });
    const badSrc = await app.inject({
      method: 'POST',
      url: '/api/notes',
      headers: h,
      payload: { client_id: CID, body: 'x', source: 'voice' },
    });
    expect(empty.statusCode).toBe(400);
    expect(badSrc.statusCode).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('validates list query, ids and patch bodies', async () => {
    const app = await build(fakeDb);
    const h = { 'x-device-id': DEV };
    expect(
      (await app.inject({ method: 'GET', url: '/api/notes?limit=0', headers: h })).statusCode,
    ).toBe(400);
    expect(
      (await app.inject({ method: 'DELETE', url: '/api/notes/nope', headers: h })).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/api/promises/${CID}`,
          headers: h,
          payload: { done: 'x' },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/people',
          headers: h,
          payload: { client_id: CID },
        })
      ).statusCode,
    ).toBe(400);
  });

  it('seed endpoint returns 404 when KC_DEMO_SEED is unset, without touching the db', async () => {
    const app = await build(fakeDb);
    const res = await app.inject({ method: 'POST', url: '/api/capture/seed' });
    expect(res.statusCode).toBe(404);
    process.env.KC_DEMO_SEED = '0';
    expect((await app.inject({ method: 'POST', url: '/api/capture/seed' })).statusCode).toBe(404);
    expect(calls).toHaveLength(0);
  });
});
