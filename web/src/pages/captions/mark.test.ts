import { describe, expect, it } from 'vitest';
import { markNoteBody, venueTime } from './mark';

describe('time mark', () => {
  it('formats venue time in America/Denver (MST in November, UTC-7)', () => {
    expect(venueTime(new Date('2026-11-09T21:05:09Z'))).toBe('14:05:09');
  });
  it('uses 00 not 24 at midnight and pads fields', () => {
    expect(venueTime(new Date('2026-11-10T07:00:03Z'))).toBe('00:00:03');
  });
  it('follows daylight time too (UTC-6 in summer)', () => {
    expect(venueTime(new Date('2026-07-01T18:00:00Z'))).toBe('12:00:00');
  });
  it('builds the note text with the last caption line', () => {
    expect(markNoteBody('14:05:09', 'Kubernetes 1.36 is out')).toBe(
      '[mark 14:05:09] Kubernetes 1.36 is out',
    );
  });
  it('trims, and has just the tag without a line', () => {
    expect(markNoteBody('14:05:09', '  hi  ')).toBe('[mark 14:05:09] hi');
    expect(markNoteBody('14:05:09', undefined)).toBe('[mark 14:05:09]');
    expect(markNoteBody('14:05:09', '   ')).toBe('[mark 14:05:09]');
  });
});
