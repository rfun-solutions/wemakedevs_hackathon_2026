// Route registry. RULE: insert lines directly under YOUR OWN `>> <change-id>` marker only.
// Never edit another change's lines or markers (AGENTS.md rule 5). Markers are in merge order.
import type { ComponentType } from 'preact';
import { Home } from './screens/Home';

export interface AppRoute {
  path: string;
  component: ComponentType<any>;
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
];
