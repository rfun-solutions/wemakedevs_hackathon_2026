// Route registry. RULE: insert lines directly under YOUR OWN `>> <change-id>` marker only.
// Never edit another change's lines or markers (AGENTS.md rule 5). Markers are in merge order.
import type { ComponentType } from 'preact';
import { Home } from './screens/Home';
// Imports: add YOUR import line directly under YOUR OWN `>> import:<change-id>` marker (prevents merge conflicts).
// >> import:d-access-kit
// >> import:d-access-kit-cards
import { Cards } from './features/access/Cards';
import { Badge } from './features/access/Badge';
import { CalmPlaces } from './features/access/CalmPlaces';
// >> import:a-schedule-agenda
// >> import:b-capture
// >> import:f-observability-product
// >> import:e-captions-translation
// >> import:c-evening-threads
// >> import:h-under-the-hood

export interface AppRoute {
  path: string;
  component: ComponentType;
}

export const routes: AppRoute[] = [
  { path: '/', component: Home },
  // >> d-access-kit
  // >> d-access-kit-cards
  { path: '/cards', component: Cards },
  { path: '/badge', component: Badge },
  { path: '/calm', component: CalmPlaces },
  // >> a-schedule-agenda
  // >> b-capture
  // >> f-observability-product
  // >> e-captions-translation
  // >> c-evening-threads
  // >> h-under-the-hood
];
