// Route registry. RULE: insert lines directly under YOUR OWN `>> <change-id>` marker only.
// Never edit another change's lines or markers (AGENTS.md rule 5). Markers are in merge order.
import type { ComponentType } from 'preact';
import { Home } from './screens/Home';
// Imports: add YOUR import line directly under YOUR OWN `>> import:<change-id>` marker (prevents merge conflicts).
// >> import:d-access-kit
// >> import:d-access-kit-cards
// >> import:a-schedule-agenda
// >> import:b-capture
// >> import:f-observability-product
// >> import:e-captions-translation
// >> import:c-evening-threads
// >> import:h-under-the-hood
import { UnderTheHood } from './screens/under-the-hood/UnderTheHood';

export interface AppRoute {
  path: string;
  component: ComponentType;
}

export const routes: AppRoute[] = [
  { path: '/', component: Home },
  // >> d-access-kit
  // >> d-access-kit-cards
  // >> a-schedule-agenda
  // >> b-capture
  // >> f-observability-product
  // >> e-captions-translation
  // >> c-evening-threads
  // >> h-under-the-hood
  { path: '/under-the-hood', component: UnderTheHood },
];
