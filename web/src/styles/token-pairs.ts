/** Foreground/background token pairs that must meet WCAG contrast. Names are tokens.css custom properties. */
export interface TokenPair {
  fg: string;
  bg: string;
  /** Minimum contrast ratio: 4.5 body text, 3 large text and UI boundaries, 7 high-contrast text. */
  min: number;
  kind: 'text' | 'ui';
}

export const TOKEN_PAIRS: TokenPair[] = [
  { fg: '--color-text', bg: '--color-bg', min: 4.5, kind: 'text' },
  { fg: '--color-text', bg: '--color-surface', min: 4.5, kind: 'text' },
  { fg: '--color-text-muted', bg: '--color-bg', min: 4.5, kind: 'text' },
  { fg: '--color-text-muted', bg: '--color-surface', min: 4.5, kind: 'text' },
  { fg: '--color-text-on-accent', bg: '--color-accent', min: 4.5, kind: 'text' },
  { fg: '--color-text-on-accent', bg: '--color-accent-strong', min: 4.5, kind: 'text' },
  { fg: '--color-link', bg: '--color-bg', min: 4.5, kind: 'text' },
  { fg: '--color-link', bg: '--color-surface', min: 4.5, kind: 'text' },
  { fg: '--color-success', bg: '--color-success-bg', min: 4.5, kind: 'text' },
  { fg: '--color-warning', bg: '--color-warning-bg', min: 4.5, kind: 'text' },
  { fg: '--color-danger', bg: '--color-danger-bg', min: 4.5, kind: 'text' },
  { fg: '--color-info', bg: '--color-info-bg', min: 4.5, kind: 'text' },
  { fg: '--color-unknown', bg: '--color-unknown-bg', min: 4.5, kind: 'text' },
  { fg: '--show-fg', bg: '--show-bg', min: 4.5, kind: 'text' },
  { fg: '--color-border-strong', bg: '--color-bg', min: 3, kind: 'ui' },
  { fg: '--color-border-strong', bg: '--color-surface', min: 3, kind: 'ui' },
  { fg: '--color-focus-ring', bg: '--color-bg', min: 3, kind: 'ui' },
  { fg: '--color-focus-ring', bg: '--color-surface', min: 3, kind: 'ui' },
];

/** High-contrast set: text pairs need 7:1, UI boundaries stay at 3:1. */
export const TOKEN_PAIRS_HIGH: TokenPair[] = TOKEN_PAIRS.map((p) =>
  p.kind === 'text' ? { ...p, min: 7 } : p,
);

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a #RRGGBB colour. */
export function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`not a #RRGGBB colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

/** WCAG contrast ratio, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Read `--name: #hex;` declarations from one CSS block body. */
export function parseTokens(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2];
  return out;
}

/** Returns one message per failing pair (names the pair, ratio, minimum and computed colours). */
export function checkPairs(pairs: TokenPair[], tokens: Record<string, string>): string[] {
  const failures: string[] = [];
  for (const p of pairs) {
    const fg = tokens[p.fg];
    const bg = tokens[p.bg];
    if (!fg || !bg) {
      failures.push(
        `token pair ${p.fg} on ${p.bg}: missing value (${fg ?? 'no fg'}, ${bg ?? 'no bg'})`,
      );
      continue;
    }
    const r = contrastRatio(fg, bg);
    if (r < p.min) {
      failures.push(
        `token pair ${p.fg} on ${p.bg} is ${r.toFixed(2)}:1, minimum ${p.min}:1 (${fg} on ${bg})`,
      );
    }
  }
  return failures;
}
