import type { UnderTheHoodEntry } from './types';

const SPONSORS = ['gitar', 'dash0', 'radar'];
const KINDS = ['rule', 'check', 'query', 'trace', 'dashboard', 'investigation', 'workflow'];
const LIVE = /^(promise:P[1-5]|release|route:.+)$/;

export interface KeyLookup {
  en: ReadonlySet<string>;
  es: ReadonlySet<string>;
}

/** Returns a list of problems (empty when the entry is valid). `fileName` is the entry file without `.json`. */
export function validateEntry(entry: unknown, fileName: string, keys: KeyLookup): string[] {
  const errs: string[] = [];
  const e = entry as Partial<UnderTheHoodEntry> | null;
  if (!e || typeof e !== 'object') return [`${fileName}: not an object`];
  if (typeof e.id !== 'string' || !e.id) errs.push(`${fileName}: id must be a non-empty string`);
  else if (e.id !== fileName) errs.push(`${fileName}: id "${e.id}" must equal the file name`);
  if (!Number.isInteger(e.order) || (e.order as number) < 1 || (e.order as number) > 9)
    errs.push(`${fileName}: order must be an integer 1..9`);
  for (const k of ['titleKey', 'whatKey'] as const) {
    const v = e[k];
    if (typeof v !== 'string' || !v) errs.push(`${fileName}: ${k} must be a string`);
    else
      for (const lang of ['en', 'es'] as const)
        if (!keys[lang].has(v)) errs.push(`${fileName}: ${k} "${v}" missing in ${lang}/`);
  }
  if (!Array.isArray(e.promises) || e.promises.some((p) => typeof p !== 'string'))
    errs.push(`${fileName}: promises must be a string array`);
  if (!Array.isArray(e.tech) || e.tech.length < 1 || e.tech.length > 6)
    errs.push(`${fileName}: tech must have 1..6 items`);
  else
    e.tech.forEach((t, i) => {
      const at = `${fileName}: tech[${i}]`;
      if (!SPONSORS.includes(t?.sponsor)) errs.push(`${at}.sponsor invalid`);
      if (!KINDS.includes(t?.kind)) errs.push(`${at}.kind invalid`);
      if (typeof t?.label !== 'string' || !t.label) errs.push(`${at}.label required`);
      if (t?.ref !== undefined && typeof t.ref !== 'string')
        errs.push(`${at}.ref must be a string`);
      if (t?.live !== undefined && !LIVE.test(String(t.live))) errs.push(`${at}.live invalid`);
    });
  return errs;
}
