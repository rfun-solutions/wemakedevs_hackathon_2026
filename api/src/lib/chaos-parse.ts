// Pure chaos-flag parsing and route classification. No I/O: chaos.ts owns file reading.

export type ChaosFlags = { latencyMs: number; errorRate: number; naive: boolean };

export const DEFAULT_CHAOS: ChaosFlags = Object.freeze({
  latencyMs: 0,
  errorRate: 0,
  naive: false,
});

/** Routes (and prefixes) chaos never touches, whatever flags.json says. */
const PROTECTED_EXACT = ['/healthz', '/readyz', '/api/status', '/api/ping', '/api/translate'];
const PROTECTED_PREFIX = ['/api/status/', '/api/translate/', '/api/threads', '/api/llm'];

const MAX_LATENCY_MS = 10_000;

function num(v: unknown, min: number, max: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : 0;
}

/** Coerce one raw entry into ChaosFlags; anything malformed falls back to defaults per field. */
export function normalizeFlags(raw: unknown): ChaosFlags {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_CHAOS };
  const r = raw as Record<string, unknown>;
  return {
    latencyMs: num(r.latencyMs, 0, MAX_LATENCY_MS),
    errorRate: num(r.errorRate, 0, 1),
    naive: r.naive === true,
  };
}

/** Parse flags.json text. Empty, missing or invalid JSON yields {}. Never throws. */
export function parseChaosFlags(text: string | null | undefined): Record<string, ChaosFlags> {
  if (!text || !text.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const out: Record<string, ChaosFlags> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    out[key] = normalizeFlags(value);
  }
  return out;
}

/** Route keys start with /api/; any other key is a named flag read by its owning handler. */
export function isRouteKey(key: string): boolean {
  return key.startsWith('/api/');
}

export function isProtectedRoute(path: string): boolean {
  const p = path.split('?')[0].replace(/\/+$/, '') || '/';
  if (PROTECTED_EXACT.includes(p)) return true;
  return PROTECTED_PREFIX.some(
    (prefix) =>
      (p + '/').startsWith(prefix.endsWith('/') ? prefix : prefix + '/') || p.startsWith(prefix),
  );
}

export function flagsActive(f: ChaosFlags): boolean {
  return f.latencyMs > 0 || f.errorRate > 0 || f.naive;
}

/** True when any flag (route or named) has an effect. Feeds `chaos_active` on /api/status. */
export function anyActive(all: Record<string, ChaosFlags>): boolean {
  return Object.values(all).some(flagsActive);
}

/** Decide what the generic hook does for one request. Named keys (e.g. `agenda`) are never applied here. */
export function decideInjection(
  all: Record<string, ChaosFlags>,
  path: string,
  rand: () => number = Math.random,
): { latencyMs: number; error: boolean } | null {
  const route = path.split('?')[0];
  if (isProtectedRoute(route) || !isRouteKey(route)) return null;
  const f = all[route];
  if (!f || !flagsActive(f)) return null;
  return { latencyMs: f.latencyMs, error: f.errorRate > 0 && rand() < f.errorRate };
}
