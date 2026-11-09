import type { CaptureDb } from './db.js';
import { SEED_NOTES, SEED_PEOPLE, SEED_PROMISES } from './seed-data.js';

/** Reserved demo device (valid UUID v4). C's `npm run seed:threads` seeds this device through POST /api/capture/seed. */
export const DEMO_DEVICE_ID = '00000000-0000-4000-8000-00000000ca1e';

/** The endpoint exists only while KC_DEMO_SEED=1 (set for rehearsal and the demo, never in git). */
export const seedEnabled = (env: NodeJS.ProcessEnv = process.env): boolean =>
  env.KC_DEMO_SEED === '1';

export interface SeedResult {
  device_id: string;
  notes: number;
  people: number;
  promises: number;
}

/** Idempotent: fixed client_ids plus ON CONFLICT DO NOTHING on (device_id, client_id). Returns total rows present. */
export async function seedDemo(db: CaptureDb): Promise<SeedResult> {
  for (const p of SEED_PEOPLE) {
    await db.query(
      `INSERT INTO people (device_id, client_id, name, context) VALUES ($1, $2, $3, $4)
       ON CONFLICT (device_id, client_id) DO NOTHING`,
      [DEMO_DEVICE_ID, p.client_id, p.name, p.context],
    );
  }
  for (const n of SEED_NOTES) {
    await db.query(
      `INSERT INTO notes (device_id, client_id, body, source, created_at) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (device_id, client_id) DO NOTHING`,
      [DEMO_DEVICE_ID, n.client_id, n.body, n.source, n.created_at],
    );
  }
  for (const p of SEED_PROMISES) {
    await db.query(
      `INSERT INTO promises (device_id, client_id, text, person_id, due, done, created_at)
       VALUES ($1, $2, $3, (SELECT id FROM people WHERE device_id = $1 AND client_id = $4), $5, $6, $7)
       ON CONFLICT (device_id, client_id) DO NOTHING`,
      [
        DEMO_DEVICE_ID,
        p.client_id,
        p.text,
        p.person_client_id,
        p.due,
        p.done,
        '2026-11-10T18:00:00-07:00',
      ],
    );
  }
  const count = async (table: 'notes' | 'people' | 'promises') =>
    Number(
      (
        await db.query(`SELECT count(*)::int AS n FROM ${table} WHERE device_id = $1`, [
          DEMO_DEVICE_ID,
        ])
      ).rows[0]?.n ?? 0,
    );
  return {
    device_id: DEMO_DEVICE_ID,
    notes: await count('notes'),
    people: await count('people'),
    promises: await count('promises'),
  };
}
