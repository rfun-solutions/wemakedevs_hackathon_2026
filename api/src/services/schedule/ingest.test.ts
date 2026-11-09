import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { runIngest, type PoolLike } from './ingest.js';

const fixture = JSON.parse(
  readFileSync(
    new URL('../../../../feed-contract/fixtures/sessionize-v1.json', import.meta.url),
    'utf8',
  ),
);

function fakePool() {
  const log: { text: string; params?: unknown[] }[] = [];
  const q = async (text: string, params?: unknown[]) => {
    log.push({ text, params });
    return { rows: text.includes('RETURNING id') ? [{ id: 7 }] : [] };
  };
  const pool: PoolLike = {
    query: q,
    connect: async () => ({ query: q, release: () => undefined }),
  };
  return { pool, log };
}

describe('runIngest', () => {
  it('upserts all sessions in one transaction and records ok', async () => {
    const { pool, log } = fakePool();
    const r = await runIngest({ pool, fetchFeedImpl: async () => fixture });
    expect(r).toEqual({ status: 'ok', sessionCount: 60 });
    expect(log.filter((l) => l.text.includes('INSERT INTO sessions'))).toHaveLength(60);
    const texts = log.map((l) => l.text.trim());
    expect(texts).toContain('BEGIN');
    expect(texts).toContain('COMMIT');
    const done = log.find((l) => l.text.includes("status='ok'"))!;
    expect(done.params).toEqual([7, 60]);
  });
  it('records an error and writes nothing when the shape drifts', async () => {
    const { pool, log } = fakePool();
    const r = await runIngest({ pool, fetchFeedImpl: async () => ({ sessions: [] }) });
    expect(r.status).toBe('error');
    expect(log.some((l) => l.text.includes('INSERT INTO sessions'))).toBe(false);
    expect(log.some((l) => l.text.includes("status='error'"))).toBe(true);
  });
  it('records an error when the fetch fails (no retry)', async () => {
    const { pool } = fakePool();
    let calls = 0;
    const r = await runIngest({
      pool,
      fetchFeedImpl: async () => {
        calls++;
        throw new Error('HTTP 429');
      },
    });
    expect(r).toMatchObject({ status: 'error' });
    expect(calls).toBe(1);
  });
});
