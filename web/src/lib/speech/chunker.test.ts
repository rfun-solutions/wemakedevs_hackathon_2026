import { describe, expect, it } from 'vitest';
import { createChunker, resampleTo16k } from './chunker';

describe('chunker', () => {
  it('resamples 48 kHz to 16 kHz (one third the samples)', () => {
    expect(resampleTo16k(new Float32Array(48_000), 48_000).length).toBe(16_000);
    const same = new Float32Array(10);
    expect(resampleTo16k(same, 16_000)).toBe(same);
  });
  it('emits a 5 s 16 kHz chunk per 5 s of fixture audio and keeps the remainder', () => {
    const got: number[] = [];
    const c = createChunker(48_000, (pcm, s) => got.push(pcm.length, s));
    for (let i = 0; i < 12; i++) c.push(new Float32Array(48_000)); // 12 s
    expect(got).toEqual([80_000, 5, 80_000, 5]);
    c.flush(); // 2 s left
    expect(got).toEqual([80_000, 5, 80_000, 5, 32_000, 2]);
  });
  it('drops a tail under 1 s on flush', () => {
    const got: number[] = [];
    const c = createChunker(16_000, (pcm) => got.push(pcm.length));
    c.push(new Float32Array(8_000));
    c.flush();
    expect(got).toEqual([]);
  });
});
