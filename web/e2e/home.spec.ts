import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const TILES: [RegExp, string][] = [
  [/Capture/, '/capture'],
  [/Captions/, '/captions'],
  [/Schedule/, '/schedule'],
  [/Cards/, '/cards'],
  [/Threads/, '/threads'],
  [/Status/, '/status'],
];

const tiles = (page: Page) => page.locator('main .home-tiles');

async function stubAgenda(page: Page, items: unknown[]) {
  await page.route('**/api/agenda', (route) => route.fulfill({ json: { items, warnings: [] } }));
}

function futureSession() {
  const start = new Date(Date.now() + 60 * 60_000);
  const end = new Date(start.getTime() + 30 * 60_000);
  return {
    id: 's1',
    title: 'Accessible observability for everyone',
    description: null,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    venueTz: 'America/Denver',
    building: 'Building A',
    level: null,
    room: 'Room 101',
    track: null,
    audienceLevel: null,
    accessTags: [],
  };
}

test.describe('home', () => {
  test.use({ serviceWorkers: 'block' });
  test('tiles render with icons and navigate', async ({ page }) => {
    await stubAgenda(page, []);
    await page.goto('/');
    await expect(tiles(page).getByRole('link')).toHaveCount(TILES.length);
    for (const [name, href] of TILES) {
      const link = tiles(page).getByRole('link', { name });
      await expect(link).toHaveAttribute('href', href);
      await expect(link.locator('svg[aria-hidden="true"]')).toHaveCount(1);
      const box = await link.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await tiles(page)
      .getByRole('link', { name: /Schedule/ })
      .click();
    await expect(page).toHaveURL(/\/schedule$/);
  });

  test('Next up falls back calmly when the agenda is empty', async ({ page }) => {
    await stubAgenda(page, []);
    await page.goto('/');
    const next = page.getByTestId('home-next');
    await expect(next).toContainText('Add sessions to your agenda');
    await expect(next).toContainText('Browse the schedule and save the talks you want.');
    await expect(next).toHaveAttribute('href', '/schedule');
  });

  test('Next up shows loading while the agenda is being fetched', async ({ page }) => {
    await page.route('**/api/agenda', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({ json: { items: [], warnings: [] } });
    });
    await page.goto('/');
    const next = page.getByTestId('home-next');
    await expect(next).toContainText('Loading your agenda…');
    await expect(next).not.toContainText('Add sessions to your agenda');
  });

  test('Next up shows an unavailable message when the agenda errors', async ({ page }) => {
    await page.route('**/api/agenda', (route) => route.fulfill({ status: 500, body: 'x' }));
    await page.goto('/');
    const next = page.getByTestId('home-next');
    await expect(next).toContainText('Your agenda is temporarily unavailable.');
    await expect(next).not.toContainText('Add sessions to your agenda');
    await expect(next).toHaveAttribute('href', '/schedule');
  });

  test('Next up shows the next agenda session in venue time', async ({ page }) => {
    await stubAgenda(page, [futureSession()]);
    await page.goto('/');
    const next = page.getByTestId('home-next');
    await expect(next).toContainText('Accessible observability for everyone');
    await expect(next).toContainText('Room 101');
    await expect(next).toContainText(/M[SD]T/);
    await expect(next.locator('.home-next-label')).toHaveText('Next up');
    await expect(next).toHaveAttribute('href', '/agenda');
  });

  test('an in-progress agenda session is labelled Now', async ({ page }) => {
    const session = futureSession();
    session.startsAt = new Date(Date.now() - 5 * 60_000).toISOString();
    session.endsAt = new Date(Date.now() + 25 * 60_000).toISOString();
    await stubAgenda(page, [session]);
    await page.goto('/');
    const next = page.getByTestId('home-next');
    await expect(next.locator('.home-next-label')).toHaveText('Now');
    await expect(next.locator('.home-next-label')).not.toHaveText('Next up');
    await expect(next).toContainText('Accessible observability for everyone');
  });

  test('200% text: no horizontal scroll, no mid-word breaks', async ({ page }) => {
    await stubAgenda(page, [futureSession()]);
    await page.goto('/');
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-type-scale', '2');
      document.documentElement.style.setProperty('--type-scale', '2');
    });
    await expect(page.getByTestId('home-next')).toContainText('Room 101');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
    for (const label of await page.locator('.home-tile-label').all()) {
      const fits = await label.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
      expect(fits).toBe(true);
    }
  });

  for (const lang of ['en', 'es', 'ar']) {
    test(`is axe clean (${lang})`, async ({ page }) => {
      await stubAgenda(page, [futureSession()]);
      await page.addInitScript((l) => localStorage.setItem('kc.lang', l), lang);
      await page.goto('/');
      await expect(page.getByTestId('home-next')).toContainText('Room 101');
      if (lang === 'es')
        await expect(page.getByTestId('home-next')).toContainText('A continuación');
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
