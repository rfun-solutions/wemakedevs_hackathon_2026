import { expect, test, type Page } from '@playwright/test';
import { axeProblems } from './axe-helper';

/** No element inside <main> pokes out of the viewport. (Shell header and nav belong to C0w and D1.) */
async function mainFitsViewport(page: Page) {
  return page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    return [...document.querySelectorAll('main, main *')].every(
      (e) => e.getBoundingClientRect().right <= w + 1 && e.getBoundingClientRect().left >= -1,
    );
  });
}

test.describe('communication cards', () => {
  test('opens a preset full-screen, text fits, Close restores focus', async ({ page }) => {
    await page.goto('/cards');
    const card = page.getByRole('button', { name: "I'm deaf. Please type." });
    await card.click();
    const dlg = page.getByRole('dialog');
    await expect(dlg).toBeVisible();
    await expect(dlg.locator('p')).toHaveText("I'm deaf. Please type.");
    await expect(dlg.locator('p')).toHaveAttribute('lang', 'en');
    const fits = await dlg.evaluate((d) => {
      const p = d.querySelector('p')!.getBoundingClientRect();
      const b = d.getBoundingClientRect();
      return p.left >= 0 && p.right <= b.right && p.top >= 0 && p.bottom <= b.bottom;
    });
    expect(fits).toBe(true);
    await expect(page.getByRole('button', { name: 'Close' })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(dlg).toBeHidden();
    await expect(card).toBeFocused();
  });

  test('stutter preset and Escape', async ({ page }) => {
    await page.goto('/cards');
    const card = page.getByRole('button', { name: /I stutter/ });
    await card.click();
    await expect(page.getByRole('dialog').locator('p')).toHaveText(
      'I stutter. Please give me time to finish.',
    );
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(card).toBeFocused();
  });

  test('a long custom card is fully visible with Close reachable', async ({ page }) => {
    await page.goto('/cards');
    const text = 'Where is room 260A? '.repeat(8).trim();
    await expect(page.getByRole('button', { name: 'Show', exact: true })).toBeDisabled();
    await page.getByLabel('Write your own message', { exact: true }).last().fill(text);
    await page.getByRole('button', { name: 'Show', exact: true }).click();
    const dlg = page.getByRole('dialog');
    await expect(dlg.locator('p')).toHaveText(text);
    const fits = await dlg.evaluate((d) => {
      const p = d.querySelector('p')!;
      return p.scrollHeight <= (p.parentElement as HTMLElement).clientHeight;
    });
    expect(fits).toBe(true);
    await expect(page.getByRole('button', { name: 'Close' })).toBeInViewport();
  });

  test('card language is independent of the UI language', async ({ page }) => {
    await page.goto('/cards');
    await page.getByLabel('Card language').selectOption('es');
    await page.getByRole('button', { name: 'Gracias.' }).click();
    await expect(page.getByRole('dialog').locator('p')).toHaveAttribute('lang', 'es');
  });
});

test.describe('badge', () => {
  test('persists across reload and sends nothing over the network', async ({ page }) => {
    const sent: string[] = [];
    page.on('request', (r) => sent.push(`${r.url()} ${r.postData() ?? ''}`));
    await page.goto('/badge');
    await page.getByLabel('Name (optional)').fill('Zebulon');
    await page.getByLabel('Pronouns (optional)').fill('they/them');
    await page.getByLabel('I prefer text').check();
    await page.reload();
    await expect(page.getByLabel('Name (optional)')).toHaveValue('Zebulon');
    await expect(page.getByLabel('I prefer text')).toBeChecked();
    await page.getByRole('button', { name: 'Show badge' }).click();
    await expect(page.getByRole('dialog')).toContainText('Zebulon');
    await expect(page.getByRole('dialog')).toContainText('I prefer text');
    expect(sent.filter((s) => /Zebulon|they\/them/.test(s))).toEqual([]);
  });
});

test.describe('calm places', () => {
  test('lists 260A as text, makes no location request, and works offline', async ({
    page,
    context,
  }) => {
    const sent: string[] = [];
    page.on('request', (r) => sent.push(`${r.url()} ${r.postData() ?? ''}`));
    await page.goto('/calm');
    await expect(page.getByText('Salt Palace, level 2, room 260A')).toBeVisible();
    await expect(page.getByText('Ask at registration')).toHaveCount(2);
    for (const el of await page.locator('main a[href], main button').all()) {
      const box = await el.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(24);
    }
    expect(sent.filter((s) => /lat=|lon=|geo|crowd/i.test(s))).toEqual([]);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await page.reload();
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByText('Salt Palace, level 2, room 260A')).toBeVisible();
    await context.setOffline(false);
  });
});

test.describe('axe', () => {
  const screens = ['/cards', '/badge', '/calm'];
  const modes: Array<[string, (p: Page) => Promise<void>]> = [
    ['default', async () => undefined],
    [
      '200% type',
      (p) => p.evaluate(() => document.documentElement.style.setProperty('--type-scale', '2')),
    ],
    [
      'high contrast',
      (p) => p.evaluate(() => document.documentElement.setAttribute('data-contrast', 'high')),
    ],
  ];
  for (const path of screens) {
    for (const [name, apply] of modes) {
      test(`${path} is axe clean in ${name} with its content inside the viewport`, async ({
        page,
      }) => {
        await page.goto(path);
        await apply(page);
        expect(await axeProblems(page)).toEqual([]);
        expect(await mainFitsViewport(page)).toBe(true);
      });
    }
  }

  test('Cards in Arabic (RTL) is axe clean', async ({ page }) => {
    await page.goto('/cards');
    await page.getByLabel('Card language').selectOption('ar');
    expect(await axeProblems(page)).toEqual([]);
  });

  for (const [name, apply] of modes) {
    test(`ShowToPerson is axe clean in ${name}`, async ({ page }) => {
      await page.goto('/cards');
      await apply(page);
      await page.getByRole('button', { name: 'Thank you.' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      expect(await axeProblems(page)).toEqual([]);
    });
  }
});
