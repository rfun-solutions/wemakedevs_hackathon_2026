import { useEffect, useState } from 'preact/hooks';
import { t, useLang } from '../../i18n';
import { ENTRIES } from '../../under-the-hood/registry';
import type { Sponsor, TechRef, UnderTheHoodEntry } from '../../under-the-hood/types';
import { PROMISES } from '../../features/access/promises';
import { fetchLiveData, resolveLive, type LiveData, type LiveState } from './live';
import './hood.css';

const REPO_BLOB = 'https://github.com/rfun-solutions/wemakedevs_hackathon_2026/blob/main/';
const SPONSORS: Sponsor[] = ['gitar', 'dash0', 'radar'];
const REFRESH_MS = 30_000;
const ICON: Record<LiveState, string> = { ok: '✓', degraded: '!', unknown: '?', none: '–' };

/** Where a tech ref links to, or null when it must not be a link (Dash0 needs a login). */
export function techHref(tech: TechRef): string | null {
  if (!tech.ref) return null;
  if (/^https?:\/\//.test(tech.ref)) return tech.sponsor === 'dash0' ? null : tech.ref;
  return REPO_BLOB + tech.ref.replace(/^\/+/, '');
}

/** True when a Dash0 item has nothing a visitor can open without signing in. */
export function needsSignin(tech: TechRef): boolean {
  return tech.sponsor === 'dash0' && tech.ref !== undefined && techHref(tech) === null;
}

function emitViewed(): void {
  if (!import.meta.env.VITE_DASH0_INGEST_TOKEN) return;
  import('@dash0/sdk-web').then((m) => m.sendEvent('kc.hood.viewed')).catch(() => undefined); // telemetry never breaks the screen
}

function useLiveData(): LiveData | null {
  const [data, setData] = useState<LiveData | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => {
      if (document.visibilityState === 'hidden') return;
      void fetchLiveData().then((d) => alive && setData(d));
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    document.addEventListener('visibilitychange', load);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', load);
    };
  }, []);
  return data;
}

function TechItem({ tech, live }: { tech: TechRef; live: LiveData | null }) {
  const href = techHref(tech);
  const result = tech.live
    ? resolveLive(tech.live, live?.snapshot ?? null, live?.release ?? null)
    : null;
  return (
    <li class="hood-tech">
      {href ? (
        <a href={href} class="hood-link">
          <code lang="en">{tech.label}</code>
        </a>
      ) : (
        <code lang="en">{tech.label}</code>
      )}
      {needsSignin(tech) && <span class="hood-note">{t('hood.signin')}</span>}
      {result && (
        <p role="status" class={`hood-live hood-live-${result.state}`}>
          <span aria-hidden="true" class="hood-icon">
            {ICON[result.state]}
          </span>
          <span class="visually-hidden">{t('hood.live.label')} </span>
          {result.text}
        </p>
      )}
    </li>
  );
}

function EntrySection({ entry, live }: { entry: UnderTheHoodEntry; live: LiveData | null }) {
  const id = `hood-${entry.id}`;
  const promises = PROMISES.filter((p) => entry.promises.includes(p.id));
  return (
    <section class="hood-entry" aria-labelledby={id}>
      <h3 id={id}>{t(entry.titleKey)}</h3>
      <p>{t(entry.whatKey)}</p>
      {promises.length > 0 && (
        <ul class="hood-chips" aria-label={t('hood.entry.promises')}>
          {promises.map((p) => (
            <li key={p.id} class="hood-chip">
              <strong>{p.id}</strong> {t(p.titleKey)}
            </li>
          ))}
        </ul>
      )}
      {SPONSORS.map((s) => {
        const items = entry.tech.filter((x) => x.sponsor === s);
        if (items.length === 0) return null;
        return (
          <div key={s} class="hood-group">
            <h4>{t(`hood.sponsor.${s}`)}</h4>
            <ul>
              {items.map((x) => (
                <TechItem key={`${x.kind}:${x.label}`} tech={x} live={live} />
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

export function UnderTheHood() {
  useLang(); // re-render when the language changes
  const live = useLiveData();
  useEffect(emitViewed, []);
  return (
    <section aria-labelledby="hood-title" class="hood">
      <h2 id="hood-title">{t('hood.title')}</h2>
      <p>{t('hood.intro')}</p>
      {ENTRIES.map((e) => (
        <EntrySection key={e.id} entry={e} live={live} />
      ))}
    </section>
  );
}
