import { describe, expect, it } from 'vitest';
import {
  loadMigrations,
  MIGRATION_LOCK_KEY,
  runMigrations,
  type Migration,
  type MigrationPool,
} from './migrate.js';

/** In-memory stand-in for pg: records every statement and keeps schema_migrations rows. */
function fakePool(applied: number[] = [], failOn?: string) {
  const log: string[] = [];
  const versions = new Set(applied);
  let locked = false;
  const pool: MigrationPool = {
    async connect() {
      return {
        release() {},
        async query(sql: string, params?: unknown[]) {
          const s = sql.trim();
          if (s.startsWith('SELECT pg_advisory_lock')) {
            expect(params).toEqual([MIGRATION_LOCK_KEY]);
            locked = true;
            log.push('lock');
          } else if (s.startsWith('SELECT pg_advisory_unlock')) {
            locked = false;
            log.push('unlock');
          } else if (s.startsWith('CREATE TABLE IF NOT EXISTS schema_migrations')) {
            expect(locked).toBe(true);
          } else if (s.startsWith('SELECT version FROM schema_migrations')) {
            return { rows: [...versions].map((version) => ({ version })) };
          } else if (s === 'BEGIN' || s === 'COMMIT' || s === 'ROLLBACK') {
            log.push(s);
          } else if (s.startsWith('INSERT INTO schema_migrations')) {
            versions.add(params?.[0] as number);
            log.push(`record ${String(params?.[0])}`);
          } else {
            if (failOn && s.includes(failOn)) throw new Error('boom');
            log.push(`run ${s}`);
          }
          return { rows: [] };
        },
      };
    },
  };
  return { pool, log, versions };
}

const M = (version: number): Migration => ({
  version,
  name: `${String(version).padStart(3, '0')}_x`,
  sql: `sql${version}`,
});

describe('runMigrations', () => {
  it('applies unapplied migrations in numeric order under the advisory lock', async () => {
    const { pool, log } = fakePool();
    const applied = await runMigrations(pool, [M(200), M(10), M(100)]);
    expect(applied).toEqual([10, 100, 200]);
    expect(log.filter((l) => l.startsWith('run'))).toEqual([
      'run sql10',
      'run sql100',
      'run sql200',
    ]);
    expect(log[0]).toBe('lock');
    expect(log.at(-1)).toBe('unlock');
  });

  it('is idempotent', async () => {
    const { pool } = fakePool();
    const ms = [M(0), M(1)];
    expect(await runMigrations(pool, ms)).toEqual([0, 1]);
    expect(await runMigrations(pool, ms)).toEqual([]);
  });

  it('applies a lower version that arrives after a higher one is applied', async () => {
    const { pool, versions } = fakePool([0, 200]);
    const applied = await runMigrations(pool, [M(0), M(100), M(200)]);
    expect(applied).toEqual([100]);
    expect([...versions].sort((a, b) => a - b)).toEqual([0, 100, 200]);
  });

  it('rolls back, unlocks and rethrows when a migration fails', async () => {
    const { pool, log, versions } = fakePool([], 'sql2');
    await expect(runMigrations(pool, [M(1), M(2), M(3)])).rejects.toThrow(/001|002_x failed: boom/);
    expect(log).toContain('ROLLBACK');
    expect(log.at(-1)).toBe('unlock');
    expect([...versions]).toEqual([1]);
  });
});

describe('loadMigrations', () => {
  it('loads the repo migrations sorted, including 000_init', async () => {
    const ms = await loadMigrations();
    expect(ms[0]?.version).toBe(0);
    expect(ms[0]?.sql).toMatch(/CREATE TABLE IF NOT EXISTS devices/);
    expect(ms.map((m) => m.version)).toEqual([...ms.map((m) => m.version)].sort((a, b) => a - b));
  });
});
