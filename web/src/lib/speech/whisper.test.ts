import { describe, expect, it, vi } from 'vitest';
import { createWhisperEngine, type WhisperWorkerLike } from './whisper';
import type { WorkerIn, WorkerOut } from './whisper.worker';

function fakeWorker(autoReady = true) {
  const sent: WorkerIn[] = [];
  const w: WhisperWorkerLike & { emit(m: WorkerOut): void; terminated: boolean } = {
    terminated: false,
    onmessage: null,
    postMessage(m) {
      sent.push(m);
      if (m.type === 'load' && autoReady)
        queueMicrotask(() => w.emit({ type: 'ready', backend: 'wasm', ms: 10, bytes: 100 }));
    },
    terminate() {
      w.terminated = true;
    },
    emit(m) {
      w.onmessage?.({ data: m });
    },
  };
  return { w, sent };
}

describe('whisper engine', () => {
  it('loads the model, chunks mic audio to 16 kHz ~5 s and turns results into final segments with lag', async () => {
    const { w, sent } = fakeWorker();
    const onSegment = vi.fn();
    const onLag = vi.fn();
    let push!: (s: Float32Array, rate: number) => void;
    const stopAudio = vi.fn();
    const e = createWhisperEngine({
      onSegment,
      onLag,
      createWorker: () => w,
      startAudio: async (cb) => {
        push = cb;
        return stopAudio;
      },
    });
    await e.start();
    for (let i = 0; i < 5; i++) push(new Float32Array(48_000), 48_000);
    const decode = sent.find((m) => m.type === 'decode');
    expect(decode).toMatchObject({ type: 'decode', id: 0 });
    expect((decode as Extract<WorkerIn, { type: 'decode' }>).pcm.length).toBe(80_000);
    w.emit({ type: 'result', id: 0, text: 'hello there', ms: 900 });
    expect(onSegment).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'wh-0', text: 'hello there', final: true }),
    );
    expect(onLag).toHaveBeenCalledTimes(1);
    e.stop();
    expect(stopAudio).toHaveBeenCalled();
    expect(w.terminated).toBe(true);
  });

  it('empty decode results produce no segment', async () => {
    const { w } = fakeWorker();
    const onSegment = vi.fn();
    let push!: (s: Float32Array, rate: number) => void;
    const e = createWhisperEngine({
      onSegment,
      createWorker: () => w,
      startAudio: async (cb) => ((push = cb), () => undefined),
    });
    await e.start();
    for (let i = 0; i < 5; i++) push(new Float32Array(16_000), 16_000);
    w.emit({ type: 'result', id: 0, text: '', ms: 5 });
    expect(onSegment).not.toHaveBeenCalled();
  });

  it('reports download progress and stalls out after the stall limit', async () => {
    const { w } = fakeWorker(false);
    const progress = vi.fn();
    const e = createWhisperEngine({
      onSegment: vi.fn(),
      createWorker: () => w,
      onDownloadProgress: progress,
      loadStallMs: 20,
    });
    const started = e.start();
    w.emit({ type: 'progress', loaded: 5, total: 10 });
    expect(progress).toHaveBeenCalledWith(5, 10);
    await expect(started).rejects.toThrow('load_timeout');
    expect(w.terminated).toBe(true);
  });

  it('aborting the signal cancels the download and terminates the worker', async () => {
    const { w } = fakeWorker(false);
    const ctrl = new AbortController();
    const e = createWhisperEngine({
      onSegment: vi.fn(),
      createWorker: () => w,
      signal: ctrl.signal,
    });
    const started = e.start();
    ctrl.abort();
    await expect(started).rejects.toThrow('aborted');
    expect(w.terminated).toBe(true);
  });

  it('a worker error during load rejects start', async () => {
    const { w } = fakeWorker(false);
    const e = createWhisperEngine({ onSegment: vi.fn(), createWorker: () => w });
    const started = e.start();
    w.emit({ type: 'error', message: 'wasm failed' });
    await expect(started).rejects.toThrow('wasm failed');
  });
});
