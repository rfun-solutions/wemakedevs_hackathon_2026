/// <reference lib="webworker" />
// Whisper worker: transformers.js whisper-tiny (multilingual), WebGPU first then WASM. Never created on iOS.
import { pipeline } from '@huggingface/transformers';

export type WorkerIn =
  { type: 'load' } | { type: 'decode'; id: number; pcm: Float32Array; lang?: string };
export type WorkerOut =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'ready'; backend: 'webgpu' | 'wasm'; ms: number; bytes: number }
  | { type: 'error'; message: string }
  | { type: 'result'; id: number; text: string; ms: number };

export const MODEL_ID = 'Xenova/whisper-tiny';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let transcriber: any = null;
const post = (m: WorkerOut) => (self as unknown as Worker).postMessage(m);

async function load(): Promise<void> {
  const started = performance.now();
  const bytesByFile = new Map<string, number>();
  const loadedByFile = new Map<string, number>();
  let lastProgressBucket = -1;
  const progress_callback = (p: {
    status: string;
    file?: string;
    loaded?: number;
    total?: number;
  }) => {
    if (p.status === 'progress' && p.file && p.total) {
      bytesByFile.set(p.file, p.total);
      loadedByFile.set(p.file, p.loaded ?? 0);
      const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
      const loaded = sum(loadedByFile);
      const total = sum(bytesByFile);
      const percent = total > 0 ? Math.min(100, Math.floor((loaded / total) * 100)) : 0;
      const bucket = Math.floor(percent / 10);
      if (bucket > lastProgressBucket) {
        lastProgressBucket = bucket;
        post({ type: 'progress', loaded, total });
      }
    }
  };
  let backend: 'webgpu' | 'wasm' = 'wasm';
  try {
    if ('gpu' in navigator) {
      transcriber = await pipeline('automatic-speech-recognition', MODEL_ID, {
        device: 'webgpu',
        progress_callback,
      });
      backend = 'webgpu';
    }
  } catch {
    transcriber = null;
  }
  if (!transcriber) {
    transcriber = await pipeline('automatic-speech-recognition', MODEL_ID, {
      device: 'wasm',
      progress_callback,
    });
  }
  let bytes = 0;
  for (const v of bytesByFile.values()) bytes += v;
  post({ type: 'ready', backend, ms: Math.round(performance.now() - started), bytes });
}

self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  const msg = e.data;
  try {
    if (msg.type === 'load') {
      await load();
    } else if (msg.type === 'decode' && transcriber) {
      const t0 = performance.now();
      const out = await transcriber(msg.pcm, {
        task: 'transcribe',
        ...(msg.lang ? { language: msg.lang } : {}),
      });
      const text = (Array.isArray(out) ? out[0]?.text : out?.text) ?? '';
      post({
        type: 'result',
        id: msg.id,
        text: String(text).trim(),
        ms: Math.round(performance.now() - t0),
      });
    }
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
