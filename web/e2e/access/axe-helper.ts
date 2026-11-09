import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag22aa'];

interface ContrastData {
  fgColor?: string;
  bgColor?: string;
  contrastRatio?: number;
  expectedContrastRatio?: string;
}

/**
 * Runs axe and returns readable failure lines. A colour-contrast failure inside ShowToPerson names the
 * token pair, so a CI log reader (Gitar) is pointed at the token to fix, e.g.
 * `token pair --show-fg on --show-bg is 3.90:1, needs 4.5:1 (computed #8a8a8a on #ffffff)`.
 */
export async function axeProblems(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const out: string[] = await showPairProblems(page);
  for (const v of results.violations) {
    for (const node of v.nodes) {
      const target = node.target.join(' ');
      if (v.id === 'color-contrast') {
        const d = (node.any[0]?.data ?? {}) as ContrastData;
        const inShow = await page
          .locator(target)
          .first()
          .evaluate((el) => !!el.closest('[data-show]'))
          .catch(() => false);
        const ratio = d.contrastRatio !== undefined ? d.contrastRatio.toFixed(2) : '?';
        const pair = inShow ? 'token pair --show-fg on --show-bg' : `element ${target}`;
        out.push(
          `${pair} is ${ratio}:1, needs ${d.expectedContrastRatio ?? '4.5:1'} (computed ${d.fgColor} on ${d.bgColor})`,
        );
      } else {
        out.push(`${v.id}: ${target} (${v.help})`);
      }
    }
  }
  return out;
}

/**
 * ShowToPerson is held to 4.5:1 for its token pair even though its text is large (axe only needs
 * 3:1 for large text). Failure names the pair so the fix is the token in tokens.css (A11Y-2).
 */
export async function showPairProblems(page: Page): Promise<string[]> {
  const pair = await page.evaluate(() => {
    const el = document.querySelector('[data-show]');
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { fg: cs.color, bg: cs.backgroundColor };
  });
  if (!pair) return [];
  const fg = parseRgb(pair.fg);
  const bg = parseRgb(pair.bg);
  const ratio = contrast(fg, bg);
  if (ratio >= 4.5) return [];
  return [
    `token pair --show-fg on --show-bg is ${ratio.toFixed(2)}:1, needs 4.5:1 (computed ${hex(fg)} on ${hex(bg)})`,
  ];
}

type Rgb = [number, number, number];
function parseRgb(css: string): Rgb {
  const m = css.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) throw new Error(`cannot parse colour ${css}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}
function hex(c: Rgb): string {
  return `#${c.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}
function luminance(c: Rgb): number {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
