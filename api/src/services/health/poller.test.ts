import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHealthPoller, onHealthTransition, STALE_MS } from './poller.js';

type Row = { metric: Record<string, string>; value: [number, string] };
const row = (metric: Record<string, string>, v: number): Row => ({ metric, value: [1, String(v)] });

/** Fake Dash0: span routes in seconds, fallback routes and captions in ms, counts per engine. */
function fake(state: {
  agendaS?: number;
  fallbackMs?: number;
  whisperMs?: number;
  whisperN?: number;
  fail?: boolean;
}): typeof fetch {
  return (async (url: string) => {
    if (state.fail) return new Response('', { status: 500 });
    const q = decodeURIComponent(new URL(url).searchParams.get('query') ?? '');
    let result: Row[] = [];
    if (q.includes('dash0_spans_duration_seconds_bucket')) {
      if (state.agendaS !== undefined)
        result = [
          row({ dash0_operation_name: 'GET /api/agenda' }, state.agendaS),
          row({ dash0_operation_name: 'GET /api/status' }, 9),
        ];
    } else if (q.includes('kc_app_http_server_duration_bucket')) {
      if (state.fallbackMs !== undefined)
        result = [row({ route: 'GET /api/agenda' }, state.fallbackMs)];
    } else if (q.includes('kc_captions_segment_ms_bucket'))
      result = [row({ engine: 'whisper' }, state.whisperMs ?? 500)];
    else if (q.includes('kc_captions_segment_ms_count'))
      result = [row({ engine: 'whisper' }, state.whisperN ?? 50)];
    return new Response(JSON.stringify({ status: 'success', data: { result } }));
  }) as unknown as typeof fetch;
}

const unsubs: (() => void)[] = [];
afterEach(() => {
  unsubs.splice(0).forEach((u) => u());
  vi.useRealTimers();
});

function setup(state: Parameters<typeof fake>[0], token: string | undefined = 't') {
  let t = 1_000_000;
  const f = fake(state);
  const poller = createHealthPoller({ getToken: () => token, fetchFn: f, now: () => t });
  return { poller, advance: (ms: number) => (t += ms), state };
}

describe('health poller', () => {
  it('is healthy when the agenda is fast, and excludes /api/status routes', async () => {
    const { poller } = setup({ agendaS: 0.1 });
    await poller.pollOnce();
    const s = poller.snapshot();
    expect(s.source).toBe('dash0');
    expect(s.routes).toEqual([{ route: '/api/agenda', p95Ms: 100, slow: false }]);
    expect(s.captions.lagging).toBe(false);
  });

  it('keeps fallback route p95 values in milliseconds', async () => {
    const { poller } = setup({ fallbackMs: 250 });
    await poller.pollOnce();
    expect(poller.snapshot().routes).toEqual([{ route: '/api/agenda', p95Ms: 250, slow: false }]);
  });

  it('flags the agenda slow above 300 ms', async () => {
    const { poller } = setup({ agendaS: 2 });
    await poller.pollOnce();
    expect(poller.snapshot().routes[0]).toMatchObject({ route: '/api/agenda', slow: true });
  });

  it('flags captions lagging above 4000 ms only with at least 20 samples', async () => {
    const few = setup({ agendaS: 0.1, whisperMs: 9000, whisperN: 19 });
    await few.poller.pollOnce();
    expect(few.poller.snapshot().captions).toEqual({ p95MsByEngine: {}, lagging: false });
    const enough = setup({ agendaS: 0.1, whisperMs: 9000, whisperN: 20 });
    await enough.poller.pollOnce();
    expect(enough.poller.snapshot().captions.lagging).toBe(true);
  });

  it('is unavailable without a token and makes no query', async () => {
    const f = vi.fn(fake({ agendaS: 2 }));
    const poller = createHealthPoller({ getToken: () => undefined, fetchFn: f });
    await poller.pollOnce();
    expect(f).not.toHaveBeenCalled();
    expect(poller.snapshot().source).toBe('unavailable');
  });

  it('goes unavailable when the last success is older than 120 s', async () => {
    const { poller, advance } = setup({ agendaS: 0.1 });
    await poller.pollOnce();
    advance(STALE_MS - 1);
    expect(poller.snapshot().source).toBe('dash0');
    advance(2);
    expect(poller.snapshot().source).toBe('unavailable');
  });

  it('keeps the last snapshot on a failed poll (until stale) and counts no transition', async () => {
    const { poller, state } = setup({ agendaS: 0.1 });
    await poller.pollOnce();
    state.fail = true;
    await poller.pollOnce();
    expect(poller.snapshot().source).toBe('dash0');
  });

  it('calls subscribers once per healthy-to-breached transition', async () => {
    const cb = vi.fn();
    unsubs.push(onHealthTransition(cb));
    const { poller, state } = setup({ agendaS: 0.1 });
    await poller.pollOnce();
    expect(cb).not.toHaveBeenCalled();
    state.agendaS = 2;
    await poller.pollOnce();
    await poller.pollOnce(); // still breached: no second call
    expect(cb).toHaveBeenCalledTimes(1);
    state.agendaS = 0.1;
    await poller.pollOnce();
    state.agendaS = 3;
    await poller.pollOnce();
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('polls every 30 s with fake timers once started', async () => {
    vi.useFakeTimers();
    const f = vi.fn(fake({ agendaS: 0.1 }));
    const poller = createHealthPoller({ getToken: () => 't', fetchFn: f });
    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    const first = f.mock.calls.length;
    expect(first).toBeGreaterThan(0);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(f.mock.calls.length).toBe(first * 2);
    poller.stop();
  });
});
