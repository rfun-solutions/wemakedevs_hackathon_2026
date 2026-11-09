import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Keys mirror web/src/prefs/display.ts (PREFS_STORAGE_KEYS) and web/src/i18n/index.ts.
const DISPLAY_KEY = 'kc.display.v1';
const LANG_KEY = 'kc.lang';

async function seed(page: Page, display: object | null, lang?: string) {
  await page.addInitScript(
    ([dk, d, lk, l]) => {
      if (d) localStorage.setItem(dk as string, d as string);
      if (l) localStorage.setItem(lk as string, l as string);
    },
    [DISPLAY_KEY, display ? JSON.stringify(display) : '', LANG_KEY, lang ?? ''],
  );
}

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();

for (const [path, lang] of [
  ['/', 'en'],
  ['/settings', 'en'],
  ['/', 'es'], // header button is then the longest label (Português (Brasil))
  ['/settings', 'es'],
] as const) {
  test(`200% text (${lang}): ${path} has no horizontal scroll and the header controls stay on screen`, async ({
    page,
  }) => {
    await seed(page, { typeScale: 2 }, lang);
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('data-type-scale', '2');
    expect(await noHorizontalScroll(page)).toBe(true);
    const vw = page.viewportSize()!.width;
    for (const el of await page.locator('header button, header a').all()) {
      const box = await el.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(vw);
    }
  });
}

test('settings screen is axe clean by default, at 200%, in high contrast and in Arabic', async ({
  page,
}) => {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { level: 2, name: 'Display and language' })).toBeVisible();
  expect((await axe(page)).violations).toEqual([]);

  await seed(page, { typeScale: 2, contrast: 'high' });
  await page.goto('/settings');
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high');
  expect((await axe(page)).violations).toEqual([]);
  expect(await noHorizontalScroll(page)).toBe(true);

  await seed(page, { typeScale: 2 }, 'ar');
  await page.goto('/settings');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  expect((await axe(page)).violations).toEqual([]);
  expect(await noHorizontalScroll(page)).toBe(true);
});

test('text size, font and contrast persist across reload', async ({ page }) => {
  await page.goto('/settings');
  const slider = page.getByRole('slider', { name: 'Text size' });
  await slider.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  await expect(page.locator('html')).toHaveAttribute('data-type-scale', '1.5');
  await expect(page.getByTestId('announce-polite')).toContainText('150');
  await page.getByRole('checkbox', { name: 'High contrast' }).check();
  await page.getByRole('checkbox', { name: 'Use the Atkinson Hyperlegible font' }).uncheck();
  await page.reload();
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-type-scale', '1.5');
  await expect(html).toHaveAttribute('data-contrast', 'high');
  await expect(html).toHaveAttribute('data-font', 'system');
  await expect(page.getByRole('slider', { name: 'Text size' })).toHaveValue('150');
});

test('switching language updates text, <html lang> and announces', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'Español' }).check();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('heading', { level: 2, name: 'Pantalla e idioma' })).toBeVisible();
  await expect(page.getByTestId('announce-polite')).toContainText('Español');
  await expect(page.getByText('asistidas por IA')).toBeVisible();
});

test('blocked storage: the app still renders with defaults', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('blocked');
      },
    });
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/settings');
  await expect(page.getByRole('heading', { level: 2, name: 'Display and language' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-type-scale', '1');
  await page.getByRole('checkbox', { name: 'High contrast' }).check(); // applies for this visit
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high');
  expect(errors).toEqual([]);
});
