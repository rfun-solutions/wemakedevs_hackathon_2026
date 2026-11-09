// Under-the-hood registry. RULE: add ONE file `entries/<change-id>.json` for your change; never edit
// another change's file. Entries are sorted by `order` (merge order).
import type { UnderTheHoodEntry } from './types';

const modules = import.meta.glob<UnderTheHoodEntry>('./entries/*.json', {
  eager: true,
  import: 'default',
});

export const ENTRIES: UnderTheHoodEntry[] = Object.values(modules).sort(
  (a, b) => a.order - b.order,
);
