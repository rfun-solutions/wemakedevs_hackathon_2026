import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// Task 1.5: C0's lint config (eslint-plugin-jsx-a11y) must flag click handlers on div/span.
// Only tighten the shared config, never remove rules.
async function lint(code: string): Promise<string[]> {
  const eslint = new ESLint({ cwd: process.cwd() });
  const [res] = await eslint.lintText(code, { filePath: 'web/src/__fixture__.tsx' });
  return (res?.messages ?? []).map((m) => m.ruleId ?? '');
}

describe('jsx-a11y lint fixture', () => {
  it('flags a div with a click handler', async () => {
    const rules = await lint(`export const A = () => <div onClick={() => {}}>x</div>;`);
    expect(rules.some((r) => r.startsWith('jsx-a11y/'))).toBe(true);
  });

  it('flags a span with a click handler', async () => {
    const rules = await lint(`export const A = () => <span onClick={() => {}}>x</span>;`);
    expect(rules.some((r) => r.startsWith('jsx-a11y/'))).toBe(true);
  });

  it('accepts a button with a click handler', async () => {
    const rules = await lint(
      `export const A = () => <button type="button" onClick={() => {}}>x</button>;`,
    );
    expect(rules.filter((r) => r.startsWith('jsx-a11y/'))).toEqual([]);
  });
});
