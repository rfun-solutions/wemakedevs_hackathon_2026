import pg from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { loadMigrations, runMigrations } from './migrate.js';

// Runs only with a real Postgres (DATABASE_URI), e.g. the local docker container; skipped in plain `npm test`.
const uri = process.env.DATABASE_URI;
describe.skipIf(!uri)('migrations against Postgres', () => {
  const pool = new pg.Pool({ connectionString: uri });
  afterAll(() => pool.end());

  it('applies 000_init once, concurrently safe, and creates devices', async () => {
    await pool.query('DROP TABLE IF EXISTS devices, schema_migrations');
    const ms = await loadMigrations();
    const runs = await Promise.all([runMigrations(pool, ms), runMigrations(pool, ms)]);
    expect(runs.flat()).toEqual([0]);
    await pool.query("INSERT INTO devices (id) VALUES ('3f2b8c1e-5d4a-4b7e-9a1c-0e6d2f4a8b10')");
    expect((await pool.query('SELECT count(*)::int AS n FROM devices')).rows[0].n).toBe(1);
    expect(await runMigrations(pool, ms)).toEqual([]);
  });
});
