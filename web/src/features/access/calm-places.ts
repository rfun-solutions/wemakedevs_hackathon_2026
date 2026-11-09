// Static calm-places list from the public KubeCon NA 2026 inclusion page (research/04 section 1.2).
// Places the page gives no room for say "ask at registration"; we never invent a location.
export const CALM_SOURCE_URL =
  'https://events.linuxfoundation.org/kubecon-cloudnativecon-north-america/attend/inclusion-accessibility/';
export const CALM_CHECKED = '2026-11-08';

export interface CalmPlace {
  id: string;
  /** i18n key (UI language). */
  nameKey: string;
  /** i18n key for building and level, or undefined when the source gives no room. */
  whereKey?: string;
}

export const CALM_PLACES: readonly CalmPlace[] = [
  {
    id: 'quiet-all',
    nameKey: 'access.calm.quiet-all.name',
    whereKey: 'access.calm.quiet-all.where',
  },
  {
    id: 'quiet-women',
    nameKey: 'access.calm.quiet-women.name',
    whereKey: 'access.calm.quiet-women.where',
  },
  { id: 'prayer', nameKey: 'access.calm.prayer.name', whereKey: 'access.calm.prayer.where' },
  { id: 'nursing', nameKey: 'access.calm.nursing.name' },
  { id: 'childcare', nameKey: 'access.calm.childcare.name' },
];
