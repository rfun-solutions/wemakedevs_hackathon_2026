import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { metrics, SpanStatusCode, trace } from '@opentelemetry/api';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

/** The slice of a pg client the runner needs; tests pass a fake. */
export interface MigrationClient {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  release(): void;
}
export interface MigrationPool {
  connect(): Promise<MigrationClient>;
}

/** Arbitrary constant: one advisory lock serialises replicas that migrate at the same time. */
export const MIGRATION_LOCK_KEY = 7_201_109;

export const DEFAULT_MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'migrations',
);

/** Loads `NNN_name.sql` files, sorted by numeric version. Throws on duplicate versions. */
export async function loadMigrations(dir: string = DEFAULT_MIGRATIONS_DIR): Promise<Migration[]> {
  const files = (await readdir(dir)).filter((f) => /^\d+_.+\.sql$/.test(f));
  const out: Migration[] = [];
  for (const f of files) {
    const version = Number(f.slice(0, f.indexOf('_')));
    if (out.some((m) => m.version === version))
      throw new Error(`duplicate migration version ${version} (${f})`);
    out.push({ version, name: f.replace(/\.sql$/, ''), sql: await readFile(join(dir, f), 'utf8') });
  }
  return out.sort((a, b) => a.version - b.version);
}

/**
 * Applies every unapplied migration in numeric order (not only versions above the highest applied
 * one: A's 100 may arrive after B's 200 has been applied). Each runs in its own transaction.
 * Returns the versions applied by this call.
 */
export async function runMigrations(
  pool: MigrationPool,
  migrations: Migration[],
): Promise<number[]> {
  const tracer = trace.getTracer('kubecompanion');
  return tracer.startActiveSpan('kc.app.migrate', async (span) => {
    const client = await pool.connect();
    const applied: number[] = [];
    try {
      await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
      try {
        await client.query(
          `CREATE TABLE IF NOT EXISTS schema_migrations (
             version    integer PRIMARY KEY,
             name       text NOT NULL,
             applied_at timestamptz NOT NULL DEFAULT now()
           )`,
        );
        const done = new Set(
          (await client.query('SELECT version FROM schema_migrations')).rows.map((r) =>
            Number(r.version),
          ),
        );
        const pending = migrations
          .filter((m) => !done.has(m.version))
          .sort((a, b) => a.version - b.version);
        for (const m of pending) {
          await client.query('BEGIN');
          try {
            await client.query(m.sql);
            await client.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [
              m.version,
              m.name,
            ]);
            await client.query('COMMIT');
          } catch (e) {
            await client.query('ROLLBACK');
            throw new Error(`migration ${m.name} failed: ${(e as Error).message}`, { cause: e });
          }
          applied.push(m.version);
        }
      } finally {
        await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
      }
      if (applied.length > 0) {
        metrics
          .getMeter('kubecompanion')
          .createCounter('kc_app_migrations_applied')
          .add(applied.length);
      }
      span.setAttribute('kc.migrations.applied', applied.length);
      return applied;
    } catch (e) {
      span.recordException(e as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw e;
    } finally {
      client.release();
      span.end();
    }
  });
}
