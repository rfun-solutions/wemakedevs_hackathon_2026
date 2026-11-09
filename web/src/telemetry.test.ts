import { describe, expect, it } from 'vitest';
import { DEFAULT_SERVICE_NAME, KAY_SERVICE_NAME, resolveServiceName } from './telemetry';

describe('resolveServiceName', () => {
  it('honours kc.probe=kay', () => {
    expect(resolveServiceName({ getItem: () => 'kay' })).toBe(KAY_SERVICE_NAME);
  });
  it('ignores other values', () => {
    expect(resolveServiceName({ getItem: () => 'other' })).toBe(DEFAULT_SERVICE_NAME);
    expect(resolveServiceName({ getItem: () => null })).toBe(DEFAULT_SERVICE_NAME);
  });
  it('keeps the default when storage throws', () => {
    expect(resolveServiceName({ getItem: () => { throw new Error('denied'); } })).toBe(DEFAULT_SERVICE_NAME);
  });
});
