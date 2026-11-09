import { afterEach, describe, expect, it, vi } from 'vitest';

const createPool = vi.hoisted(() => vi.fn());
vi.mock('../../db.js', () => ({ createPool }));

import type { Pool } from 'pg';
import { closeScheduleDb, resolveScheduleDb } from './db.js';

describe('schedule database pool', () => {
  afterEach(async () => {
    await closeScheduleDb();
    createPool.mockReset();
  });

  it('sets a statement timeout on the shared route pool', () => {
    const pool = { end: vi.fn().mockResolvedValue(undefined) } as unknown as Pool;
    createPool.mockReturnValue(pool);

    expect(resolveScheduleDb()).toBe(pool);
    expect(createPool).toHaveBeenCalledWith(process.env, { statementTimeoutMs: 2_000 });
  });
});
