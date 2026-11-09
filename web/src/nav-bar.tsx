import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { navItems, type NavItem } from './nav';
import { t } from './i18n';

/** The four most-used screens live in the bar, in this order; every other item goes under More. */
const PRIMARY_PATHS = ['/', '/schedule', '/capture', '/captions'];

const primary: NavItem[] = PRIMARY_PATHS.flatMap((p) => navItems.filter((n) => n.path === p));
const more: NavItem[] = navItems.filter((n) => !PRIMARY_PATHS.includes(n.path));

/** Bottom navigation: primary links plus a disclosure button that reveals the rest as plain links. */
export function NavBar({ path }: { path: string }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const nav = useRef<HTMLElement>(null);

  // Close after navigating.
  useEffect(() => setOpen(false), [path]);

  // Tapping or focusing outside the nav, or pressing Escape, closes the menu (Escape refocuses the button).
  useLayoutEffect(() => {
    if (!open) return;
    const outside = (e: Event) => {
      if (nav.current && !nav.current.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('keydown', escape);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
    };
  }, [open]);

  const link = (n: NavItem) => (
    <li key={n.path}>
      <a href={n.path} aria-current={path === n.path ? 'page' : undefined}>
        {t(n.labelKey)}
      </a>
    </li>
  );

  return (
    <nav class="shell-nav" ref={nav} aria-label={t('app.nav.label')}>
      <ul class="nav-bar">
        {primary.map(link)}
        {more.length > 0 && (
          <li>
            <button
              type="button"
              ref={button}
              class="nav-more-btn"
              aria-expanded={open}
              aria-controls="nav-more-menu"
              data-active={more.some((n) => n.path === path) ? 'true' : undefined}
              onClick={() => setOpen(!open)}
            >
              {t('app.nav.more')}
            </button>
          </li>
        )}
      </ul>
      <ul id="nav-more-menu" class="nav-more" hidden={!open}>
        {more.map(link)}
      </ul>
    </nav>
  );
}
