import { describe, expect, it, vi } from 'vitest';
import { PROMQL_CONFIG, PromQLError, queryPromQL } from './promql.js';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const ok = (result: unknown[]) => json({ status: 'success', data: { result } });

describe('queryPromQL', () => {
  it('queries the Dash0 host and path with a bearer token and returns samples', async () => {
    const fetchFn = vi.fn(async () =>
      ok([{ metric: { engine: 'whisper' }, value: [1, '1234'] }]),
    ) as unknown as typeof fetch;
    const out = await queryPromQL('up', { token: 'tok', fetchFn });
    expect(out).toEqual([{ metric: { engine: 'whisper' }, value: 1234 }]);
    const [url, init] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url.startsWith(PROMQL_CONFIG.apiHost + PROMQL_CONFIG.queryPath)).toBe(true);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('maps 401 to auth, a stall to timeout, and a missing token to no_token', async () => {
    await expect(
      queryPromQL('up', { token: 't', fetchFn: (async () => json({}, 401)) as typeof fetch }),
    ).rejects.toMatchObject({ reason: 'auth' });
    const stall = ((_u: string, init: RequestInit) =>
      new Promise((_r, rej) =>
        init.signal?.addEventListener('abort', () => rej(init.signal?.reason)),
      )) as unknown as typeof fetch;
    await expect(
      queryPromQL('up', { token: 't', fetchFn: stall, timeoutMs: 10 }),
    ).rejects.toMatchObject({ reason: 'timeout' });
    await expect(queryPromQL('up', { token: undefined })).rejects.toBeInstanceOf(PromQLError);
  });

  it('returns an empty array for no data and drops non-finite values', async () => {
    expect(
      await queryPromQL('up', { token: 't', fetchFn: (async () => ok([])) as typeof fetch }),
    ).toEqual([]);
    const nan = (async () => ok([{ metric: {}, value: [1, 'NaN'] }])) as typeof fetch;
    expect(await queryPromQL('up', { token: 't', fetchFn: nan })).toEqual([]);
  });
});
