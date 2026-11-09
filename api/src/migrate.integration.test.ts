import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadMigrations, runMigrations, type Migration } from './migrate.js';

// Runs only with a real Postgres (DATABASE_URI), e.g. the local docker container; skipped in plain `npm test`.
// It runs in its own schema and only with 000_init plus fake migrations, so it keeps passing as other
// changes add their own migrations (A 100-102, B 200-202, C 300-303) to api/migrations.
const uri = process.env.DATABASE_URI;
const SCHEMA = 'kc_migrate_test';

describe.skipIf(!uri)('migrations against Postgres', () => {
  const pool = new pg.Pool({ connectionString: uri, options: `-c search_path=${SCHEMA}` });
  const admin = new pg.Pool({ connectionString: uri });

  beforeAll(async () => {
    await admin.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await admin.query(`CREATE SCHEMA ${SCHEMA}`);
  });
  afterAll(async () => {
    await admin.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await pool.end();
    await admin.end();
  });

  const versionCounts = async () =>
    Object.fromEntries(
      (
        await pool.query(
          'SELECT version, count(*)::int AS n FROM schema_migrations GROUP BY version',
        )
      ).rows.map((r) => [r.version as number, r.n as number]),
    );

  it('applies 000_init exactly once under concurrency, re-runs are no-ops, and a lower version arriving late is applied', async () => {
    const init = (await loadMigrations()).filter((m) => m.version === 0);
    expect(init).toHaveLength(1);
    const fake = (version: number): Migration => ({
      version,
      name: `${version}_fake`,
      sql: `CREATE TABLE fake_${version} (id int)`,
    });

    const runs = await Promise.all([
      runMigrations(pool, [...init, fake(200)]),
      runMigrations(pool, [...init, fake(200)]),
    ]);
    const applied = runs.flat();
    expect(applied.filter((v) => v === 0)).toHaveLength(1);
    expect(applied.filter((v) => v === 200)).toHaveLength(1);

    await pool.query("INSERT INTO devices (id) VALUES ('3f2b8c1e-5d4a-4b7e-9a1c-0e6d2f4a8b10')");
    expect((await pool.query('SELECT count(*)::int AS n FROM devices')).rows[0].n).toBe(1);

    expect(await runMigrations(pool, [...init, fake(200)])).toEqual([]);
    expect(await runMigrations(pool, [...init, fake(100), fake(200)])).toEqual([100]);
    expect(await versionCounts()).toEqual({ 0: 1, 100: 1, 200: 1 });
  });
});
