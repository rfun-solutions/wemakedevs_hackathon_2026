import { readFileSync } from 'node:fs';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadMigrations, runMigrations } from '../../migrate.js';
import { runIngest } from './ingest.js';

// Real Postgres only (DATABASE_URI); skipped in plain `npm test`. Own schema, so it does not disturb others.
const uri = process.env.DATABASE_URI;
const SCHEMA = 'kc_schedule_test';
const fixture = JSON.parse(
  readFileSync(
    new URL('../../../../feed-contract/fixtures/sessionize-v1.json', import.meta.url),
    'utf8',
  ),
);

describe.skipIf(!uri)('runIngest against Postgres', () => {
  const admin = new pg.Pool({ connectionString: uri });
  const pool = new pg.Pool({ connectionString: uri, options: `-c search_path=${SCHEMA}` });
  beforeAll(async () => {
    await admin.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await admin.query(`CREATE SCHEMA ${SCHEMA}`);
    const all = await loadMigrations();
    await runMigrations(
      pool,
      all.filter((m) => m.version === 0 || (m.version >= 100 && m.version <= 102)),
    );
  });
  afterAll(async () => {
    await admin.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await pool.end();
    await admin.end();
  });

  it('upserts idempotently and stores UTC instants', async () => {
    expect(await runIngest({ pool, fetchFeedImpl: async () => fixture })).toEqual({
      status: 'ok',
      sessionCount: 60,
    });
    await runIngest({ pool, fetchFeedImpl: async () => fixture });
    const n = await pool.query('SELECT count(*)::int AS n FROM sessions');
    expect(n.rows[0]?.n).toBe(60);
    const s = await pool.query(
      `SELECT starts_at, venue_tz, is_service FROM sessions WHERE id='100000'`,
    );
    expect(new Date(s.rows[0]?.starts_at).toISOString()).toBe('2026-11-10T16:00:00.000Z');
    expect(s.rows[0]?.venue_tz).toBe('America/Denver');
    const svc = await pool.query('SELECT count(*)::int AS n FROM sessions WHERE is_service');
    expect(svc.rows[0]?.n).toBeGreaterThan(0);
  });
  it('keeps old rows and records an error on a bad feed', async () => {
    const r = await runIngest({ pool, fetchFeedImpl: async () => ({ nope: true }) });
    expect(r.status).toBe('error');
    expect((await pool.query('SELECT count(*)::int AS n FROM sessions')).rows[0]?.n).toBe(60);
    const last = await pool.query('SELECT status FROM feed_runs ORDER BY id DESC LIMIT 1');
    expect(last.rows[0]?.status).toBe('error');
  });
});
