import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { loadMigrations, runMigrations } from '../../migrate.js';
import type { CompleteFn } from './llmThreader.js';

/** B's tables as designed (notes columns exactly, plus person_ids). IF NOT EXISTS so B's real migrations coexist. */
export const B_FIXTURE_SQL = `
CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), device_id text NOT NULL, client_id uuid NOT NULL,
  body text NOT NULL, source text NOT NULL CHECK (source IN ('typed','dictated','caption')), session_id text NULL,
  person_ids uuid[] NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (device_id, client_id));
CREATE TABLE IF NOT EXISTS promises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), device_id text NOT NULL, client_id uuid NOT NULL,
  text text NOT NULL, person_id uuid NULL, due date NULL, done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (device_id, client_id));`;

export interface TestDb {
  pool: pg.Pool;
  drop(): Promise<void>;
}

/** A throwaway database per test file (files run in parallel and must not share schema_migrations). */
export async function createTestDb(uri: string): Promise<TestDb> {
  const admin = new pg.Pool({ connectionString: uri, max: 1 });
  const name = `kc_c_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  await admin.query(`CREATE DATABASE ${name}`);
  const u = new URL(uri);
  u.pathname = `/${name}`;
  const pool = new pg.Pool({ connectionString: u.toString(), max: 5 });
  await pool.query(B_FIXTURE_SQL);
  await runMigrations(pool, await loadMigrations());
  return {
    pool,
    async drop() {
      await pool.end();
      await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await admin.end();
    },
  };
}

export const DEVICE_A = '3f2b8c1e-5d4a-4b7e-9a1c-0e6d2f4a8b10';
export const DEVICE_B = '7a1d9e22-0c3b-4f5a-8d6e-1b2c3d4e5f60';
/** 12:00 in Denver (MST, UTC-7) on the given November 2026 day. */
export const denverNoon = (day: number, hour = 12) =>
  `2026-11-${String(day).padStart(2, '0')}T${String(hour + 7).padStart(2, '0')}:00:00Z`;

export async function addNote(
  pool: pg.Pool,
  deviceId: string,
  body: string,
  createdAt: string,
): Promise<string> {
  const r = await pool.query(
    `INSERT INTO notes (device_id, client_id, body, source, created_at) VALUES ($1, gen_random_uuid(), $2, 'typed', $3) RETURNING id`,
    [deviceId, body, createdAt],
  );
  return r.rows[0].id as string;
}

export async function addPromise(
  pool: pg.Pool,
  deviceId: string,
  text: string,
  done = false,
): Promise<string> {
  const r = await pool.query(
    `INSERT INTO promises (device_id, client_id, text, done) VALUES ($1, gen_random_uuid(), $2, $3) RETURNING id`,
    [deviceId, text, done],
  );
  return r.rows[0].id as string;
}

export interface FakeLlm {
  complete: CompleteFn;
  calls: Parameters<CompleteFn>[0][];
}

/** A scripted fake for C0's complete(): each reply is text or an Error to throw; the last one repeats. */
export function fakeLlm(
  replies: (string | Error)[],
  usage = { inputTokens: 1000, outputTokens: 200 },
): FakeLlm {
  const calls: Parameters<CompleteFn>[0][] = [];
  const complete: CompleteFn = async (req) => {
    const r = replies[Math.min(calls.length, replies.length - 1)]!;
    calls.push(req);
    if (r instanceof Error) throw r;
    return {
      text: r,
      model: req.model ?? 'claude-haiku-5-5',
      usage: {
        ...usage,
        costUsd: (usage.inputTokens * 0.1 + usage.outputTokens * 0.5) / 1e6,
        latencyMs: 5,
      },
      traceId: 'a'.repeat(32),
    };
  };
  return { complete, calls };
}
