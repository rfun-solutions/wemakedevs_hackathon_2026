import { describe, expect, it, vi } from 'vitest';
import { cleanAnswer, createAgent0Service, parseRunTaskReply } from './agent0.js';

const sse = (text: string) =>
  `event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: 1, result: { content: [{ type: 'text', text }] } })}\n\n`;
const ok = (text: string) => new Response(sse(text), { status: 200 });

function setup(fetchFn: typeof fetch, extra: Parameters<typeof createAgent0Service>[0] = {}) {
  let t = 1_000_000;
  const svc = createAgent0Service({
    fetchFn,
    getToken: () => 'test-token',
    now: () => t,
    ...extra,
  });
  return { svc, advance: (ms: number) => (t += ms) };
}

describe('parseRunTaskReply', () => {
  it('reads the answer from SSE and drops the conversation link', () => {
    const body = sse('The agenda is slow.\n\nOpen conversation in Dash0: https://x?thread_id=1');
    expect(parseRunTaskReply(body)).toBe('The agenda is slow.');
  });
  it('accepts plain JSON, rejects errors and empties', () => {
    expect(
      parseRunTaskReply(JSON.stringify({ result: { content: [{ type: 'text', text: 'ok' }] } })),
    ).toBe('ok');
    expect(() => parseRunTaskReply('data: {"error":{"message":"no"}}')).toThrow();
    expect(() => parseRunTaskReply('data: {"result":{"isError":true}}')).toThrow();
    expect(() => parseRunTaskReply('data: {"result":{"content":[]}}')).toThrow(/empty/);
    expect(() => parseRunTaskReply('garbage')).toThrow();
  });
  it('cleanAnswer collapses whitespace', () => {
    expect(cleanAnswer('a\n b   c')).toBe('a b c');
  });
});

describe('Agent0 service', () => {
  it('stores the answer on success, sending the bearer token and runTask params', async () => {
    const fetchFn = vi.fn(async () => ok('Agenda is slow right now.')) as unknown as typeof fetch;
    const { svc } = setup(fetchFn);
    expect(await svc.trigger()).toBe('stored');
    expect(svc.current()?.text).toBe('Agenda is slow right now.');
    const [, init] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
    const body = JSON.parse(init.body as string);
    expect(body.params.name).toBe('runTask');
    expect(body.params.arguments.dataset).toBe('default');
    expect(typeof body.params.arguments.message).toBe('string');
  });

  it('reports a timeout and stores nothing', async () => {
    const fetchFn = vi.fn(async () => {
      throw new DOMException('timed out', 'TimeoutError');
    }) as unknown as typeof fetch;
    const { svc } = setup(fetchFn);
    expect(await svc.trigger()).toBe('timeout');
    expect(svc.current()).toBeNull();
    expect(await svc.explain('en')).toBeNull();
  });

  it('reports auth refused on 401 and 403', async () => {
    for (const status of [401, 403]) {
      const { svc } = setup((async () => new Response('no', { status })) as typeof fetch);
      expect(await svc.trigger()).toBe('auth_refused');
      expect(svc.current()).toBeNull();
    }
  });

  it('reports no_token without calling fetch', async () => {
    const fetchFn = vi.fn() as unknown as typeof fetch;
    const { svc } = setup(fetchFn, { getToken: () => undefined });
    expect(await svc.trigger()).toBe('no_token');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('debounces to once per 10 minutes, including after a failure', async () => {
    const fetchFn = vi.fn(async () => ok('x')) as unknown as typeof fetch;
    const { svc, advance } = setup(fetchFn);
    expect(await svc.trigger()).toBe('stored');
    advance(9 * 60_000);
    expect(await svc.trigger()).toBe('debounced');
    advance(61_000);
    expect(await svc.trigger()).toBe('stored');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('does not start a second task while one is running', async () => {
    let release!: (r: Response) => void;
    const fetchFn = vi.fn(
      () => new Promise<Response>((r) => (release = r)),
    ) as unknown as typeof fetch;
    const { svc } = setup(fetchFn);
    const first = svc.trigger();
    expect(await svc.trigger()).toBe('running');
    release(ok('done'));
    expect(await first).toBe('stored');
  });

  it('fires from the injected transition subscription, once per transition', async () => {
    let fire: () => void = () => undefined;
    const fetchFn = vi.fn(async () => ok('x')) as unknown as typeof fetch;
    setup(fetchFn, { subscribe: (cb) => void (fire = cb) });
    fire();
    fire(); // second is running or debounced
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
  });

  it('translates to Spanish once, caches until the next sentence, and falls back to English on failure', async () => {
    const translate = vi.fn(async (t: string) => `ES:${t}`);
    const answers = ['first', 'second'];
    const fetchFn = vi.fn(async () => ok(answers.shift() ?? 'x')) as unknown as typeof fetch;
    const { svc, advance } = setup(fetchFn, { translate });
    await svc.trigger();
    expect((await svc.explain('es'))?.text).toBe('ES:first');
    expect((await svc.explain('es'))?.text).toBe('ES:first');
    expect(translate).toHaveBeenCalledTimes(1);
    expect((await svc.explain('en'))?.text).toBe('first');

    advance(11 * 60_000);
    await svc.trigger();
    expect((await svc.explain('es'))?.text).toBe('ES:second');
    expect(translate).toHaveBeenCalledTimes(2);

    const failing = setup(fetchFn, {
      translate: async () => {
        throw new Error('llm down');
      },
    });
    await failing.svc.trigger();
    expect(await failing.svc.explain('es')).toMatchObject({ lang: 'en' });
  });
});
