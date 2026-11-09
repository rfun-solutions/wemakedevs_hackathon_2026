// Live-value resolver for the Under the hood screen (design decision 1). Pure: no fetch, no DOM.
// Never invents a number: anything missing, failed or `unavailable` resolves to "none"/"unknown".
import { t } from '../../i18n';
import type { TechRef } from '../../under-the-hood/types';

export type PromiseState = 'ok' | 'degraded' | 'unknown';

/** The part of F's `HealthSnapshot` that H reads. */
export interface HealthSnapshotLite {
  source: 'dash0' | 'unavailable';
  polledAt: string | null;
  routes?: { route: string; p95Ms: number; slow?: boolean }[];
  promises?: Partial<Record<string, { state: PromiseState; value?: number }>>;
}

/** F's `kc-release` record served by `GET /api/status/release`. */
export interface ReleaseRecord {
  releasedAt?: string;
  sha?: string;
  prUrl?: string;
  gitarReviewed?: boolean;
  radarUrl?: string;
}

export type LiveState = PromiseState | 'none';
export interface LiveResult {
  state: LiveState;
  text: string;
}

const TZ = 'America/Denver';

/** "15:52" in America/Denver, or null for a missing or invalid timestamp. */
export function formatTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: TZ,
  }).format(d);
}

const none = (): LiveResult => ({ state: 'none', text: t('hood.live.none') });

export function resolveLive(
  live: NonNullable<TechRef['live']>,
  snapshot: HealthSnapshotLite | null,
  release: ReleaseRecord | null,
): LiveResult {
  if (live === 'release') {
    if (!release) return none();
    const clauses: string[] = [];
    const time = formatTime(release.releasedAt);
    if (time) clauses.push(t('hood.live.release.at', { time }));
    if (release.gitarReviewed) clauses.push(t('hood.live.release.gitar'));
    if (release.radarUrl) clauses.push(t('hood.live.release.radar'));
    if (clauses.length === 0) return none();
    return { state: 'ok', text: clauses.join(', ') };
  }

  if (!snapshot || snapshot.source === 'unavailable') return none();

  if (live.startsWith('promise:')) {
    const entry = snapshot.promises?.[live.slice('promise:'.length)];
    const state: PromiseState =
      entry?.state === 'ok' || entry?.state === 'degraded' ? entry.state : 'unknown';
    return { state, text: t(`hood.live.${state}`) };
  }

  if (live.startsWith('route:')) {
    const wanted = live.slice('route:'.length).trim();
    const path = wanted.replace(/^[A-Z]+\s+/, '');
    const hit = snapshot.routes?.find((r) => r.route === wanted || r.route === path);
    if (!hit || typeof hit.p95Ms !== 'number' || !Number.isFinite(hit.p95Ms)) return none();
    const time = formatTime(snapshot.polledAt);
    const ms = String(Math.round(hit.p95Ms));
    return {
      state: hit.slow ? 'degraded' : 'ok',
      text: time ? t('hood.live.route', { ms, time }) : t('hood.live.route.notime', { ms }),
    };
  }
  return none();
}

export interface LiveData {
  snapshot: HealthSnapshotLite | null;
  release: ReleaseRecord | null;
}

async function getJson<T>(
  fetchFn: typeof fetch,
  url: string,
  timeoutMs: number,
): Promise<T | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { signal: ctl.signal });
    if (res.status !== 200) return null; // 204 (no release), 404 (endpoint not shipped), errors
    return (await res.json()) as T;
  } catch {
    return null; // offline, timeout, bad JSON: no live value
  } finally {
    clearTimeout(timer);
  }
}

/** Fetches F's two optional endpoints. Never throws; a failed call is `null`. */
export async function fetchLiveData(
  fetchFn: typeof fetch = (...a) => fetch(...a),
  timeoutMs = 5000,
): Promise<LiveData> {
  const [snapshot, release] = await Promise.all([
    getJson<HealthSnapshotLite>(fetchFn, '/api/status/health', timeoutMs),
    getJson<ReleaseRecord>(fetchFn, '/api/status/release', timeoutMs),
  ]);
  return {
    snapshot: snapshot && typeof snapshot === 'object' ? snapshot : null,
    release: release && typeof release === 'object' ? release : null,
  };
}
