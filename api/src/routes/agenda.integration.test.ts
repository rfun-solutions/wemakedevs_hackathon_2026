import { readFileSync } from 'node:fs';
import Fastify from 'fastify';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { devicePlugin } from '../plugins/device.js';
import { loadMigrations, runMigrations } from '../migrate.js';
import { runIngest } from '../services/schedule/ingest.js';
import agendaRoutes from './agenda.js';
import sessionRoutes from './sessions.js';

// Real Postgres only (DATABASE_URI); skipped in plain `npm test`. Own schema.
const uri = process.env.DATABASE_URI;
const SCHEMA = 'kc_agenda_test';
const fixture = JSON.parse(
  readFileSync(
    new URL('../../../feed-contract/fixtures/sessionize-v1.json', import.meta.url),
    'utf8',
  ),
);
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe.skipIf(!uri)('sessions + agenda against Postgres', () => {
  const admin = new pg.Pool({ connectionString: uri });
  const pool = new pg.Pool({ connectionString: uri, options: `-c search_path=${SCHEMA}` });
  const app = Fastify();
  beforeAll(async () => {
    await admin.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await admin.query(`CREATE SCHEMA ${SCHEMA}`);
    const all = await loadMigrations();
    await runMigrations(
      pool,
      all.filter((m) => m.version === 0 || (m.version >= 100 && m.version <= 102)),
    );
    await runIngest({ pool, fetchFeedImpl: async () => fixture });
    await app.register(devicePlugin);
    await app.register(sessionRoutes, { db: pool });
    await app.register(agendaRoutes, { db: pool });
  });
  afterAll(async () => {
    await app.close();
    await admin.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await pool.end();
    await admin.end();
  });

  it('lists non-service sessions with filters and day filtering in venue time', async () => {
    const all = (
      await app.inject({ method: 'GET', url: '/api/sessions', headers: { 'x-device-id': A } })
    ).json();
    expect(all.sessions.length).toBe(58);
    expect(all.filters.days.length).toBeGreaterThan(0);
    const day = all.filters.days[0];
    const one = (
      await app.inject({
        method: 'GET',
        url: `/api/sessions?day=${day}`,
        headers: { 'x-device-id': A },
      })
    ).json();
    expect(one.sessions.every((s: { startsAt: string }) => s.startsAt.startsWith(day))).toBe(true);
  });

  it('keeps agendas per device, ordered by start time', async () => {
    const all = (
      await app.inject({ method: 'GET', url: '/api/sessions', headers: { 'x-device-id': A } })
    ).json();
    const ids: string[] = all.sessions
      .slice(0, 3)
      .map((s: { id: string }) => s.id)
      .reverse();
    for (const id of ids) {
      const r = await app.inject({
        method: 'POST',
        url: '/api/agenda',
        headers: { 'x-device-id': A },
        payload: { session_id: id },
      });
      expect(r.statusCode).toBe(201);
    }
    const mine = (
      await app.inject({ method: 'GET', url: '/api/agenda', headers: { 'x-device-id': A } })
    ).json();
    expect(mine.items.map((i: { id: string }) => i.id)).toEqual([...ids].reverse());
    const other = (
      await app.inject({ method: 'GET', url: '/api/agenda', headers: { 'x-device-id': B } })
    ).json();
    expect(other.items).toEqual([]);
    await app.inject({
      method: 'DELETE',
      url: `/api/agenda/${ids[0]}`,
      headers: { 'x-device-id': A },
    });
    const after = (
      await app.inject({ method: 'GET', url: '/api/agenda', headers: { 'x-device-id': A } })
    ).json();
    expect(after.items).toHaveLength(2);
  });
});
