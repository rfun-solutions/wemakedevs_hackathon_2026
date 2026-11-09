import { describe, expect, it } from 'vitest';
import {
  DEMO_DAYS,
  DEMO_DEVICE_ID,
  meetsDemoShape,
  seedThreads,
  summarize,
} from './threads-demo.js';

const T = (firstDay: string, lastDay: string, kinds: string[]) => ({
  id: 'x',
  firstDay,
  lastDay,
  actions: kinds.map((kind) => ({ kind })),
});

describe('threads demo seed', () => {
  it('summarizes the demo shape', () => {
    const s = summarize([
      T('2026-11-10', '2026-11-11', ['promise']),
      T('2026-11-10', '2026-11-10', ['follow_up']),
      T('2026-11-12', '2026-11-12', []),
    ]);
    expect(s).toEqual({ threads: 3, spanningDays: 1, withActions: 2, withPromise: 1 });
    expect(meetsDemoShape(s)).toBe(true);
    expect(meetsDemoShape({ ...s, withPromise: 0 })).toBe(false);
  });

  it('seeds then threads each day for the demo device, never contacting a real host', async () => {
    const calls: string[] = [];
    const fetchFn = (async (url: URL, init: RequestInit) => {
      calls.push(
        `${init.method} ${url.pathname} ${(init.headers as Record<string, string>)['x-device-id']} ${init.body ?? ''}`,
      );
      const body =
        url.pathname === '/api/threads'
          ? { threads: [T('2026-11-10', '2026-11-11', ['promise'])] }
          : { mode: 'heuristic', notesIn: 4 };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as unknown as typeof fetch;
    const s = await seedThreads('http://localhost:3111', fetchFn, () => undefined);
    expect(calls[0]).toContain('POST /api/capture/seed');
    expect(calls.slice(1, 4).map((c) => c.split(' ').slice(3).join(' '))).toEqual(
      DEMO_DAYS.map((date) => JSON.stringify({ date })),
    );
    expect(calls.every((c) => c.includes(DEMO_DEVICE_ID))).toBe(true);
    expect(s.threads).toBe(1);
  });

  it('fails clearly when the seed endpoint is disabled (404)', async () => {
    const fetchFn = (async () => new Response('{}', { status: 404 })) as unknown as typeof fetch;
    await expect(seedThreads('http://x', fetchFn, () => undefined)).rejects.toThrow('HTTP 404');
  });
});
