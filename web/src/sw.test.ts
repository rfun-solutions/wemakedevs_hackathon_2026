import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// sw-should-handle.js is a classic script (importScripts in the worker); load it as text here.
const src = readFileSync(new URL('../public/sw-should-handle.js', import.meta.url), 'utf8');
const shouldHandle = new Function(`${src}; return shouldHandle;`)() as (url: string, origin: string) => boolean;
const O = 'https://kc.example.org';

describe('shouldHandle', () => {
  it('handles same-origin assets and pages', () => {
    expect(shouldHandle(`${O}/`, O)).toBe(true);
    expect(shouldHandle(`${O}/assets/index-abc.js`, O)).toBe(true);
    expect(shouldHandle('/manifest.webmanifest', O)).toBe(true);
  });
  it('skips /api/*', () => {
    expect(shouldHandle(`${O}/api/ping`, O)).toBe(false);
    expect(shouldHandle(`${O}/api`, O)).toBe(false);
  });
  it('skips *.dash0.com and any cross-origin host', () => {
    expect(shouldHandle('https://ingress.us-west-2.aws.dash0.com/v1/traces', O)).toBe(false);
    expect(shouldHandle('https://dash0.com/x', O)).toBe(false);
    expect(shouldHandle('https://cdn.example.com/a.js', O)).toBe(false);
  });
  it('does not skip look-alike paths', () => {
    expect(shouldHandle(`${O}/apiary`, O)).toBe(true);
  });
});
