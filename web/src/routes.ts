// Route registry. RULE: insert lines directly under YOUR OWN `>> <change-id>` marker only.
// Never edit another change's lines or markers (AGENTS.md rule 5). Markers are in merge order.
import type { ComponentType } from 'preact';
import { Home } from './screens/Home';
import { Cards } from './features/access/Cards';
import { Badge } from './features/access/Badge';
import { CalmPlaces } from './features/access/CalmPlaces';

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
