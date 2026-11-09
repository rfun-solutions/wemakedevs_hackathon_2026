import type { Engine, EngineCallbacks } from './types';
import { createChunker } from './chunker';
import { span } from './telemetry';
import type { WorkerIn, WorkerOut } from './whisper.worker';

export const LOAD_STALL_MS = 30_000;

export interface WhisperWorkerLike {
  postMessage(m: WorkerIn, transfer?: Transferable[]): void;
  terminate(): void;
  onmessage: ((e: { data: WorkerOut }) => void) | null;
}

export interface WhisperOptions extends EngineCallbacks {
  /** Creates the worker. Only ever called when the platform allows Whisper (never on iOS). */
  createWorker: () => WhisperWorkerLike;
  onDownloadProgress?(loaded: number, total: number): void;
  /** Source of mic audio; injectable for tests. Returns a stop function. */
  startAudio?: (onSamples: (s: Float32Array, rate: number) => void) => Promise<() => void>;
  signal?: AbortSignal;
  lang?: string;
  loadStallMs?: number;
}

/** Real microphone capture via getUserMedia + ScriptProcessor (AudioWorklet is a later improvement). */
export async function startMicAudio(
  onSamples: (s: Float32Array, rate: number) => void,
): Promise<() => void> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const Ctx = (globalThis.AudioContext ??
    (globalThis as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext) as typeof AudioContext;
  const ctx = new Ctx();
  const src = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  proc.onaudioprocess = (e) =>
    onSamples(new Float32Array(e.inputBuffer.getChannelData(0)), ctx.sampleRate);
  src.connect(proc);
  proc.connect(ctx.destination);
  return () => {
    proc.disconnect();
    src.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
  };
}

/** Whisper engine: loads the model in a worker, decodes ~5 s chunks one at a time. */
export function createWhisperEngine(opts: WhisperOptions): Engine {
  let worker: WhisperWorkerLike | null = null;
  let stopAudio: (() => void) | null = null;
  let running = false;
  let nextId = 0;
  const pending = new Map<number, { at: number; audioS: number }>();
  const lang = opts.lang?.split('-')[0];

  function terminate(): void {
    worker?.terminate();
    worker = null;
  }

  function load(w: WhisperWorkerLike): Promise<void> {
    const stallMs = opts.loadStallMs ?? LOAD_STALL_MS;
    return new Promise((resolve, reject) => {
      let stall: ReturnType<typeof setTimeout>;
      const fail = (m: string) => {
        clearTimeout(stall);
        reject(new Error(m));
      };
      const arm = () => {
        clearTimeout(stall);
        stall = setTimeout(() => fail('load_timeout'), stallMs);
      };
      opts.signal?.addEventListener('abort', () => fail('aborted'), { once: true });
      if (opts.signal?.aborted) return fail('aborted');
      arm();
      w.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'progress') {
          arm();
          opts.onDownloadProgress?.(m.loaded, m.total);
        } else if (m.type === 'ready') {
          clearTimeout(stall);
          span.modelLoad({ bytes: m.bytes, ms: m.ms, backend: m.backend });
          resolve();
        } else if (m.type === 'error') {
          fail(m.message);
        }
      };
      w.postMessage({ type: 'load' });
    });
  }

  function onWorkerMessage(e: { data: WorkerOut }): void {
    const m = e.data;
    if (m.type !== 'result') return;
    const p = pending.get(m.id);
    pending.delete(m.id);
    span.chunkDecode({ ms: m.ms, audioS: p?.audioS ?? 0 });
    if (p) opts.onLag?.(Date.now() - p.at);
    if (m.text)
      opts.onSegment({ id: `wh-${m.id}`, text: m.text, lang: lang ?? 'und', final: true });
  }

  return {
    id: 'whisper',
    async start() {
      const w = opts.createWorker();
      worker = w;
      try {
        await load(w);
      } catch (err) {
        terminate();
        throw err;
      }
      w.onmessage = onWorkerMessage;
      running = true;
      let live: ReturnType<typeof createChunker> | null = null;
      const startAudio = opts.startAudio ?? startMicAudio;
      stopAudio = await startAudio((samples, rate) => {
        if (!running) return;
        live ??= createChunker(rate, (pcm, audioS) => {
          const id = nextId++;
          pending.set(id, { at: Date.now(), audioS });
          worker?.postMessage({ type: 'decode', id, pcm, lang }, [pcm.buffer]);
        });
        live.push(samples);
      });
    },
    stop() {
      running = false;
      stopAudio?.();
      stopAudio = null;
      terminate();
    },
  };
}
