import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRateLimiter } from './rateLimit.js';

describe('createRateLimiter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('allows up to max calls then rejects with retryAfterS', () => {
    const l = createRateLimiter({ max: 3, windowMs: 60_000 });
    expect(l.take('k')).toEqual({ ok: true });
    expect(l.take('k')).toEqual({ ok: true });
    expect(l.take('k')).toEqual({ ok: true });
    const r = l.take('k');
    expect(r.ok).toBe(false);
    // one token refills every 20 s
    expect(r).toEqual({ ok: false, retryAfterS: 20 });
  });

  it('refills over time', () => {
    const l = createRateLimiter({ max: 2, windowMs: 10_000 });
    l.take('k');
    l.take('k');
    expect(l.take('k').ok).toBe(false);
    vi.advanceTimersByTime(5_000); // one token (2 per 10 s)
    expect(l.take('k').ok).toBe(true);
    expect(l.take('k').ok).toBe(false);
    vi.advanceTimersByTime(60_000); // never exceeds capacity
    expect(l.take('k').ok).toBe(true);
    expect(l.take('k').ok).toBe(true);
    expect(l.take('k').ok).toBe(false);
  });

  it('keeps keys separate', () => {
    const l = createRateLimiter({ max: 1, windowMs: 1000 });
    expect(l.take('a').ok).toBe(true);
    expect(l.take('a').ok).toBe(false);
    expect(l.take('b').ok).toBe(true);
  });

  it('rejects invalid options', () => {
    expect(() => createRateLimiter({ max: 0, windowMs: 1000 })).toThrow(RangeError);
    expect(() => createRateLimiter({ max: 1, windowMs: 0 })).toThrow(RangeError);
  });
});
