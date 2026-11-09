import { describe, expect, it, vi } from 'vitest';
import { startCaptionsWith, startDictation, type CaptionStatus, type SessionDeps } from './index';
import type { Engine, EngineCallbacks } from './types';
import type { Capabilities } from './engine';

const ALL: Capabilities = {
  worker: true,
  audioContext: true,
  getUserMedia: true,
  speechRecognition: true,
};

function engineFake(id: 'whisper' | 'webspeech', fail = false) {
  let cb!: EngineCallbacks;
  const e: Engine & { cb: () => EngineCallbacks } = {
    id,
    start: vi.fn(() => (fail ? Promise.reject(new Error('x')) : Promise.resolve())),
    stop: vi.fn(),
    cb: () => cb,
  };
  return { e, setCb: (c: EngineCallbacks) => (cb = c) };
}

function deps(
  over: Omit<Partial<SessionDeps>, 'platform'> & {
    platform?: 'ios' | 'desktop-chromium' | 'other';
    whisperFails?: boolean;
  } = {},
) {
  const ws = engineFake('webspeech');
  const wh = engineFake('whisper', over.whisperFails);
  const { platform: plat, whisperFails: _wf, ...rest } = over;
  void _wf;
  const platform = plat ?? 'desktop-chromium';
  const d: SessionDeps = {
    platform: { platform, deviceClass: platform === 'ios' ? 'ios' : 'desktop', standalone: false },
    caps: ALL,
    requestMic: vi.fn().mockResolvedValue(true),
    fetchHealth: vi.fn().mockResolvedValue({ fasterEngine: null, lagging: false }),
    makeWebSpeech: vi.fn((cb) => {
      ws.setCb(cb);
      return ws.e;
    }),
    makeWhisper: vi.fn((cb) => {
      wh.setCb(cb);
      return wh.e;
    }),
    hasConsent: vi.fn().mockReturnValue(true),
    saveConsent: vi.fn(),
    reporter: { add: vi.fn(), flush: vi.fn(), start: vi.fn(), stop: vi.fn() },
    ...rest,
  };
  return { d, ws, wh };
}

describe('startCaptionsWith', () => {
  it('iOS never calls the Whisper model loader or creates the worker', async () => {
    const { d } = deps({ platform: 'ios' });
    const s = await startCaptionsWith(d, vi.fn());
    expect(s.engine).toBe('webspeech');
    expect(d.makeWhisper).not.toHaveBeenCalled();
    expect(d.hasConsent).not.toHaveBeenCalled();
  });
  it('desktop Chromium picks whisper first when consent is stored', async () => {
    const { d } = deps();
    const status: CaptionStatus[] = [];
    const s = await startCaptionsWith(d, vi.fn(), { onStatus: (x) => status.push(x) });
    expect(s.engine).toBe('whisper');
    expect(status).toContainEqual({ type: 'engine', engine: 'whisper', fallback: false });
  });
  it('declined consent falls back to webspeech without making the model loader', async () => {
    const { d } = deps({ hasConsent: vi.fn().mockReturnValue(false) });
    const status: CaptionStatus[] = [];
    const s = await startCaptionsWith(d, vi.fn(), {
      requestConsent: async () => false,
      onStatus: (x) => status.push(x),
    });
    expect(s.engine).toBe('webspeech');
    expect(d.makeWhisper).not.toHaveBeenCalled();
    expect(status).toContainEqual({ type: 'engine', engine: 'webspeech', fallback: true });
  });
  it('accepted consent is saved and no request is made without it', async () => {
    const { d } = deps({ hasConsent: vi.fn().mockReturnValue(false) });
    const s = await startCaptionsWith(d, vi.fn(), { requestConsent: async () => true });
    expect(s.engine).toBe('whisper');
    expect(d.saveConsent).toHaveBeenCalled();
  });
  it('whisper load failure falls back to webspeech', async () => {
    const { d } = deps({ whisperFails: true });
    const s = await startCaptionsWith(d, vi.fn());
    expect(s.engine).toBe('webspeech');
  });
  it('mic is requested before any engine starts; denial gives a status and no session', async () => {
    const { d, ws } = deps({ requestMic: vi.fn().mockResolvedValue(false) });
    const status: CaptionStatus[] = [];
    const s = await startCaptionsWith(d, vi.fn(), { onStatus: (x) => status.push(x) });
    expect(s.supported).toBe(false);
    expect(status).toEqual([{ type: 'mic_denied' }]);
    expect(ws.e.start).not.toHaveBeenCalled();
  });
  it('mic permission is requested before start()', async () => {
    const order: string[] = [];
    const { d, ws } = deps({
      platform: 'ios',
      requestMic: vi.fn(async () => {
        order.push('mic');
        return true;
      }),
    });
    (ws.e.start as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      order.push('start');
    });
    await startCaptionsWith(d, vi.fn());
    expect(order).toEqual(['mic', 'start']);
  });
  it('no capable engine: unsupported status', async () => {
    const { d } = deps({ platform: 'other', caps: { ...ALL, speechRecognition: false } });
    const status: CaptionStatus[] = [];
    const s = await startCaptionsWith(d, vi.fn(), { onStatus: (x) => status.push(x) });
    expect(s.supported).toBe(false);
    expect(status).toEqual([{ type: 'unsupported' }]);
  });
  it('health: faster engine goes first, lagging shows the everyone message', async () => {
    const { d } = deps({
      fetchHealth: vi.fn().mockResolvedValue({ fasterEngine: 'webspeech', lagging: true }),
    });
    const status: CaptionStatus[] = [];
    const s = await startCaptionsWith(d, vi.fn(), { onStatus: (x) => status.push(x) });
    expect(s.engine).toBe('webspeech');
    expect(status[0]).toEqual({ type: 'slow_everyone' });
  });
  it('3 slow chunks on whisper switch once to webspeech with a status and stop the old engine', async () => {
    const { d, wh, ws } = deps();
    const status: CaptionStatus[] = [];
    const s = await startCaptionsWith(d, vi.fn(), { onStatus: (x) => status.push(x) });
    for (let i = 0; i < 3; i++) wh.e.cb().onLag?.(5000);
    await vi.waitFor(() => expect(status.some((x) => x.type === 'switched')).toBe(true));
    expect(s.engine).toBe('webspeech');
    expect(status).toContainEqual({ type: 'switched', from: 'whisper', to: 'webspeech' });
    expect(wh.e.stop).toHaveBeenCalled();
    for (let i = 0; i < 6; i++) ws.e.cb().onLag?.(9000);
    expect(status.filter((x) => x.type === 'switched')).toHaveLength(1);
    expect(d.reporter.add).toHaveBeenCalledWith('whisper', 5000);
  });
  it('3 slow chunks on iOS: message only, no switch', async () => {
    const { d, ws } = deps({ platform: 'ios' });
    const status: CaptionStatus[] = [];
    const s = await startCaptionsWith(d, vi.fn(), { onStatus: (x) => status.push(x) });
    for (let i = 0; i < 3; i++) ws.e.cb().onLag?.(6000);
    expect(status).toContainEqual({ type: 'slow_here' });
    expect(s.engine).toBe('webspeech');
  });
  it('stop stops the engine and the reporter; segments are forwarded until then', async () => {
    const { d, ws } = deps({ platform: 'ios' });
    const onSeg = vi.fn();
    const s = await startCaptionsWith(d, onSeg);
    ws.e.cb().onSegment({ id: '1', text: 'a', lang: 'en', final: true });
    expect(onSeg).toHaveBeenCalledTimes(1);
    s.stop();
    ws.e.cb().onSegment({ id: '2', text: 'b', lang: 'en', final: true });
    expect(onSeg).toHaveBeenCalledTimes(1);
    expect(ws.e.stop).toHaveBeenCalled();
    expect(d.reporter.stop).toHaveBeenCalled();
  });
});

describe('startCaptionsWith regressions (Gitar review)', () => {
  it('the old engine keeps captioning while the new engine is still starting', async () => {
    const { d, ws, wh } = deps({
      fetchHealth: vi.fn().mockResolvedValue({ fasterEngine: 'webspeech', lagging: false }),
    });
    let release!: () => void;
    (wh.e.start as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise<void>((r) => (release = r)),
    );
    const onSeg = vi.fn();
    const status: CaptionStatus[] = [];
    const s = await startCaptionsWith(d, onSeg, { onStatus: (x) => status.push(x) });
    expect(s.engine).toBe('webspeech');
    for (let i = 0; i < 3; i++) ws.e.cb().onLag?.(5000); // starts switching to whisper (consent stored)
    await vi.waitFor(() => expect(wh.e.start).toHaveBeenCalled());
    ws.e.cb().onSegment({ id: 'x', text: 'still here', lang: 'en', final: true });
    expect(onSeg).toHaveBeenCalledWith(expect.objectContaining({ text: 'still here' }));
    release();
    await vi.waitFor(() => expect(status.some((x) => x.type === 'switched')).toBe(true));
    expect(s.engine).toBe('whisper');
  });

  it('a declined consent is remembered: the SLI switch does not ask again', async () => {
    const { d, ws } = deps({ hasConsent: vi.fn().mockReturnValue(false) });
    const ask = vi.fn().mockResolvedValue(false);
    await startCaptionsWith(d, vi.fn(), { requestConsent: ask });
    expect(ask).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 3; i++) ws.e.cb().onLag?.(6000);
    await new Promise((r) => setTimeout(r, 10));
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('download progress status is throttled to 10% steps', async () => {
    const { d } = deps({ hasConsent: vi.fn().mockReturnValue(true) });
    let progress!: (l: number, t: number) => void;
    (d.makeWhisper as ReturnType<typeof vi.fn>).mockImplementation((_cb, hooks) => {
      progress = hooks.onProgress;
      return { id: 'whisper', start: vi.fn().mockResolvedValue(undefined), stop: vi.fn() };
    });
    const status: CaptionStatus[] = [];
    await startCaptionsWith(d, vi.fn(), { onStatus: (x) => status.push(x) });
    for (let i = 0; i <= 100; i++) progress(i, 100);
    expect(status.filter((x) => x.type === 'downloading')).toHaveLength(11);
  });
});

describe('startDictation', () => {
  it('is unsupported without SpeechRecognition', async () => {
    expect((await startDictation(vi.fn())).supported).toBe(false);
  });
});
