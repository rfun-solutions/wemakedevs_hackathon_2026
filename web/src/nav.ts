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
  // >> d-access-kit-cards
  { path: '/cards', labelKey: 'access.nav.cards' },
  { path: '/badge', labelKey: 'access.nav.badge' },
  { path: '/calm', labelKey: 'access.nav.calm' },
  // >> a-schedule-agenda
  // >> b-capture
  // >> f-observability-product
  { path: '/status', labelKey: 'status.nav' },
  // >> e-captions-translation
  // >> c-evening-threads
  // >> h-under-the-hood
];
