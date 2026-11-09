/** The slice of a pg Pool/PoolClient the threads service uses; tests may pass either. */
export interface Queryable {
  query(sql: string, params?: unknown[]): Promise<{ rows: any[] }>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface TxPool extends Queryable {
  connect(): Promise<Queryable & { release(): void }>;
}

/** Runs fn inside BEGIN/COMMIT on one connection; rolls back on throw. */
export async function withTransaction<T>(
  pool: TxPool,
  fn: (tx: Queryable) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}
