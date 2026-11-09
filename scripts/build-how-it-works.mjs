// Builds the static "How it works" site: node --experimental-strip-types scripts/build-how-it-works.mjs <outDir>
// Reads web/src/under-the-hood/entries/*.json, validates them with C0's validateEntry, resolves every
// *Key from web/src/i18n/en/*.json, adds the access promises, and writes <outDir>/features.json plus
// copies of docs/how-it-works/* and web/src/styles/tokens.css. Writes nothing outside <outDir>.
import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO_BLOB = 'https://github.com/rfun-solutions/wemakedevs_hackathon_2026/blob/main/';
const defaultRoot = resolve(import.meta.dirname, '..');

function readJsonDir(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ file: f.slice(0, -'.json'.length), json: JSON.parse(readFileSync(join(dir, f), 'utf8')) }));
}

function mergedKeys(dir) {
  const dict = {};
  for (const { json } of readJsonDir(dir)) Object.assign(dict, json);
  return dict;
}

/** Same link rules as the in-app screen (techHref / needsSignin). */
export function techLink(tech) {
  if (!tech.ref) return { href: null, signin: false };
  if (/^https?:\/\//.test(tech.ref)) {
    return tech.sponsor === 'dash0' ? { href: null, signin: true } : { href: tech.ref, signin: false };
  }
  return { href: REPO_BLOB + tech.ref.replace(/^\/+/, ''), signin: false };
}

/**
 * @param {{ repoRoot?: string, outDir: string }} opts
 * @returns {Promise<{ entries: number }>} throws Error naming the file on any invalid entry or missing key
 */
export async function build({ repoRoot = defaultRoot, outDir }) {
  if (!outDir) throw new Error('usage: build-how-it-works.mjs <outDir>');
  const out = resolve(outDir);
  if (out === resolve(repoRoot) || resolve(repoRoot).startsWith(out + sep)) {
    throw new Error(`refusing to write to ${out}: it contains the repo`);
  }
  const { validateEntry } = await import(
    /* @vite-ignore */ pathToFileURL(join(repoRoot, 'web/src/under-the-hood/validate.ts')).href
  );
  const { PROMISES } = await import(
    /* @vite-ignore */ pathToFileURL(join(repoRoot, 'web/src/features/access/promises.ts')).href
  );
  const en = mergedKeys(join(repoRoot, 'web/src/i18n/en'));
  const es = mergedKeys(join(repoRoot, 'web/src/i18n/es'));
  const keys = { en: new Set(Object.keys(en)), es: new Set(Object.keys(es)) };

  const problems = [];
  const entries = [];
  for (const { file, json } of readJsonDir(join(repoRoot, 'web/src/under-the-hood/entries'))) {
    const errs = validateEntry(json, file, keys);
    if (errs.length) {
      problems.push(...errs.map((e) => `${file}.json: ${e}`));
      continue;
    }
    entries.push({
      id: json.id,
      order: json.order,
      title: en[json.titleKey],
      what: en[json.whatKey],
      promises: json.promises,
      tech: json.tech.map((t) => ({
        sponsor: t.sponsor,
        kind: t.kind,
        label: t.label,
        ...techLink(t),
        live: t.live ?? null,
      })),
    });
  }
  const promises = [];
  for (const p of PROMISES) {
    if (!(p.titleKey in en)) problems.push(`promises.ts: ${p.id} key "${p.titleKey}" missing in en/`);
    else promises.push({ id: p.id, text: en[p.titleKey], ruleIds: p.ruleIds });
  }
  if (problems.length) throw new Error(problems.join('\n'));
  entries.sort((a, b) => a.order - b.order);

  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'features.json'), JSON.stringify({ promises, entries }, null, 2) + '\n');
  const pageDir = join(repoRoot, 'docs/how-it-works');
  for (const f of readdirSync(pageDir)) {
    if (statSync(join(pageDir, f)).isFile()) copyFileSync(join(pageDir, f), join(out, f));
  }
  copyFileSync(join(repoRoot, 'web/src/styles/tokens.css'), join(out, 'tokens.css'));
  return { entries: entries.length };
}

if (process.argv[1] && basename(process.argv[1]) === 'build-how-it-works.mjs') {
  build({ outDir: process.argv[2] }).then(
    (r) => console.log(`built ${r.entries} entries into ${process.argv[2]}`),
    (e) => {
      console.error(e.message);
      process.exit(1);
    },
  );
}
