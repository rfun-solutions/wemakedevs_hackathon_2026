/**
 * Generic in-memory token bucket, per key (design D3 "Rate-limit helper").
 * Per replica, not global. Used by the LLM client and by F and E routes.
 */
export type RateLimitResult = { ok: true } | { ok: false; retryAfterS: number };

export interface RateLimiter {
  take(key: string): RateLimitResult;
}

export interface RateLimiterOptions {
  /** Bucket capacity: calls allowed in a burst and per window. */
  max: number;
  /** Time in ms to refill a full bucket. */
  windowMs: number;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

const SWEEP_EVERY = 500;

export function createRateLimiter({ max, windowMs }: RateLimiterOptions): RateLimiter {
  if (!(max > 0) || !(windowMs > 0)) {
    throw new RangeError('createRateLimiter: max and windowMs must be positive');
  }
  const refillPerMs = max / windowMs;
  const buckets = new Map<string, Bucket>();
  let calls = 0;

  const refill = (b: Bucket, now: number): void => {
    b.tokens = Math.min(max, b.tokens + (now - b.updatedAt) * refillPerMs);
    b.updatedAt = now;
  };

  return {
    take(key) {
      const now = Date.now();
      // Drop buckets that have fully refilled so the map cannot grow without bound.
      if (++calls % SWEEP_EVERY === 0) {
        for (const [k, b] of buckets) {
          refill(b, now);
          if (b.tokens >= max) buckets.delete(k);
        }
      }
      let b = buckets.get(key);
      if (!b) {
        b = { tokens: max, updatedAt: now };
        buckets.set(key, b);
      } else {
        refill(b, now);
      }
      if (b.tokens >= 1) {
        b.tokens -= 1;
        return { ok: true };
      }
      return {
        ok: false,
        retryAfterS: Math.max(1, Math.ceil((1 - b.tokens) / refillPerMs / 1000)),
      };
    },
  };
}
