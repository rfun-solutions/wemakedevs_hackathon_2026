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
  // >> a-schedule-agenda
  // >> b-capture
  // >> f-observability-product
  // >> e-captions-translation
  // >> c-evening-threads
  // >> h-under-the-hood
];
