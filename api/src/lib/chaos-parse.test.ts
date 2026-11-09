import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CHAOS, anyActive, decideInjection, isProtectedRoute, isRouteKey, parseChaosFlags,
} from './chaos-parse';

describe('parseChaosFlags', () => {
  it('returns {} for empty, missing, invalid or non-object input', () => {
    for (const t of [undefined, null, '', '  ', '{nope', '[]', '42', 'null']) {
      expect(parseChaosFlags(t as string)).toEqual({});
    }
  });
  it('parses the agenda named key', () => {
    const out = parseChaosFlags('{"agenda":{"latencyMs":800,"errorRate":0,"naive":true}}');
    expect(out.agenda).toEqual({ latencyMs: 800, errorRate: 0, naive: true });
  });
  it('clamps and defaults bad fields', () => {
    const out = parseChaosFlags('{"/api/x":{"latencyMs":-5,"errorRate":7,"naive":"yes"},"y":"bad"}');
    expect(out['/api/x']).toEqual({ latencyMs: 0, errorRate: 1, naive: false });
    expect(out.y).toEqual(DEFAULT_CHAOS);
  });
  it('ignores prototype keys', () => {
    expect(Object.keys(parseChaosFlags('{"__proto__":{"latencyMs":1}}'))).toEqual([]);
  });
});

describe('route classification', () => {
  it('protects health, status, ping, translate, threads', () => {
    for (const p of ['/healthz', '/readyz', '/api/status', '/api/status/rtt', '/api/status/health?x=1',
      '/api/ping', '/api/translate', '/api/threads/abc', '/api/threads']) {
      expect(isProtectedRoute(p)).toBe(true);
    }
  });
  it('does not protect agenda or notes', () => {
    expect(isProtectedRoute('/api/agenda')).toBe(false);
    expect(isProtectedRoute('/api/notes')).toBe(false);
    expect(isProtectedRoute('/api/statusquo')).toBe(false);
  });
  it('route keys start with /api/', () => {
    expect(isRouteKey('/api/agenda')).toBe(true);
    expect(isRouteKey('agenda')).toBe(false);
  });
});

describe('decideInjection', () => {
  const flags = parseChaosFlags(
    '{"agenda":{"latencyMs":800,"errorRate":0,"naive":true},"/api/sessions":{"latencyMs":300,"errorRate":1,"naive":false},"/api/status":{"latencyMs":999}}',
  );
  it('never applies the agenda named key via the hook', () => {
    expect(decideInjection(flags, '/api/agenda')).toBeNull();
    expect(decideInjection(flags, 'agenda')).toBeNull();
  });
  it('applies route keys', () => {
    expect(decideInjection(flags, '/api/sessions?q=1', () => 0)).toEqual({ latencyMs: 300, error: true });
  });
  it('error only when rand below rate', () => {
    const f = parseChaosFlags('{"/api/notes":{"latencyMs":0,"errorRate":0.5}}');
    expect(decideInjection(f, '/api/notes', () => 0.4)?.error).toBe(true);
    expect(decideInjection(f, '/api/notes', () => 0.6)?.error).toBe(false);
  });
  it('never alters protected routes even when configured', () => {
    expect(decideInjection(flags, '/api/status')).toBeNull();
  });
  it('default is off', () => {
    expect(anyActive({})).toBe(false);
    expect(anyActive(flags)).toBe(true);
    expect(decideInjection({}, '/api/notes')).toBeNull();
  });
});
