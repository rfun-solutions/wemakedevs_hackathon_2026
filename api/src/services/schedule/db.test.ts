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
    const handlers: Record<string, (c: unknown) => void> = {};
    const pool = {
      end: vi.fn().mockResolvedValue(undefined),
      on: (ev: string, fn: (c: unknown) => void) => (handlers[ev] = fn),
    } as unknown as Pool;
    createPool.mockReturnValue(pool);

    expect(resolveScheduleDb()).toBe(pool);
    const query = vi.fn().mockResolvedValue({});
    handlers.connect?.({ query });
    expect(query).toHaveBeenCalledWith('SET statement_timeout = 2000');
  });
});
