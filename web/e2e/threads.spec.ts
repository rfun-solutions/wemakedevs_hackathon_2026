import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

const T1 = '11111111-1111-4111-8111-111111111111';
const A1 = '22222222-2222-4222-8222-222222222222';
const A2 = '33333333-3333-4333-8333-333333333333';
const P1 = '44444444-4444-4444-8444-444444444444';

const thread = (done = false) => ({
  id: T1,
  title: 'sampling otel collector',
  firstDay: '2026-11-10',
  lastDay: '2026-11-11',
  source: 'heuristic',
  noteIds: ['a', 'b', 'c'],
  actions: [
    { id: A1, threadId: T1, kind: 'follow_up', text: 'Try tail sampling', done },
    {
      id: A2,
      threadId: T1,
      kind: 'promise',
      text: 'Send Ana the config',
      done: false,
      promiseId: P1,
    },
  ],
});

async function stub(
  page: Page,
  opts: { threads?: unknown[]; runFails?: boolean; reason?: string } = {},
) {
  const calls: string[] = [];
  let threads = opts.threads ?? [];
  await page.route('**/api/**', async (route: Route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    calls.push(`${req.method()} ${path}`);
    if (path === '/api/threads/run') {
      if (opts.runFails) return route.fulfill({ status: 500, json: { error: 'x' } });
      threads = [thread()];
      return route.fulfill({
        json: {
          runId: 'r',
          mode: 'heuristic',
          reason: opts.reason ?? 'no_key',
          notesIn: 3,
          threads,
          usage: {},
        },
      });
    }
    if (path === '/api/threads') return route.fulfill({ json: { threads } });
    return route.fulfill({ status: 204, body: '' });
  });
  return calls;
}

const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();

test.describe('threads', () => {
  // The app's service worker would answer /api requests itself; the stubbed API must see them.
  test.use({ serviceWorkers: 'block' });

  test('empty state, build, fallback reason in plain words, axe clean, 24px targets', async ({
    page,
  }) => {
    const calls = await stub(page);
    await page.goto('/threads');
    await expect(page.getByRole('heading', { level: 2, name: 'Threads' })).toBeVisible();
    await expect(page.getByText('No threads yet')).toBeVisible();
    expect((await axe(page)).violations).toEqual([]);

    await page.getByRole('button', { name: 'Build threads now' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Grouped without AI: AI is not set up.' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 3, name: 'sampling otel collector' }),
    ).toBeVisible();
    await expect(page.getByText('3 notes · 2026-11-10 to 2026-11-11')).toBeVisible();
    expect(calls).toContain('POST /api/threads/run');
    expect((await axe(page)).violations).toEqual([]);

    for (const el of await page.locator('button, a[href], input[type=checkbox]').all()) {
      if (!(await el.isVisible())) continue;
      const box = await el.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(24);
      expect(box!.height).toBeGreaterThanOrEqual(24);
    }
  });

  test('ticking a follow-up uses the threads route, a promise uses the promises route', async ({
    page,
  }) => {
    const calls = await stub(page, { threads: [thread()] });
    await page.goto('/threads');
    await page.getByRole('checkbox', { name: 'Try tail sampling' }).check();
    await expect(
      page.getByRole('status').filter({ hasText: 'Done: Try tail sampling' }),
    ).toBeVisible();
    await page.getByRole('checkbox', { name: 'Send Ana the config' }).check();
    await expect(
      page.getByRole('status').filter({ hasText: 'Done: Send Ana the config' }),
    ).toBeVisible();
    expect(calls).toContain(`PATCH /api/threads/${T1}/actions/${A1}`);
    expect(calls).toContain(`PATCH /api/promises/${P1}`);
    expect((await axe(page)).violations).toEqual([]);
  });

  test('error state when the run fails', async ({ page }) => {
    await stub(page, { runFails: true });
    await page.goto('/threads');
    await page.getByRole('button', { name: 'Build threads now' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'That did not work' })).toBeVisible();
  });

  test('error state when the list fails to load, with retry', async ({ page }) => {
    await page.route('**/api/threads', (r) => r.fulfill({ status: 500, json: {} }));
    await page.goto('/threads');
    await expect(page.getByRole('alert')).toContainText('Could not load your threads.');
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    expect((await axe(page)).violations).toEqual([]);
  });

  test('Spanish strings', async ({ page }) => {
    await stub(page, { threads: [thread()] });
    await page.addInitScript(() => localStorage.setItem('kc.lang', 'es'));
    await page.goto('/threads');
    await expect(page.getByRole('button', { name: 'Crear hilos ahora' })).toBeVisible();
    await expect(page.getByText('Próximos pasos', { exact: true })).toBeVisible();
    expect((await axe(page)).violations).toEqual([]);
  });
});
