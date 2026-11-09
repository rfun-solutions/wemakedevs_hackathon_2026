import type { Pool } from 'pg';
import { createPool } from '../../db.js';

export interface CaptureDb {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
}

let shared: Pool | undefined;

/**
 * Capture routes use the injected db when given (tests), otherwise one shared pool built from DATABASE_URI.
 * The registry calls `registerRoutes(app)` without a db, so the pool is created here, once per process.
 */
export function resolveDb(injected?: CaptureDb): CaptureDb | undefined {
  if (injected) return injected;
  shared ??= createPool();
  return shared;
}

export async function closeSharedPool(): Promise<void> {
  const p = shared;
  shared = undefined;
  await p?.end().catch(() => undefined);
}
