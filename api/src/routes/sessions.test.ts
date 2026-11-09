import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { devicePlugin } from '../plugins/device.js';
import type { ScheduleDb } from '../services/schedule/db.js';
import sessionRoutes from './sessions.js';

const DEV = '22222222-2222-4222-8222-222222222222';
let app: FastifyInstance;
afterEach(async () => app?.close());

async function build(db: ScheduleDb) {
  app = Fastify();
  await app.register(devicePlugin);
  await app.register(sessionRoutes, { db });
}
const sessionRow = {
  id: 's1',
  title: 'Talk',
  description: '',
  starts_at: new Date('2026-11-10T16:00:00Z'),
  ends_at: new Date('2026-11-10T16:35:00Z'),
  venue_tz: 'America/Denver',
  building: 'Salt Palace',
  level: null,
  room: 'Hall A',
  track: 'Observability',
  audience_level: 'Beginner',
  access_tags: ['novice-friendly'],
};

describe('GET /api/sessions', () => {
  it('maps rows, hides service sessions in SQL, and returns filter choices', async () => {
    const sqls: { sql: string; params?: unknown[] }[] = [];
    await build({
      async query(sql, params) {
        sqls.push({ sql, params });
        if (sql.includes('to_char'))
          return {
            rows: [
              { day: '2026-11-11', room: 'Hall A', track: 'Ops' },
              { day: '2026-11-10', room: 'Hall A', track: 'Observability' },
            ],
          };
        return { rows: [sessionRow] };
      },
    });
    const res = await app.inject({
      method: 'GET',
      url: '/api/sessions?day=2026-11-10&track=Observability',
      headers: { 'x-device-id': DEV },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.sessions[0]).toMatchObject({
      id: 's1',
      startsAt: '2026-11-10T09:00:00-07:00',
      endsAt: '2026-11-10T09:35:00-07:00',
      venueTz: 'America/Denver',
      description: null,
      accessTags: ['novice-friendly'],
    });
    expect(body.filters).toEqual({
      days: ['2026-11-10', '2026-11-11'],
      rooms: ['Hall A'],
      tracks: ['Observability', 'Ops'],
    });
    expect(sqls[0]?.sql).toContain('NOT s.is_service');
    expect(sqls[0]?.params).toEqual(['2026-11-10', null, 'Observability']);
  });

  it('rejects a malformed day', async () => {
    await build({ query: async () => ({ rows: [] }) });
    const res = await app.inject({
      method: 'GET',
      url: '/api/sessions?day=tomorrow',
      headers: { 'x-device-id': DEV },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a well-formed but impossible calendar day', async () => {
    await build({ query: async () => ({ rows: [] }) });
    const res = await app.inject({
      method: 'GET',
      url: '/api/sessions?day=2026-02-30',
      headers: { 'x-device-id': DEV },
    });
    expect(res.statusCode).toBe(400);
  });

  it('requires X-Device-Id', async () => {
    await build({ query: async () => ({ rows: [] }) });
    expect((await app.inject({ method: 'GET', url: '/api/sessions' })).statusCode).toBe(400);
  });
});
