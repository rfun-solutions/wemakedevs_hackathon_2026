import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDeviceId, resetDeviceIdCacheForTests } from './device';
import { api } from './api';

const UUID4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('getDeviceId', () => {
  beforeEach(() => {
    localStorage.clear();
    resetDeviceIdCacheForTests();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('creates a UUID v4 and persists it', () => {
    const id = getDeviceId();
    expect(id).toMatch(UUID4);
    resetDeviceIdCacheForTests();
    expect(getDeviceId()).toBe(id);
  });
  it('falls back to an in-memory id when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem() { throw new Error('denied'); },
      setItem() { throw new Error('denied'); },
    });
    const id = getDeviceId();
    expect(id).toMatch(UUID4);
    expect(getDeviceId()).toBe(id);
  });
});

describe('api()', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('adds X-Device-Id and JSON content type', async () => {
    resetDeviceIdCacheForTests();
    const spy = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', spy);
    await api('/api/ping', { method: 'POST', body: '{}' });
    const [, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    const h = new Headers(init.headers);
    expect(h.get('X-Device-Id')).toMatch(UUID4);
    expect(h.get('Content-Type')).toBe('application/json');
  });
});
