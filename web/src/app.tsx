import { useEffect, useState } from 'preact/hooks';
import { LocationProvider, Router, Route, useLocation } from 'preact-iso';
import { routes } from './routes';
import { NavBar } from './nav-bar';
import { NotFound } from './screens/NotFound';
import { LANGS, LANG_NAMES, setLang, t, useLang } from './i18n';
import { LiveRegions } from './a11y/LiveRegions'; // >> d-access-kit
import { announce } from './a11y/announce'; // >> d-access-kit

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

function Shell() {
  const { path } = useLocation();
  const online = useOnline();
  const lang = useLang();

  // The header button steps to the next language; Settings has the full picker.
  const other = LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length] ?? 'en';
  return (
    <div class="shell">
      <a class="skip-link" href="#main">
        {t('app.skip')}
      </a>
      <header class="shell-header">
        <h1>{t('app.name')}</h1>
        <button
          type="button"
          class="btn"
          lang={other}
          onClick={() => {
            setLang(other);
            announce(t('access.settings.lang.announce', { name: LANG_NAMES[other] }));
          }}
        >
          {LANG_NAMES[other]}
        </button>
      </header>
      <main id="main" tabIndex={-1}>
        <Router>
          {routes.map((r) => (
            <Route key={r.path} path={r.path} component={r.component} />
          ))}
          <Route default component={NotFound} />
        </Router>
      </main>
      <LiveRegions />
      <div class="live" role="status" aria-live="polite">
        {online ? '' : t('app.offline.notice')}
      </div>
      <NavBar path={path} />
    </div>
  );
}

export function App() {
  return (
    <LocationProvider>
      <Shell />
    </LocationProvider>
  );
}
