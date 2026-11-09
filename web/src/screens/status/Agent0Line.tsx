import { useEffect, useState } from 'preact/hooks';
import { api } from '../../lib/api';
import { getLang, t } from '../../i18n';

const POLL_MS = 30_000;
const TIMEOUT_MS = 5000;

interface Explain {
  text: string | null;
  lang?: 'en' | 'es';
  at: string | null;
}

/** Age label key and count from elapsed seconds. */
export function agoLabel(seconds: number): { key: string; n: number } {
  const s = Math.max(0, Math.round(seconds));
  if (s < 90) return { key: 'status.agent0.ago.s', n: s };
  if (s < 5400) return { key: 'status.agent0.ago.m', n: Math.round(s / 60) };
  return { key: 'status.agent0.ago.h', n: Math.round(s / 3600) };
}

/** Cached Agent0 sentence, labelled as AI-generated. Shows "not available" rather than guessing. */
export function Agent0Line({ now = () => Date.now() }: { now?: () => number } = {}) {
  const [data, setData] = useState<Explain | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!navigator.onLine) {
        setData({ text: null, at: null }); // offline: no network call
        return;
      }
      try {
        const res = await api(`/api/status/explain?lang=${getLang()}`, {
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as Explain;
        if (!cancelled) setData(body);
      } catch {
        if (!cancelled) setData({ text: null, at: null });
      }
      if (!cancelled) setTick((n) => n + 1);
    };
    void load();
    const id = setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  void tick;
  const hasText = data?.text != null && data.at != null;
  const ago = hasText ? agoLabel((now() - Date.parse(data!.at!)) / 1000) : null;

  return (
    <section aria-labelledby="status-agent0-title" id="status-agent0">
      <h3 id="status-agent0-title">{t('status.agent0.title')}</h3>
      {hasText && ago ? (
        <p>
          {t('status.agent0.line', { ago: t(ago.key, { n: ago.n }), text: '' })}
          <span
            aria-live="polite"
            aria-atomic="true"
            lang={data!.lang && data!.lang !== getLang() ? data!.lang : undefined}
          >
            {data!.text}
          </span>{' '}
          <small>{t('status.agent0.label')}</small>
        </p>
      ) : (
        <p>{t('status.agent0.none')}</p>
      )}
    </section>
  );
}
