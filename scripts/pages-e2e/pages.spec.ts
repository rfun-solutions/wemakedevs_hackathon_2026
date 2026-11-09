import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag22aa'];

for (const [name, viewport] of [
  ['390 px', { width: 390, height: 800 }],
  ['1280 px', { width: 1280, height: 900 }],
] as const) {
  test.describe(`built page at ${name}`, () => {
    test.use({ viewport });

    test('lists features and promises, no horizontal scroll, axe clean', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('#promises li')).toHaveCount(5);
      expect(await page.locator('#features section.entry').count()).toBeGreaterThanOrEqual(2);
      await expect(page.getByRole('link', { name: /Open the live Under the hood/ })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
      const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(results.violations).toEqual([]);
    });
  });
}

test('axe clean in dark mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('#features section.entry').first()).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(results.violations).toEqual([]);
});

test('200% zoom (font scale) has no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/');
  await expect(page.locator('#features section.entry').first()).toBeVisible();
  await page.addStyleTag({ content: ':root{--type-scale:2}' });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});

test('print styles hide the live-link section', async ({ page }) => {
  await page.goto('/');
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('link', { name: /Open the live Under the hood/ })).toBeHidden();
});
