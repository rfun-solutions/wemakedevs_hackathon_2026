import { describe, expect, it } from 'vitest';
import { formatNoteWhen } from './when';

describe('formatNoteWhen', () => {
  // 2026-11-09T23:12:00Z is 4:12 PM in Denver (MST, UTC-7)
  const iso = '2026-11-09T23:12:00Z';
  const norm = (s: string | null) => s?.replace(/\s/g, ' ');

  it('formats in America/Denver in English', () => {
    expect(norm(formatNoteWhen(iso, 'en'))).toBe('Mon, Nov 9 · 4:12 PM');
  });
  it('formats in Spanish', () => {
    expect(norm(formatNoteWhen(iso, 'es'))).toMatch(/^lun,? 9 nov\.? · 16:12$/);
  });
  it('uses venue time, not UTC, across midnight', () => {
    expect(norm(formatNoteWhen('2026-11-10T05:30:00Z', 'en'))).toBe('Mon, Nov 9 · 10:30 PM');
  });
  it('returns null for missing or invalid input', () => {
    expect(formatNoteWhen(undefined, 'en')).toBeNull();
    expect(formatNoteWhen('not a date', 'en')).toBeNull();
  });
});
