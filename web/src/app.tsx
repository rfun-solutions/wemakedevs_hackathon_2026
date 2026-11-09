import { useEffect, useState } from 'preact/hooks';
import { LocationProvider, Router, Route, useLocation } from 'preact-iso';
import { routes } from './routes';
import { navItems } from './nav';
import { NotFound } from './screens/NotFound';
import { getLang, setLang, t, type Lang } from './i18n';

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
  const [lang, setLangState] = useState<Lang>(getLang());

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const other: Lang = lang === 'en' ? 'es' : 'en';
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
            setLangState(other);
          }}
        >
          {t('app.lang.switch')}
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
      <div class="live" role="status" aria-live="polite">
        {online ? '' : t('app.offline.notice')}
      </div>
      <nav class="shell-nav" aria-label={t('app.nav.label')}>
        <ul>
          {navItems.map((n) => (
            <li key={n.path}>
              <a href={n.path} aria-current={path === n.path ? 'page' : undefined}>
                {t(n.labelKey)}
              </a>
            </li>
          ))}
        </ul>
      </nav>
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
