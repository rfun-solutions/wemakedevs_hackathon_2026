import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const SCALES = [1, 2] as const;

async function setScale(page: Page, scale: number) {
  await page.evaluate(
    (s) => document.documentElement.style.setProperty('--type-scale', String(s)),
    scale,
  );
}

const nav = (page: Page) => page.getByRole('navigation', { name: /Main|Principal/ });
const moreButton = (page: Page) => nav(page).getByRole('button', { name: /^(More|Más)$/ });

for (const scale of SCALES) {
  test.describe(`bottom nav at ${scale * 100}% text`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await setScale(page, scale);
    });

    test('no label breaks mid-word, targets are 24 px, nothing overflows', async ({ page }) => {
      // Independent of the More button, so it also exposes the old one-link-per-screen bar.
      const button = moreButton(page);
      if (await button.count()) {
        await button.click();
        await expect(button).toHaveAttribute('aria-expanded', 'true');
      }
      const links = await nav(page).locator('a[href], button').all();
      expect(links.length).toBeGreaterThanOrEqual(8);
      for (const el of links) {
        if (!(await el.isVisible())) continue;
        const m = await el.evaluate((node) => {
          const cs = getComputedStyle(node);
          const r = node.getBoundingClientRect();
          return {
            text: node.textContent,
            w: r.width,
            h: r.height,
            contentH: r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom),
            lineHeight: parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5,
            overflowX: node.scrollWidth > node.clientWidth + 1,
          };
        });
        // A per-character wrap makes the link many lines tall (Settings was 332 px).
        expect(m.contentH, `${m.text} text height`).toBeLessThanOrEqual(m.lineHeight * 3);
        expect(m.overflowX, `${m.text} overflows`).toBe(false);
        expect(m.w, `${m.text} width`).toBeGreaterThanOrEqual(24);
        expect(m.h, `${m.text} height min`).toBeGreaterThanOrEqual(24);
      }
      const docOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(docOverflow).toBe(false);
    });

    test('axe is clean with More closed and open', async ({ page }) => {
      const run = () =>
        new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
      expect((await run()).violations).toEqual([]);
      await moreButton(page).click();
      expect((await run()).violations).toEqual([]);
    });
  });
}

test.describe('More menu', () => {
  test('toggles, links are plain, Escape closes and returns focus', async ({ page }) => {
    await page.goto('/');
    const button = moreButton(page);
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    const menuId = await button.getAttribute('aria-controls');
    expect(menuId).toBeTruthy();
    const menu = page.locator(`#${menuId}`);
    await expect(menu).toBeHidden();
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(menu).toBeVisible();
    expect(await menu.getByRole('link').count()).toBeGreaterThan(0);
    await button.click();
    await expect(menu).toBeHidden();
    await button.click();
    await menu.getByRole('link').first().focus();
    await page.keyboard.press('Escape');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(menu).toBeHidden();
    await expect(button).toBeFocused();
  });

  test('primary bar holds Home and Captions; Status sits under More', async ({ page }) => {
    await page.goto('/');
    const menuId = await moreButton(page).getAttribute('aria-controls');
    const bar = nav(page).locator('ul').first();
    await expect(bar.getByRole('link', { name: /Home|Inicio/ })).toBeVisible();
    await expect(bar.getByRole('link', { name: 'Captions' })).toBeVisible();
    await expect(page.locator(`#${menuId} a`, { hasText: /Status|Estado/ })).toHaveCount(1);
  });

  test('aria-current marks the page, including an item inside More', async ({ page }) => {
    await page.goto('/captions');
    await expect(nav(page).locator('[aria-current="page"]')).toHaveCount(1);
    await expect(nav(page).locator('[aria-current="page"]')).toHaveAttribute('href', '/captions');
    await page.goto('/status');
    await moreButton(page).click();
    const current = nav(page).locator('[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toHaveAttribute('href', '/status');
    await expect(current).toBeVisible();
  });
});
