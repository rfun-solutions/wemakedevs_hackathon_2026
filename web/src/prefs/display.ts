// Display preferences: type scale, font, contrast, motion. They become `data-*` attributes on <html>
// (tokens.css reacts to them) and persist in localStorage. The inline script in index.html applies the
// same attributes before first paint; keep the two in step (see PRE_PAINT_NOTE below).

export interface DisplayPrefs {
  /** 1 to 2 in steps of 0.1. */
  typeScale: number;
  font: 'atkinson' | 'system';
  contrast: 'normal' | 'high';
  motion: 'normal' | 'reduced';
}

/** Storage keys. F's Synthetic Kay seeds the persona through these, never through hard-coded strings. */
export const PREFS_STORAGE_KEYS = {
  display: 'kc.display.v1',
  lang: 'kc.lang',
} as const;

export const TYPE_SCALE_MIN = 1;
export const TYPE_SCALE_MAX = 2;
export const TYPE_SCALE_STEP = 0.1;

type Stored = Partial<DisplayPrefs>;

export function clampTypeScale(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 1;
  const stepped = Math.round(n / TYPE_SCALE_STEP) * TYPE_SCALE_STEP;
  return Math.min(TYPE_SCALE_MAX, Math.max(TYPE_SCALE_MIN, Math.round(stepped * 10) / 10));
}

function systemDefaults(win: Pick<Window, 'matchMedia'> | undefined): DisplayPrefs {
  const mq = (q: string): boolean => {
    try {
      return !!win?.matchMedia?.(q).matches;
    } catch {
      return false;
    }
  };
  return {
    typeScale: 1,
    font: 'atkinson', // pick B: Atkinson is the default face; the toggle offers the system stack
    contrast: mq('(prefers-contrast: more)') ? 'high' : 'normal',
    motion: mq('(prefers-reduced-motion: reduce)') ? 'reduced' : 'normal',
  };
}

/** Read the saved overrides; storage that throws or holds junk is ignored. */
export function readStored(storage: Pick<Storage, 'getItem'> | undefined): Stored {
  try {
    const raw = storage?.getItem(PREFS_STORAGE_KEYS.display);
    if (!raw) return {};
    const o = JSON.parse(raw) as Record<string, unknown>;
    const out: Stored = {};
    if (typeof o.typeScale === 'number') out.typeScale = clampTypeScale(o.typeScale);
    if (o.font === 'atkinson' || o.font === 'system') out.font = o.font;
    if (o.contrast === 'normal' || o.contrast === 'high') out.contrast = o.contrast;
    if (o.motion === 'normal' || o.motion === 'reduced') out.motion = o.motion;
    return out;
  } catch {
    return {};
  }
}

/** Effective prefs: saved choice wins, otherwise the system setting, otherwise the default. */
export function resolvePrefs(
  storage: Pick<Storage, 'getItem'> | undefined,
  win: Pick<Window, 'matchMedia'> | undefined,
): DisplayPrefs {
  return { ...systemDefaults(win), ...readStored(storage) };
}

/** Write the attributes tokens.css and global.css react to. */
export function applyPrefs(
  prefs: DisplayPrefs,
  root: HTMLElement = document.documentElement,
): void {
  root.setAttribute('data-type-scale', String(prefs.typeScale));
  root.style.setProperty('--type-scale', String(prefs.typeScale));
  root.setAttribute('data-font', prefs.font);
  if (prefs.contrast === 'high') root.setAttribute('data-contrast', 'high');
  else root.removeAttribute('data-contrast');
  if (prefs.motion === 'reduced') root.setAttribute('data-motion', 'reduced');
  else root.removeAttribute('data-motion');
}

function safeStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

let current: DisplayPrefs | undefined;
const listeners = new Set<(p: DisplayPrefs) => void>();

export function getPrefs(): DisplayPrefs {
  current ??= resolvePrefs(safeStorage(), globalThis.window);
  return current;
}

/** Apply saved or system prefs at start-up (the inline script in index.html already did, pre-paint). */
export function initDisplayPrefs(): DisplayPrefs {
  current = resolvePrefs(safeStorage(), globalThis.window);
  applyPrefs(current);
  return current;
}

/** Change one or more prefs: apply, persist (best effort) and notify subscribers. */
export function setPrefs(patch: Partial<DisplayPrefs>): DisplayPrefs {
  const next: DisplayPrefs = { ...getPrefs(), ...patch };
  next.typeScale = clampTypeScale(next.typeScale);
  current = next;
  applyPrefs(next);
  try {
    const saved = readStored(safeStorage());
    globalThis.localStorage?.setItem(
      PREFS_STORAGE_KEYS.display,
      JSON.stringify({ ...saved, ...patch, typeScale: next.typeScale }),
    );
  } catch {
    /* storage blocked: the choice applies for this visit only */
  }
  listeners.forEach((fn) => fn(next));
  return next;
}

export function onPrefsChange(fn: (p: DisplayPrefs) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
