import { describe, expect, it } from 'vitest';
import { createSliMonitor } from './sli';

describe('sli monitor', () => {
  it('2 slow then fast: no switch', () => {
    const m = createSliMonitor(() => true);
    expect([m.record(4500), m.record(5000), m.record(900), m.record(4100), m.record(4100)]).toEqual(
      ['none', 'none', 'none', 'none', 'none'],
    );
  });
  it('3 slow in a row switches once; 4000 ms counts as slow', () => {
    const m = createSliMonitor(() => true);
    expect([m.record(4000), m.record(4000), m.record(4000)]).toEqual(['none', 'none', 'switch']);
  });
  it('no alternative: message only, then silent', () => {
    const m = createSliMonitor(() => false);
    const out = Array.from({ length: 9 }, () => m.record(9000));
    expect(out.filter((a) => a === 'message')).toHaveLength(1);
    expect(out).not.toContain('switch');
  });
  it('no second switch in a session', () => {
    const m = createSliMonitor(() => true);
    const out = Array.from({ length: 9 }, () => m.record(9000));
    expect(out.filter((a) => a === 'switch')).toHaveLength(1);
  });
});
