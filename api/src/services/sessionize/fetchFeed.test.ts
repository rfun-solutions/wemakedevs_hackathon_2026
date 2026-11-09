import { describe, it, expect, afterEach } from 'vitest';
import type { Server } from 'node:http';
// @ts-expect-error plain .mjs without types
import { createServer } from '../../../../feed-contract/mock-upstream/server.mjs';
import { fetchFeed, FeedHttpError } from './fetchFeed';

let server: Server | undefined;
async function start(opts?: { fixture?: string; mode?: string }) {
  server = createServer(opts) as Server;
  await new Promise<void>((r) => server!.listen(0, r));
  return `http://127.0.0.1:${(server.address() as { port: number }).port}/feed`;
}
afterEach(() => new Promise<void>((r) => (server ? server.close(() => r()) : r())));

describe('fetchFeed', () => {
  it('returns parsed JSON on 200', async () => {
    const feed = (await fetchFeed(await start())) as { sessions: unknown[] };
    expect(feed.sessions).toHaveLength(60);
  });
  it('throws FeedHttpError with the status on 429 (no retry)', async () => {
    const url = await start({ mode: '429' });
    await expect(fetchFeed(url)).rejects.toMatchObject({ name: 'FeedHttpError', status: 429 });
    await expect(fetchFeed(url)).rejects.toBeInstanceOf(FeedHttpError);
  });
  it('aborts on timeout', async () => {
    const slow = (() => new Promise(() => {})) as unknown as typeof fetch;
    const fetchImpl = ((_u: string, init: RequestInit) =>
      new Promise((_r, rej) =>
        init.signal!.addEventListener('abort', () => rej(init.signal!.reason)),
      )) as unknown as typeof fetch;
    void slow;
    await expect(fetchFeed('http://x', { timeoutMs: 20, fetchImpl })).rejects.toBeDefined();
  });
});
