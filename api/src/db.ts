import pg from 'pg';

/** Pool from DATABASE_URI (CNPG `db-app` secret `uri`, or local docker). Undefined when unset: /readyz then reports 503. */
export function createPool(env: NodeJS.ProcessEnv = process.env): pg.Pool | undefined {
  const connectionString = env.DATABASE_URI ?? env.DATABASE_URL;
  if (!connectionString) return undefined;
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 30_000,
  });
  // An idle client erroring (db restart) must not crash the process.
  pool.on('error', () => undefined);
  return pool;
}
