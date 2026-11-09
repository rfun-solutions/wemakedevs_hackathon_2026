import { describe, expect, it, vi } from 'vitest';
import { createWebSpeechEngine, type RecognitionLike } from './webspeech';

class Fake implements RecognitionLike {
  static all: Fake[] = [];
  continuous = false;
  interimResults = false;
  lang = '';
  onstart = null;
  onaudiostart: (() => void) | null = null;
  onresult: RecognitionLike['onresult'] = null;
  onerror: RecognitionLike['onerror'] = null;
  onend: (() => void) | null = null;
  started = 0;
  stopped = false;
  constructor() {
    Fake.all.push(this);
  }
  start() {
    this.started++;
  }
  stop() {
    this.stopped = true;
  }
  abort() {
    this.stopped = true;
  }
  result(text: string, isFinal: boolean, index = 0) {
    const r = Object.assign([{ transcript: text }], { isFinal });
    this.onresult?.({ resultIndex: index, results: [r] as never });
  }
}

function setup() {
  Fake.all = [];
  let t = 1000;
  const timers: { fn: () => void; ms: number }[] = [];
  const cb = {
    onSegment: vi.fn(),
    onLag: vi.fn(),
    onFirstWord: vi.fn(),
    onRestart: vi.fn(),
    onGiveUp: vi.fn(),
  };
  const engine = createWebSpeechEngine({
    Recognition: Fake,
    lang: 'en-US',
    ...cb,
    now: () => t,
    setTimer: (fn, ms) => {
      timers.push({ fn, ms });
      return timers.length;
    },
    clearTimer: (h) => {
      timers[(h as number) - 1] = { fn: () => undefined, ms: 0 };
    },
  });
  return {
    engine,
    cb,
    timers,
    advance: (ms: number) => {
      t += ms;
    },
    cur: () => Fake.all[Fake.all.length - 1]!,
  };
}

describe('webspeech engine', () => {
  it('starts continuous with interim results and emits segments', async () => {
    const s = setup();
    await s.engine.start();
    expect(s.cur()).toMatchObject({
      continuous: true,
      interimResults: true,
      lang: 'en-US',
      started: 1,
    });
    s.cur().result('hello', false);
    s.cur().result('hello world', true);
    expect(s.cb.onSegment).toHaveBeenLastCalledWith({
      id: 'ws-1-0',
      text: 'hello world',
      lang: 'en-US',
      final: true,
    });
  });
  it('restarts on end with backoff 250 ms doubling to 4 s, reset after a result', async () => {
    const s = setup();
    await s.engine.start();
    const waits: number[] = [];
    for (let i = 0; i < 4; i++) {
      s.cur().onaudiostart?.(); // audiostart resets the empty-restart counter, so no give up
      s.cur().onend?.();
      waits.push(s.timers[s.timers.length - 1]!.ms);
      s.timers[s.timers.length - 1]!.fn();
    }
    expect(waits).toEqual([250, 500, 1000, 2000]);
    expect(Fake.all).toHaveLength(5);
    expect(s.cb.onRestart).toHaveBeenCalledTimes(4);
    s.cur().result('x', true);
    s.cur().onend?.();
    expect(s.timers[s.timers.length - 1]!.ms).toBe(250);
  });
  it('caps backoff at 4 s', async () => {
    const s = setup();
    await s.engine.start();
    const waits: number[] = [];
    for (let i = 0; i < 6; i++) {
      s.cur().onaudiostart?.();
      s.cur().onend?.();
      waits.push(s.timers[s.timers.length - 1]!.ms);
      s.timers[s.timers.length - 1]!.fn();
    }
    expect(Math.max(...waits)).toBe(4000);
  });
  it('does not restart after stop', async () => {
    const s = setup();
    await s.engine.start();
    s.engine.stop();
    s.cur().onend?.();
    expect(s.timers).toHaveLength(0);
    expect(s.cur().stopped).toBe(true);
  });
  it('stop while a restart is pending cancels it', async () => {
    const s = setup();
    await s.engine.start();
    s.cur().onend?.();
    s.engine.stop();
    s.timers[0]!.fn();
    expect(Fake.all).toHaveLength(1);
  });
  it('gives up after 5 consecutive empty restarts', async () => {
    const s = setup();
    await s.engine.start();
    for (let i = 0; i < 5; i++) {
      s.cur().onend?.();
      s.timers[s.timers.length - 1]!.fn();
    }
    s.cur().onend?.();
    expect(s.cb.onGiveUp).toHaveBeenCalledWith('no_audio');
    expect(s.cb.onRestart).toHaveBeenCalledTimes(5);
  });
  it('gives up on a permission error', async () => {
    const s = setup();
    await s.engine.start();
    s.cur().onerror?.({ error: 'not-allowed' });
    expect(s.cb.onGiveUp).toHaveBeenCalledWith('not-allowed');
  });
  it('measures first-word latency from audiostart, not start()', async () => {
    const s = setup();
    await s.engine.start();
    s.advance(27_000); // slow permission prompt
    s.cur().onaudiostart?.();
    s.advance(800);
    s.cur().result('hi', false);
    expect(s.cb.onFirstWord).toHaveBeenCalledWith(800);
    s.advance(100);
    s.cur().result('hi again', false);
    expect(s.cb.onFirstWord).toHaveBeenCalledTimes(1);
  });
  it('reports lag as last interim to final', async () => {
    const s = setup();
    await s.engine.start();
    s.cur().onaudiostart?.();
    s.cur().result('a', false);
    s.advance(1200);
    s.cur().result('a b', false);
    s.advance(300);
    s.cur().result('a b', true);
    expect(s.cb.onLag).toHaveBeenCalledWith(1500);
  });
});
