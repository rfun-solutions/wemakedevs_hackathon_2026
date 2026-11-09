import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(dir).filter((f) => /^sessionize-.*\.json$/.test(f));
const FORBIDDEN = ['speakers', 'speaker', 'bio', 'tagLine', 'profilePicture', 'links', 'email'];

function keysDeep(v, acc = new Set()) {
  if (Array.isArray(v)) v.forEach((x) => keysDeep(x, acc));
  else if (v && typeof v === 'object')
    for (const [k, x] of Object.entries(v)) {
      acc.add(k);
      keysDeep(x, acc);
    }
  return acc;
}

describe('fixtures-no-pii', () => {
  it('finds the fixtures', () =>
    expect(files).toEqual(expect.arrayContaining(['sessionize-v1.json', 'sessionize-v2.json'])));
  for (const f of files) {
    it(`${f} has no speaker or personal fields`, () => {
      const feed = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const keys = keysDeep(feed);
      for (const bad of FORBIDDEN) expect(keys.has(bad), `${f} has key ${bad}`).toBe(false);
      expect(JSON.stringify(feed)).not.toMatch(/@|https?:\/\//);
    });
  }
  it('v1 has 60 sessions', () => {
    expect(
      JSON.parse(fs.readFileSync(path.join(dir, 'sessionize-v1.json'), 'utf8')).sessions,
    ).toHaveLength(60);
  });
});
