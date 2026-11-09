import type { Queryable } from './db.js';
import type { PromiseRow } from './types.js';

export const MAX_PROMISES = 20;

/** The device's open promises (B's table, read-only) not yet attached to a thread; at most 20, oldest first. */
export async function loadAttachablePromises(
  db: Queryable,
  deviceId: string,
): Promise<PromiseRow[]> {
  const r = await db.query(
    `SELECT p.id, p.text FROM promises p
      WHERE p.device_id = $1 AND p.done = false
        AND NOT EXISTS (SELECT 1 FROM thread_actions a WHERE a.promise_id = p.id)
      ORDER BY p.created_at, p.id
      LIMIT ${MAX_PROMISES}`,
    [deviceId],
  );
  return r.rows.map((x) => ({ id: x.id as string, text: x.text as string }));
}
