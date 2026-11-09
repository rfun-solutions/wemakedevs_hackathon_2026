import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import en from '../../i18n/en/access-cards.json';
import es from '../../i18n/es/access-cards.json';
import ptBR from '../../i18n/pt-BR/access-cards.json';
import ar from '../../i18n/ar/access-cards.json';
import { setLang } from '../../i18n';
import { PRESET_IDS, cardText } from './card-text';
import { largestFit } from './fit-text';
import { pickVoice } from './speech';
import { BADGE_KEY, badgeIsEmpty, loadBadge, saveBadge } from './badge-store';
import { CALM_PLACES } from './calm-places';
import { Cards } from './Cards';
import { Badge, badgeLines } from './Badge';
import { CalmPlaces } from './CalmPlaces';
import { ShowToPerson } from './ShowToPerson';

beforeEach(() => {
  localStorage.clear();
  setLang('en');
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('access-cards.json', () => {
  it('has identical keys in en, es, pt-BR and ar, all non-empty', () => {
    const base = Object.keys(en).sort();
    for (const d of [es, ptBR, ar]) expect(Object.keys(d).sort()).toEqual(base);
    for (const d of [en, es, ptBR, ar])
      for (const [k, v] of Object.entries(d)) expect(v.trim(), k).not.toBe('');
  });
  it('every preset has a phrase and the stutter card says it plainly', () => {
    for (const id of PRESET_IDS)
      expect(cardText('en', `access.card.${id}`)).not.toContain('access.card');
    expect(cardText('en', 'access.card.stutter')).toBe('I stutter. Please give me time to finish.');
  });
  it('EN sentences stay short (IN-6)', () => {
    for (const [k, v] of Object.entries(en)) {
      for (const s of v.split(/(?<=[.!?])\s+/))
        expect(s.split(/\s+/).length, k).toBeLessThanOrEqual(20);
    }
  });
  it('cardText falls back to English, then to the key, and interpolates', () => {
    expect(cardText('es', 'access.calm.checked', { date: '2026-11-08' })).toContain('2026-11-08');
    expect(cardText('en', 'no.such.key')).toBe('no.such.key');
  });
});

describe('largestFit', () => {
  it('finds the largest size that fits, the max when all fit, the min when none fit', () => {
    expect(largestFit(10, 100, (s) => s <= 37)).toBe(37);
    expect(largestFit(10, 100, () => true)).toBe(100);
    expect(largestFit(10, 100, () => false)).toBe(10);
  });
});

describe('pickVoice', () => {
  const voices = [
    { lang: 'en_GB', name: 'a' },
    { lang: 'es-MX', name: 'b' },
    { lang: 'es-ES', name: 'c' },
    { lang: 'pt-PT', name: 'd' },
  ];
  it('prefers exact region, then same base language, else undefined', () => {
    expect(pickVoice(voices, 'es')?.name).toBe('c');
    expect(pickVoice(voices, 'pt-BR')?.name).toBe('d');
    expect(pickVoice(voices, 'en')?.name).toBe('a');
    expect(pickVoice(voices, 'ar')).toBeUndefined();
  });
});

describe('badge store', () => {
  it('round-trips, ignores corrupt data, and detects empty', () => {
    expect(badgeIsEmpty(loadBadge())).toBe(true);
    const b = { name: 'Kay', pronouns: 'she/her', text: true, quiet: false, slow: true };
    expect(saveBadge(b)).toBe(true);
    expect(loadBadge()).toEqual(b);
    localStorage.setItem(BADGE_KEY, '{not json');
    expect(badgeIsEmpty(loadBadge())).toBe(true);
  });
  it('reports a blocked store instead of throwing', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(saveBadge(loadBadge())).toBe(false);
  });
  it('builds badge lines in the card language', () => {
    const b = { name: 'Kay', pronouns: '', text: true, quiet: true, slow: false };
    expect(badgeLines(b, 'es')).toEqual(['Kay', 'Prefiero texto', 'Silencio, por favor']);
  });
});

describe('Cards screen', () => {
  it('opens a preset in show mode, Close and Escape return focus to the card', () => {
    render(<Cards />);
    const btn = screen.getByRole('button', { name: "I'm deaf. Please type." });
    btn.focus();
    fireEvent.click(btn);
    const dlg = screen.getByRole('dialog');
    expect(dlg.textContent).toContain("I'm deaf. Please type.");
    expect(dlg.querySelector('p')?.getAttribute('lang')).toBe('en');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(btn);
    fireEvent.click(btn);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('tags the card language independently of the UI language', () => {
    setLang('es');
    localStorage.setItem('kc.cardlang', 'en');
    render(<Cards />);
    fireEvent.click(screen.getByRole('button', { name: 'Thank you.' }));
    expect(screen.getByRole('dialog').querySelector('p')?.getAttribute('lang')).toBe('en');
  });
  it('custom card: Show is disabled until there is text, then shows it', () => {
    render(<Cards />);
    const show = screen.getByRole('button', { name: 'Show' }) as HTMLButtonElement;
    expect(show.disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('Type a message first.');
    fireEvent.input(screen.getByLabelText('Write your own message', { selector: 'textarea' }), {
      target: { value: 'Where is room 260A?' },
    });
    expect(show.disabled).toBe(false);
    fireEvent.click(show);
    expect(screen.getByRole('dialog').textContent).toContain('Where is room 260A?');
  });
  it('hides Speak when speech synthesis is unavailable and speaks once when it is', () => {
    vi.stubGlobal('speechSynthesis', undefined);
    delete (window as unknown as Record<string, unknown>).speechSynthesis;
    render(<ShowToPerson text="Hi" lang="en" onClose={() => undefined} />);
    expect(screen.queryByRole('button', { name: 'Read aloud' })).toBeNull();
    cleanup();

    const speak = vi.fn();
    const synth = { speak, cancel: vi.fn(), getVoices: () => [] };
    (window as unknown as Record<string, unknown>).speechSynthesis = synth;
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        constructor(public text: string) {}
        lang = '';
      },
    );
    render(<ShowToPerson text="Hi" lang="es" onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Read aloud' }));
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0]?.[0].lang).toBe('es-ES');
  });
  it('ShowToPerson marks Arabic as rtl', () => {
    render(<ShowToPerson text="شكراً." lang="ar" onClose={() => undefined} />);
    const p = screen.getByRole('dialog').querySelector('p')!;
    expect(p.getAttribute('dir')).toBe('rtl');
    expect(p.getAttribute('lang')).toBe('ar');
  });
});

describe('Badge screen', () => {
  it('persists locally, announces saved, and makes no network request', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const beacon = vi.fn();
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { sendBeacon: beacon }));
    render(<Badge />);
    expect((screen.getByRole('button', { name: 'Show badge' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.input(screen.getByLabelText('Name (optional)'), { target: { value: 'Kay' } });
    fireEvent.click(screen.getByLabelText('I prefer text'));
    expect(screen.getAllByRole('status').some((s) => s.textContent === 'Saved.')).toBe(true);
    expect(loadBadge()).toMatchObject({ name: 'Kay', text: true });
    cleanup();
    render(<Badge />);
    expect((screen.getByLabelText('Name (optional)') as HTMLInputElement).value).toBe('Kay');
    fireEvent.click(screen.getByRole('button', { name: 'Show badge' }));
    expect(screen.getByRole('dialog').textContent).toContain('Kay');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(beacon).not.toHaveBeenCalled();
  });
});

describe('Calm places', () => {
  it('lists 260A with building and level, and never invents a room for nursing or child care', () => {
    render(<CalmPlaces />);
    expect(screen.getByText('Salt Palace, level 2, room 260A')).toBeTruthy();
    expect(screen.getAllByText('Ask at registration')).toHaveLength(2);
    expect(CALM_PLACES.filter((p) => !p.whereKey).map((p) => p.id)).toEqual([
      'nursing',
      'childcare',
    ]);
    expect(screen.getByRole('link').getAttribute('href')).toContain('inclusion-accessibility');
    expect(screen.getByText(/Checked 2026-11-08/)).toBeTruthy();
  });
});
