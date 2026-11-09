import { useEffect, useState } from 'preact/hooks';
import { api } from '../../lib/api';
import { getLastSaveMs } from '../../lib/capture/queue';
import { t } from '../../i18n';
import { computeVerdict, feedLabel, savedLabel } from './verdict';
import { medianOf, type StatusPayload } from './status-client';
import { Agent0Line } from './Agent0Line';

const POLL_MS = 30_000;
const STATUS_TIMEOUT_MS = 5000;
const PING_TIMEOUT_MS = 3000;

function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/** Median of 3 /api/ping round trips, reported once to the server (rate-limited there). */
async function measureRtt(): Promise<number | null> {
  const samples: number[] = [];
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    try {
      const res = await api('/api/ping', { signal: AbortSignal.timeout(PING_TIMEOUT_MS) });
      if (res.ok) samples.push(performance.now() - start);
    } catch {
      /* a failed ping is simply not a sample */
    }
  }
  const median = medianOf(samples);
  if (median !== null) {
    void api('/api/status/rtt', {
      method: 'POST',
      body: JSON.stringify({ rtt_ms: Math.round(median) }),
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    }).catch(() => undefined);
  }
  return median;
}

export function Status() {
  const online = useOnline();
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [rtt, setRtt] = useState<number | null>(null);
  const [saveMs, setSaveMs] = useState<number | null>(() => getLastSaveMs());

  useEffect(() => {
    const id = setInterval(() => setSaveMs(getLastSaveMs()), 2000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!online) return; // offline: no network call is attempted
    let cancelled = false;
    const load = async () => {
      try {
        const res = await api('/api/status', { signal: AbortSignal.timeout(STATUS_TIMEOUT_MS) });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as StatusPayload;
        if (!cancelled) {
          setStatus(body);
          setFailed(false);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
      const m = await measureRtt();
      if (!cancelled) setRtt(m);
    };
    void load();
    const id = setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [online]);

  const verdict = computeVerdict({
    online,
    rttMs: rtt,
    serverP95: status?.server_ms_p95 ?? null,
    sloMs: status?.slo_ms ?? 500,
  });
  const saved = savedLabel(saveMs);
  const feed = feedLabel(status?.feed_age_s ?? null);

  return (
    <section aria-labelledby="status-title">
      <h2 id="status-title">{t('status.title')}</h2>

      <p role="status" aria-live="polite" id="status-saved">
        {saved.shown ? t('status.saved', { ms: saved.ms ?? 0 }) : t('status.saved.none')}
      </p>

      <h3>{t('status.verdict.title')}</h3>
      <div aria-live="polite" aria-atomic="true">
        <p id="status-verdict">{t(`status.verdict.${verdict}`)}</p>
        {status?.chaos_active && <p id="status-chaos">{t('status.chaos')}</p>}
        {failed && online && (
          <p id="status-error" role="alert">
            {t('status.error')}
          </p>
        )}
      </div>
      <ul>
        {rtt !== null && online && <li>{t('status.rtt', { ms: Math.round(rtt) })}</li>}
        {status?.server_ms_p95 != null && (
          <li>{t('status.server', { ms: status.server_ms_p95, slo: status.slo_ms })}</li>
        )}
        <li>{t(feed.key, feed.params)}</li>
      </ul>

      {/* >> f-observability-product-health */}
      {/* >> f-observability-product */}
      <Agent0Line />
    </section>
  );
}
