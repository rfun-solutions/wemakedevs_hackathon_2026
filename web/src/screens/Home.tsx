import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { t, useLang } from '../i18n';
import { fetchAgenda, type Session } from '../pages/scheduleApi';
import { formatTimeRange, location } from '../pages/scheduleFormat';
import { currentOrNextSession } from '../pages/scheduleNow';
import './home.css';

/** 24 px stroke icon frame; purely decorative, the link text carries the meaning. */
function Icon({ children }: { children: ComponentChildren }) {
  return (
    <svg
      class="home-icon"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const icons = {
  capture: (
    <Icon>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </Icon>
  ),
  captions: (
    <Icon>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 10h4M13 10h4M7 14h10" />
    </Icon>
  ),
  schedule: (
    <Icon>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </Icon>
  ),
  cards: (
    <Icon>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M7 11h6M7 15h10" />
    </Icon>
  ),
  threads: (
    <Icon>
      <path d="M4 5h16v10H9l-5 4z" />
    </Icon>
  ),
  status: (
    <Icon>
      <path d="M3 12h4l3-7 4 14 3-7h4" />
    </Icon>
  ),
  next: (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Icon>
  ),
} as const;

const TILES = [
  { key: 'capture', href: '/capture' },
  { key: 'captions', href: '/captions' },
  { key: 'schedule', href: '/schedule' },
  { key: 'cards', href: '/cards' },
  { key: 'threads', href: '/threads' },
  { key: 'status', href: '/status' },
] as const;

type NextState =
  { kind: 'loading' } | { kind: 'none' } | { kind: 'session'; session: Session; now: boolean };

/** Next (or current) session on Kay's agenda; any failure falls back calmly, never blocks the page. */
function useNextSession(): NextState {
  const [state, setState] = useState<NextState>({ kind: 'loading' });
  useEffect(() => {
    let cancelled = false;
    fetchAgenda()
      .then((res) => {
        const hit = currentOrNextSession(res.items ?? [], new Date());
        if (!cancelled)
          setState(
            hit
              ? { kind: 'session', session: hit.session, now: hit.state === 'current' }
              : { kind: 'none' },
          );
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'none' });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

function NextUp({ state, lang }: { state: NextState; lang: string }) {
  if (state.kind === 'session') {
    const s = state.session;
    const where = location(s);
    return (
      <a class="home-next" href="/agenda" data-testid="home-next">
        {icons.next}
        <span class="home-next-body">
          <span class="home-next-label">
            {t(state.now ? 'app.home.next.now' : 'app.home.next.title')}
          </span>
          <span class="home-next-time">{formatTimeRange(s, lang)}</span>
          <span class="home-next-name">{s.title}</span>
          {where && <span class="home-next-room">{where}</span>}
        </span>
      </a>
    );
  }
  if (state.kind === 'loading') {
    return (
      <p class="home-next" data-testid="home-next" aria-busy="true">
        {icons.next}
        <span class="home-next-body">
          <span class="home-next-label">{t('app.home.next.title')}</span>
          <span class="home-next-room">{t('app.home.next.loading')}</span>
        </span>
      </p>
    );
  }
  return (
    <a class="home-next" href="/schedule" data-testid="home-next">
      {icons.next}
      <span class="home-next-body">
        <span class="home-next-label">{t('app.home.next.title')}</span>
        <span class="home-next-name">{t('app.home.next.empty')}</span>
        <span class="home-next-room">{t('app.home.next.emptyHint')}</span>
      </span>
    </a>
  );
}

export function Home() {
  const lang = useLang();
  const next = useNextSession();
  return (
    <section aria-labelledby="home-title" class="home">
      <h2 id="home-title">{t('app.home.title')}</h2>
      <p class="home-intro">{t('app.home.intro')}</p>
      <NextUp state={next} lang={lang} />
      <h3 id="home-go" class="home-go-title">
        {t('app.home.go')}
      </h3>
      <ul class="home-tiles" aria-labelledby="home-go">
        {TILES.map(({ key, href }) => (
          <li key={key}>
            <a class="home-tile" href={href}>
              {icons[key]}
              <span class="home-tile-text">
                <span class="home-tile-label">{t(`app.home.tile.${key}`)}</span>
                <span class="home-tile-desc">{t(`app.home.tile.${key}.desc`)}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
