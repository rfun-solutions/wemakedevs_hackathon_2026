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
  if (!shared) {
    shared = createPool();
    // Bound every statement from the schedule routes (done here: api/src/db.ts is C0's file).
    shared?.on('connect', (client) => {
      void client
        .query(`SET statement_timeout = ${SCHEDULE_STATEMENT_TIMEOUT_MS}`)
        .catch(() => undefined);
    });
  }
  return shared;
}

export async function closeScheduleDb(): Promise<void> {
  const p = shared;
  shared = undefined;
  await p?.end().catch(() => undefined);
}
