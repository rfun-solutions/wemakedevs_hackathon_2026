import { useEffect, useState } from 'preact/hooks';
import { api } from '../../lib/api';
import { t } from '../../i18n';

const POLL_MS = 30_000;
const TIMEOUT_MS = 5000;

export interface HealthSnapshot {
  source: 'dash0' | 'unavailable';
  routes: { route: string; p95Ms: number; slow: boolean }[];
  captions: { lagging: boolean };
}

/** Plain-language lines for a snapshot; empty when unavailable or nothing is slow. No LLM involved. */
export function bannerLines(s: HealthSnapshot | null): { key: string; params?: { s: number } }[] {
  if (!s || s.source !== 'dash0') return [];
  const out: { key: string; params?: { s: number } }[] = [];
  const agenda = s.routes.find((r) => r.route === '/api/agenda' && r.slow);
  if (agenda)
    out.push({ key: 'status.health.agenda', params: { s: Math.round(agenda.p95Ms / 100) / 10 } });
  if (s.captions.lagging) out.push({ key: 'status.health.captions' });
  return out;
}

/** "Slow for everyone" banner from the server health snapshot; hidden when healthy or unavailable. */
export function HealthBanner() {
  const [snap, setSnap] = useState<HealthSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!navigator.onLine) return setSnap(null);
      try {
        const res = await api('/api/status/health', { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as HealthSnapshot;
        if (!cancelled) setSnap(body);
      } catch {
        if (!cancelled) setSnap(null);
      }
    };
    void load();
    const id = setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const lines = bannerLines(snap);
  return (
    <div id="status-health" aria-live="polite" aria-atomic="true">
      {lines.map((l) => (
        <p key={l.key}>{t(l.key, l.params)}</p>
      ))}
    </div>
  );
}
