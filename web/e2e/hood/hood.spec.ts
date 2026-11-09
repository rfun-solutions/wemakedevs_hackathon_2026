import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const SNAPSHOT = {
  source: 'dash0',
  polledAt: '2026-11-09T22:52:10Z',
  routes: [{ route: 'GET /api/agenda', p95Ms: 180, slow: false }],
  promises: { P1: { state: 'ok' }, P2: { state: 'degraded' } },
};

async function stubStatus(page: Page, mode: 'live' | 'missing') {
  await page.route('**/api/status/health', (r) =>
    mode === 'live' ? r.fulfill({ json: SNAPSHOT }) : r.fulfill({ status: 404 }),
  );
  await page.route('**/api/status/release', (r) =>
    mode === 'live'
      ? r.fulfill({
          json: {
            releasedAt: '2026-11-09T22:52:00Z',
            gitarReviewed: true,
            radarUrl: 'https://r.io/s',
          },
        })
      : r.fulfill({ status: 204 }),
  );
}

test.describe('under the hood', () => {
  test('renders every registry entry with Gitar and Dash0 lists', async ({ page }) => {
    await stubStatus(page, 'missing');
    await page.goto('/under-the-hood');
    await expect(page.getByRole('heading', { level: 2, name: 'Under the hood' })).toBeVisible();
    expect(await page.getByRole('heading', { level: 3 }).count()).toBeGreaterThanOrEqual(2);
    await expect(
      page.getByRole('heading', { level: 3, name: 'Always-on foundation' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { level: 4, name: 'Gitar' }).first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 4, name: 'Dash0' }).first()).toBeVisible();
    const link = page.getByRole('link', { name: /accessibility.md A11Y-1/ });
    await expect(link).toHaveAttribute(
      'href',
      /github\.com\/rfun-solutions\/.*\.gitar\/review\/accessibility\.md$/,
    );
  });

  test('shows live values from a stubbed snapshot and release', async ({ page }) => {
    await stubStatus(page, 'live');
    await page.goto('/under-the-hood');
    await expect(
      page.getByText(/Last release 15:52, Gitar-reviewed, Radar all-clear/),
    ).toBeVisible();
  });

  test('missing endpoints say "No live data right now" and invent nothing', async ({ page }) => {
    await stubStatus(page, 'missing');
    await page.goto('/under-the-hood');
    await expect(page.getByText('No live data right now').first()).toBeVisible();
    await expect(page.getByText(/take \d+ ms or less/)).toHaveCount(0);
  });

  test('offline shows "No live data right now"', async ({ page, context }) => {
    await page.goto('/under-the-hood');
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await page.reload();
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByText('No live data right now').first()).toBeVisible();
    await context.setOffline(false);
  });

  test('Spanish strings when the saved language is Spanish', async ({ page }) => {
    await stubStatus(page, 'live');
    await page.addInitScript(() => localStorage.setItem('kc.lang', 'es'));
    await page.goto('/under-the-hood');
    await expect(page.getByRole('heading', { level: 2, name: 'Bajo el capó' })).toBeVisible();
    await expect(
      page.getByText(/Última versión 15:52, revisada por Gitar, Radar sin alertas/),
    ).toBeVisible();
  });

  test('200% text has no horizontal scroll', async ({ page }) => {
    await stubStatus(page, 'live');
    await page.goto('/under-the-hood');
    await page.evaluate(() => document.documentElement.style.setProperty('--type-scale', '2'));
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });

  test('targets are at least 24 px and the page is axe clean', async ({ page }) => {
    await stubStatus(page, 'live');
    await page.goto('/under-the-hood');
    await expect(page.getByText(/Last release 15:52/)).toBeVisible();
    for (const el of await page.locator('button, a[href]').all()) {
      if (!(await el.isVisible())) continue;
      const box = await el.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(24);
      expect(box!.width).toBeGreaterThanOrEqual(24);
    }
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
