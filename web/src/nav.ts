// Navigation registry. RULE: insert lines directly under YOUR OWN `>> <change-id>` marker only.
// Never edit another change's lines or markers (AGENTS.md rule 5). Markers are in merge order.
export interface NavItem {
  path: string;
  /** i18n key for the visible label (and accessible name). */
  labelKey: string;
}

export const navItems: NavItem[] = [
  { path: '/', labelKey: 'app.nav.home' },
  // >> d-access-kit
  { path: '/settings', labelKey: 'access.nav.settings' },
  // >> d-access-kit-cards
  { path: '/cards', labelKey: 'access.nav.cards' },
  { path: '/badge', labelKey: 'access.nav.badge' },
  { path: '/calm', labelKey: 'access.nav.calm' },
  // >> a-schedule-agenda
  // >> b-capture
  // >> f-observability-product
  { path: '/status', labelKey: 'status.nav' },
  // >> e-captions-translation
  { path: '/captions', labelKey: 'captions.nav' },
  // >> c-evening-threads
  { path: '/threads', labelKey: 'threads.nav' },
  // >> h-under-the-hood
  { path: '/under-the-hood', labelKey: 'hood.nav' },
];
