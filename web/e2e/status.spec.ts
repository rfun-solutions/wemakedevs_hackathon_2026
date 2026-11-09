import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const status = {
  server_ms_p95: 120,
  feed_synced_at: '2026-11-09T17:56:00Z',
  feed_age_s: 240,
  slo_ms: 500,
  chaos_active: false,
};

async function stubApi(page: Page, body: object = status) {
  await page.route('**/api/status', (r) => r.fulfill({ json: body }));
  await page.route('**/api/status/rtt', (r) => r.fulfill({ status: 204 }));
  await page.route('**/api/ping', (r) => r.fulfill({ status: 204 }));
}

test.describe('status screen', () => {
  test('shows the verdict, feed age, a polite live region, and is axe clean', async ({ page }) => {
    await stubApi(page);
    await page.goto('/status');
    await expect(
      page.getByRole('heading', { level: 2, name: /Wi-Fi or us|Wi-Fi o somos/ }),
    ).toBeVisible();
    await expect(page.locator('#status-verdict')).toContainText(/All good|Todo bien/);
    await expect(
      page.getByText(/Schedule updated 4 min ago|Programa actualizado hace 4 min/),
    ).toBeVisible();
    await expect(page.locator('#status-saved')).toHaveAttribute('aria-live', 'polite');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('says we are slow when server p95 is over the SLO', async ({ page }) => {
    await stubApi(page, { ...status, server_ms_p95: 900, chaos_active: true });
    await page.goto('/status');
    await expect(page.locator('#status-verdict')).toContainText(/We are slow|Vamos lentos/);
    await expect(page.locator('#status-chaos')).toBeVisible();
  });

  test('nav link to Status meets the 24 px target minimum', async ({ page }) => {
    await stubApi(page);
    await page.goto('/');
    const link = page.getByRole('navigation').getByRole('link', { name: /Status|Estado/ });
    const box = await link.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(24);
    expect(box!.height).toBeGreaterThanOrEqual(24);
  });
});
