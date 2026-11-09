// Route registry. RULE: insert lines directly under YOUR OWN `>> <change-id>` marker only.
// Never edit another change's lines or markers (AGENTS.md rule 5). Markers are in merge order.
import type { ComponentType } from 'preact';
import { Home } from './screens/Home';
// Imports: add YOUR import line directly under YOUR OWN `>> import:<change-id>` marker (prevents merge conflicts).
// >> import:d-access-kit
import { Settings } from './features/access/Settings';
// >> import:d-access-kit-cards
import { Cards } from './features/access/Cards';
import { Badge } from './features/access/Badge';
import { CalmPlaces } from './features/access/CalmPlaces';
// >> import:a-schedule-agenda
// >> import:b-capture
// >> import:f-observability-product
import { Status } from './screens/status/Status';
// >> import:e-captions-translation
import { Captions } from './pages/captions/Captions';
// >> import:c-evening-threads
import { Threads } from './screens/Threads';
// >> import:h-under-the-hood
import { UnderTheHood } from './screens/under-the-hood/UnderTheHood';

export interface AppRoute {
  path: string;
  component: ComponentType;
}

export const routes: AppRoute[] = [
  { path: '/', component: Home },
  // >> d-access-kit
  { path: '/settings', component: Settings },
  // >> d-access-kit-cards
  { path: '/cards', component: Cards },
  { path: '/badge', component: Badge },
  { path: '/calm', component: CalmPlaces },
  // >> a-schedule-agenda
  // >> b-capture
  // >> f-observability-product
  { path: '/status', component: Status },
  // >> e-captions-translation
  { path: '/captions', component: Captions },
  // >> c-evening-threads
  { path: '/threads', component: Threads },
  // >> h-under-the-hood
  { path: '/under-the-hood', component: UnderTheHood },
];
