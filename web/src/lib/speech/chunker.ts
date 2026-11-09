export const TARGET_RATE = 16_000;
export const CHUNK_SECONDS = 5;

/** Linear-interpolation resample of mono PCM to 16 kHz. */
export function resampleTo16k(input: Float32Array, fromRate: number): Float32Array {
  if (fromRate === TARGET_RATE) return input;
  const ratio = fromRate / TARGET_RATE;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = pos - i0;
    out[i] = input[i0]! * (1 - frac) + input[i1]! * frac;
  }
  return out;
}

export interface Chunker {
  /** Push mono samples at the source rate; calls onChunk with each full ~5 s 16 kHz chunk. */
  push(samples: Float32Array): void;
  /** Emit whatever is buffered (at least 1 s) as a final chunk. */
  flush(): void;
}

export function createChunker(
  sourceRate: number,
  onChunk: (pcm16k: Float32Array, audioSeconds: number) => void,
  chunkSeconds = CHUNK_SECONDS,
): Chunker {
  const size = TARGET_RATE * chunkSeconds;
  let buf = new Float32Array(0);
  const append = (extra: Float32Array) => {
    const next = new Float32Array(buf.length + extra.length);
    next.set(buf);
    next.set(extra, buf.length);
    buf = next;
  };
  return {
    push(samples) {
      append(resampleTo16k(samples, sourceRate));
      while (buf.length >= size) {
        onChunk(buf.slice(0, size), chunkSeconds);
        buf = buf.slice(size);
      }
    },
    flush() {
      if (buf.length >= TARGET_RATE) onChunk(buf, buf.length / TARGET_RATE);
      buf = new Float32Array(0);
    },
  };
}
