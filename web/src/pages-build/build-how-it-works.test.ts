// Tests for scripts/build-how-it-works.mjs. Lives here because Vitest only collects web/src and api tests.
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// @ts-expect-error plain .mjs script without type declarations
import { build, techLink } from '../../../scripts/build-how-it-works.mjs';

const REAL = resolve(import.meta.dirname, '../../..');
let root: string;
let out: string;

const entry = (over: Record<string, unknown> = {}) => ({
  id: 'x-one',
  order: 2,
  titleKey: 'x.hood.title',
  whatKey: 'x.hood.what',
  promises: ['P1'],
  tech: [
    { sponsor: 'gitar', kind: 'rule', label: 'rule IN-1', ref: '.gitar/review/inclusion.md' },
    {
      sponsor: 'dash0',
      kind: 'query',
      label: 'p95',
      ref: 'https://app.dash0.com/q',
      live: 'promise:P1',
    },
  ],
  ...over,
});

function put(rel: string, content: string | object) {
  const p = join(root, rel);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content));
}

beforeEach(() => {
  // Inside the repo (gitignored) so Vite may import the copied .ts modules.
  mkdirSync(join(REAL, '.pages-build'), { recursive: true });
  root = mkdtempSync(join(REAL, '.pages-build', 'fixture-'));
  out = mkdtempSync(join(tmpdir(), 'hiw-out-'));
  for (const f of [
    'web/src/under-the-hood/validate.ts',
    'web/src/features/access/promises.ts',
    'web/src/styles/tokens.css',
  ]) {
    mkdirSync(join(root, f, '..'), { recursive: true });
    cpSync(join(REAL, f), join(root, f));
  }
  const strings = { 'x.hood.title': 'One', 'x.hood.what': 'Does one thing.' };
  const promiseKeys = Object.fromEntries(
    ['P1', 'P2', 'P3', 'P4', 'P5'].map((p) => [`access.promise.${p}`, `Promise ${p}`]),
  );
  for (const l of ['en', 'es']) put(`web/src/i18n/${l}/x.json`, { ...strings, ...promiseKeys });
  put('web/src/under-the-hood/entries/x-one.json', entry());
  put('docs/how-it-works/index.html', '<!doctype html>');
  put('docs/how-it-works/app.js', '//');
  mkdirSync(join(root, 'docs/how-it-works/sub'), { recursive: true });
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(out, { recursive: true, force: true });
});

describe('build-how-it-works', () => {
  it('builds features.json with resolved strings, promises and links, and copies the page', async () => {
    const r = await build({ repoRoot: root, outDir: out });
    expect(r.entries).toBe(1);
    const data = JSON.parse(readFileSync(join(out, 'features.json'), 'utf8'));
    expect(data.promises.map((p: { id: string }) => p.id)).toEqual(['P1', 'P2', 'P3', 'P4', 'P5']);
    expect(data.promises[0].text).toBe('Promise P1');
    expect(data.entries[0]).toMatchObject({ id: 'x-one', title: 'One', what: 'Does one thing.' });
    expect(data.entries[0].tech[0].href).toMatch(/github\.com\/rfun-solutions\/.*inclusion\.md$/);
    expect(data.entries[0].tech[1]).toMatchObject({ href: null, signin: true, live: 'promise:P1' });
    expect(readdirSync(out).sort()).toEqual([
      'app.js',
      'features.json',
      'index.html',
      'tokens.css',
    ]);
  });

  it('sorts entries by order', async () => {
    put('web/src/under-the-hood/entries/x-zero.json', entry({ id: 'x-zero', order: 1 }));
    await build({ repoRoot: root, outDir: out });
    const data = JSON.parse(readFileSync(join(out, 'features.json'), 'utf8'));
    expect(data.entries.map((e: { id: string }) => e.id)).toEqual(['x-zero', 'x-one']);
  });

  it('fails naming the file on an invalid entry', async () => {
    put('web/src/under-the-hood/entries/x-bad.json', entry({ id: 'x-bad', order: 99 }));
    await expect(build({ repoRoot: root, outDir: out })).rejects.toThrow(/x-bad\.json.*order/);
    expect(existsSync(join(out, 'features.json'))).toBe(false);
  });

  it('fails when an EN key is missing', async () => {
    put('web/src/i18n/en/x.json', { 'x.hood.title': 'One' });
    await expect(build({ repoRoot: root, outDir: out })).rejects.toThrow(
      /x-one\.json.*whatKey.*missing in en/,
    );
  });

  it('refuses an output folder that contains the repo', async () => {
    await expect(build({ repoRoot: root, outDir: REAL })).rejects.toThrow(/contains the repo/);
  });

  it('writes nothing outside the output folder', async () => {
    await build({ repoRoot: root, outDir: out });
    expect(readdirSync(root).sort()).toEqual(['docs', 'web']);
    expect(existsSync(join(root, 'features.json'))).toBe(false);
  });

  it('techLink matches the in-app rules', () => {
    expect(
      techLink({ sponsor: 'radar', kind: 'investigation', label: 'r', ref: 'https://r.io/s' }),
    ).toEqual({ href: 'https://r.io/s', signin: false });
    expect(techLink({ sponsor: 'gitar', kind: 'rule', label: 'x' })).toEqual({
      href: null,
      signin: false,
    });
  });
});

describe('real registry', () => {
  it('builds from the repo entries', async () => {
    const o = mkdtempSync(join(tmpdir(), 'hiw-real-'));
    try {
      const r = await build({ repoRoot: REAL, outDir: o });
      expect(r.entries).toBeGreaterThanOrEqual(2);
    } finally {
      rmSync(o, { recursive: true, force: true });
    }
  });
});
