import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { devicePlugin } from '../plugins/device.js';
import type { ScheduleDb } from '../services/schedule/db.js';
import agendaRoutes from './agenda.js';

const getChaos = vi.hoisted(() => vi.fn());
vi.mock('../lib/chaos.js', () => ({
  DEFAULT_CHAOS: { latencyMs: 0, errorRate: 0, naive: false },
  getChaos,
}));

const DEV = '22222222-2222-4222-8222-222222222222';
const H = { 'x-device-id': DEV };
const OFF = { latencyMs: 0, errorRate: 0, naive: false };

const row = (id: string, start: string, end: string, building: string) => ({
  id,
  title: `Talk ${id}`,
  description: null,
  starts_at: new Date(start),
  ends_at: new Date(end),
  venue_tz: 'America/Denver',
  building,
  level: null,
  room: 'R1',
  track: 'Ops',
  audience_level: null,
  access_tags: ['captions-unknown'],
});
const SESSIONS = [
  row('a', '2026-11-10T16:00:00Z', '2026-11-10T16:30:00Z', 'Salt Palace'),
  row('b', '2026-11-10T16:35:00Z', '2026-11-10T17:05:00Z', 'Hyatt Regency'),
  row('c', '2026-11-10T18:00:00Z', '2026-11-10T18:30:00Z', 'Hyatt Regency'),
];

/** Stateful fake: routes on SQL text, counts every query. */
function fakeDb() {
  const agenda = new Set<string>(['a', 'b', 'c']);
  const sqls: string[] = [];
  const db: ScheduleDb = {
    async query(sql, params = []) {
      sqls.push(sql);
      if (sql.includes('FROM agenda_items a JOIN sessions'))
        return { rows: SESSIONS.filter((s) => agenda.has(s.id)) };
      if (sql.startsWith('SELECT session_id FROM agenda_items'))
        return { rows: [...agenda].map((session_id) => ({ session_id })) };
      if (sql.includes('FROM sessions s WHERE s.id = $1'))
        return { rows: SESSIONS.filter((s) => s.id === params[0]) };
      if (sql.startsWith('SELECT 1 FROM sessions'))
        return { rows: SESSIONS.some((s) => s.id === params[0]) ? [{}] : [] };
      if (sql.includes('INSERT INTO agenda_items')) {
        const had = agenda.has(String(params[1]));
        agenda.add(String(params[1]));
        return { rows: had ? [] : [{ session_id: params[1] }] };
      }
      if (sql.includes('DELETE FROM agenda_items')) {
        const had = agenda.delete(String(params[1]));
        return { rows: had ? [{ session_id: params[1] }] : [] };
      }
      return { rows: [] };
    },
  };
  return { db, sqls, agenda };
}

let app: FastifyInstance;
async function build(db: ScheduleDb) {
  app = Fastify();
  await app.register(devicePlugin);
  await app.register(agendaRoutes, { db, walkMinutes: 10 });
}
beforeEach(() => getChaos.mockReturnValue(OFF));
afterEach(async () => {
  await app?.close();
  vi.clearAllMocks();
});

describe('agenda routes', () => {
  it('returns 400 without X-Device-Id on every method', async () => {
    await build(fakeDb().db);
    for (const [method, url] of [
      ['GET', '/api/agenda'],
      ['POST', '/api/agenda'],
      ['DELETE', '/api/agenda/a'],
    ] as const) {
      expect((await app.inject({ method, url })).statusCode).toBe(400);
    }
  });

  it('GET uses one joined query, orders items, and adds a tight building warning', async () => {
    const f = fakeDb();
    await build(f.db);
    const res = await app.inject({ method: 'GET', url: '/api/agenda', headers: H });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(f.sqls).toHaveLength(1);
    expect(body.items.map((i: { id: string }) => i.id)).toEqual(['a', 'b', 'c']);
    expect(body.items[0].startsAt).toBe('2026-11-10T09:00:00-07:00');
    expect(body.items[0].venueTz).toBe('America/Denver');
    expect(body.warnings).toEqual([
      expect.objectContaining({
        level: 'tight',
        fromSessionId: 'a',
        toSessionId: 'b',
        gapMinutes: 5,
      }),
    ]);
  });

  it('naive mode issues 1 + N queries and returns an identical body', async () => {
    const f1 = fakeDb();
    await build(f1.db);
    const normal = (await app.inject({ method: 'GET', url: '/api/agenda', headers: H })).json();
    await app.close();
    const f2 = fakeDb();
    getChaos.mockReturnValue({ ...OFF, naive: true });
    await build(f2.db);
    const naive = (await app.inject({ method: 'GET', url: '/api/agenda', headers: H })).json();
    expect(f2.sqls).toHaveLength(1 + 3);
    expect(naive).toEqual(normal);
    expect(getChaos).toHaveBeenCalledWith('agenda');
  });

  it('applies injected latency', async () => {
    await build(fakeDb().db);
    getChaos.mockReturnValue({ ...OFF, latencyMs: 80 });
    const t = performance.now();
    await app.inject({ method: 'GET', url: '/api/agenda', headers: H });
    expect(performance.now() - t).toBeGreaterThanOrEqual(75);
  });

  it('injects errors at errorRate 1 and never at 0', async () => {
    await build(fakeDb().db);
    getChaos.mockReturnValue({ ...OFF, errorRate: 1 });
    expect((await app.inject({ method: 'GET', url: '/api/agenda', headers: H })).statusCode).toBe(
      500,
    );
    getChaos.mockReturnValue(OFF);
    expect((await app.inject({ method: 'GET', url: '/api/agenda', headers: H })).statusCode).toBe(
      200,
    );
  });

  it('POST validates, 404s unknown sessions, 201 then 200 on repeat', async () => {
    const f = fakeDb();
    f.agenda.clear();
    await build(f.db);
    const post = (payload: unknown) =>
      app.inject({ method: 'POST', url: '/api/agenda', headers: H, payload: payload as object });
    expect((await post({})).statusCode).toBe(400);
    expect((await post({ session_id: 'bad id!' })).statusCode).toBe(400);
    expect((await post({ session_id: 'zzz' })).statusCode).toBe(404);
    expect((await post({ session_id: 'a' })).statusCode).toBe(201);
    expect((await post({ session_id: 'a' })).statusCode).toBe(200);
  });

  it('DELETE is idempotent (204 both times) and rejects bad ids', async () => {
    const f = fakeDb();
    await build(f.db);
    const del = (id: string) =>
      app.inject({ method: 'DELETE', url: `/api/agenda/${id}`, headers: H });
    expect((await del('a')).statusCode).toBe(204);
    expect(f.agenda.has('a')).toBe(false);
    expect((await del('a')).statusCode).toBe(204);
    expect((await del('bad%20id')).statusCode).toBe(400);
  });

  it('is scoped by device id (the id is passed to every query)', async () => {
    const seen: unknown[][] = [];
    const db: ScheduleDb = {
      async query(_s, p = []) {
        seen.push(p);
        return { rows: [] };
      },
    };
    await build(db);
    await app.inject({ method: 'GET', url: '/api/agenda', headers: H });
    expect(seen[0]).toEqual([DEV]);
  });
});
