import type { Pool } from 'pg';
import { createPool } from '../../db.js';

export interface ScheduleDb {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

let shared: Pool | undefined;
const SCHEDULE_STATEMENT_TIMEOUT_MS = 2_000;

/** Routes use the injected db (tests), otherwise one shared pool from DATABASE_URI. */
export function resolveScheduleDb(injected?: ScheduleDb): ScheduleDb | undefined {
  if (injected) return injected;
  shared ??= createPool(process.env, { statementTimeoutMs: SCHEDULE_STATEMENT_TIMEOUT_MS });
  return shared;
}

export async function closeScheduleDb(): Promise<void> {
  const p = shared;
  shared = undefined;
  await p?.end().catch(() => undefined);
}
