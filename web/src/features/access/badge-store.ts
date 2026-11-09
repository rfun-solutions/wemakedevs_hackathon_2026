// Local-only communication badge. Stored ONLY in localStorage under `kc.badge.v1`; never sent to
// the API and never recorded in telemetry (DD-3).
export const BADGE_KEY = 'kc.badge.v1';

export interface Badge {
  name: string;
  pronouns: string;
  text: boolean;
  quiet: boolean;
  slow: boolean;
}
export const EMPTY_BADGE: Badge = {
  name: '',
  pronouns: '',
  text: false,
  quiet: false,
  slow: false,
};

export function loadBadge(): Badge {
  try {
    const raw = globalThis.localStorage?.getItem(BADGE_KEY);
    if (!raw) return { ...EMPTY_BADGE };
    const p = JSON.parse(raw) as Partial<Badge>;
    return {
      name: typeof p.name === 'string' ? p.name : '',
      pronouns: typeof p.pronouns === 'string' ? p.pronouns : '',
      text: p.text === true,
      quiet: p.quiet === true,
      slow: p.slow === true,
    };
  } catch {
    return { ...EMPTY_BADGE };
  }
}

/** Returns false when storage is unavailable, so the screen can say it was not saved. */
export function saveBadge(b: Badge): boolean {
  try {
    globalThis.localStorage.setItem(BADGE_KEY, JSON.stringify(b));
    return true;
  } catch {
    return false;
  }
}

export function badgeIsEmpty(b: Badge): boolean {
  return !b.name.trim() && !b.pronouns.trim() && !b.text && !b.quiet && !b.slow;
}
