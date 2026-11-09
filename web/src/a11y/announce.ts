// announce(text, politeness): one shared polite and one assertive live region, mounted by
// <LiveRegions /> in the app shell. Rule IN-3: dynamic text is announced through this or an aria-live region.
export type Politeness = 'polite' | 'assertive';

type Listener = (p: Politeness, text: string) => void;
const listeners = new Set<Listener>();

export function onAnnounce(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Queue a message for screen readers. Safe to call before the regions mount (it is then dropped). */
export function announce(text: string, politeness: Politeness = 'polite'): void {
  listeners.forEach((fn) => fn(politeness, text));
}
