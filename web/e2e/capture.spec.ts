import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// The e2e server is a static preview with no API, so /api/* is mocked in memory here.
// `net.online = false` makes every API call fail like a dropped connection.
interface Posted {
  client_id: string;
  body: string;
  source: string;
  session_id?: string;
}
function mockApi(page: Page) {
  const net = { online: true, posts: [] as Posted[], gets: [] as string[], store: [] as Posted[] };
  void page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (!net.online) return route.abort('internetdisconnected');
    if (url.pathname === '/api/notes' && req.method() === 'POST') {
      const body = req.postDataJSON() as Posted;
      net.posts.push(body);
      const replay = net.store.some((n) => n.client_id === body.client_id);
      if (!replay) net.store.unshift(body);
      return route.fulfill({
        status: replay ? 200 : 201,
        json: { id: body.client_id, client_id: body.client_id },
      });
    }
    if (url.pathname === '/api/notes' && req.method() === 'GET') {
      net.gets.push(url.search);
      const sid = url.searchParams.get('session_id');
      const notes = net.store
        .filter((n) => !sid || n.session_id === sid)
        .map((n) => ({
          id: n.client_id,
          body: n.body,
          session_id: n.session_id ?? null,
          created_at: '2026-11-10T10:00:00Z',
        }));
      return route.fulfill({ json: { notes } });
    }
    if (url.pathname === '/api/promises') return route.fulfill({ json: { promises: [] } });
    if (url.pathname === '/api/people') return route.fulfill({ json: { people: [] } });
    return route.fulfill({ status: 204, body: '' });
  });
  return net;
}

const noteField = (page: Page) => page.getByRole('textbox', { name: /^(Note|Nota)$/ });
const saveButton = (page: Page) => page.getByRole('button', { name: /Save note|Guardar nota/ });
const status = (page: Page) => page.locator('.capture-status');

// WebKit does not route requests of a service-worker-controlled page through page.route, so the mock
// would be bypassed after the worker activates. The worker has its own unit tests.
test.use({ serviceWorkers: 'block' });

test.describe('capture', () => {
  test('type, save on a phone, list shows it saved and the field refocuses', async ({ page }) => {
    const net = mockApi(page);
    net.online = false;
    await page.goto('/capture');
    await expect(noteField(page)).toBeFocused();
    await noteField(page).fill('Met a maintainer at the mesh talk');
    await saveButton(page).click();
    await expect(status(page)).toHaveText(/Saved|Guardada/);
    await expect(noteField(page)).toHaveValue('');
    await expect(noteField(page)).toBeFocused();
    await expect(page.getByText(/Saved on this phone|Guardada en este teléfono/)).toBeVisible();
  });

  test('repeated saves are announced again', async ({ page }) => {
    mockApi(page);
    await page.goto('/capture');
    await noteField(page).fill('first note');
    await saveButton(page).click();
    await expect(status(page)).toHaveText(/Saved|Guardada/);

    await page.evaluate(() => {
      const live = document.querySelector<HTMLParagraphElement>('.capture-status');
      if (!live) throw new Error('Capture status region was not rendered');
      live.dataset.announcementChanges = '';
      new MutationObserver(() => {
        live.dataset.announcementChanges += `|${live.textContent ?? ''}`;
      }).observe(live, { childList: true, characterData: true, subtree: true });
    });

    await noteField(page).fill('second note');
    await saveButton(page).click();
    await expect(status(page)).toHaveText(/Saved|Guardada/);
    await expect(status(page)).toHaveAttribute('data-announcement-changes', /\|\|/);
  });

  test('offline save survives reload and syncs after reconnect with no duplicates', async ({
    page,
  }) => {
    const net = mockApi(page);
    net.online = false;
    await page.goto('/capture');
    await noteField(page).fill('written offline');
    await saveButton(page).click();
    await expect(page.getByText(/Saved on this phone|Guardada en este teléfono/)).toBeVisible();

    await page.reload();
    await expect(page.getByText('written offline')).toBeVisible();
    expect(net.store).toHaveLength(0);

    net.online = true;
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(page.getByText(/Synced|Sincronizada/)).toBeVisible();
    await expect(page.getByText(/Saved on this phone|Guardada en este teléfono/)).toHaveCount(0);
    expect(net.store.map((n) => n.body)).toEqual(['written offline']);

    // a lost response is retried with the same client_id; the server keeps one note
    const first = net.posts[0]!;
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    expect(net.store.filter((n) => n.client_id === first.client_id)).toHaveLength(1);
  });

  test('dictation unsupported is announced and typing still works', async ({ page }) => {
    mockApi(page);
    await page.goto('/capture');
    await page.getByRole('button', { name: /^(Dictate|Dictar)$/ }).click();
    await expect(status(page)).toHaveText(/Dictation not available|Dictado no disponible/);
    await noteField(page).fill('typed instead');
    await expect(noteField(page)).toHaveValue('typed instead');
  });

  test('From this session: sends session_id and filters the list', async ({ page }) => {
    const net = mockApi(page);
    await page.goto('/capture?session=keynote-1');
    await noteField(page).fill('about the keynote');
    await saveButton(page).click();
    await expect.poll(() => net.posts.length).toBe(1);
    expect(net.posts[0]).toMatchObject({ source: 'typed', session_id: 'keynote-1' });
    await expect(page.getByText(/Session keynote-1|Sesión keynote-1/).first()).toBeVisible();
    await expect.poll(() => net.gets.some((q) => q.includes('session_id=keynote-1'))).toBe(true);

    const filter = page.getByRole('checkbox', { name: /From this session|De esta sesión/ });
    await expect(filter).toBeChecked();
    await filter.uncheck();
    await expect.poll(() => net.gets.some((q) => !q.includes('session_id'))).toBe(true);
  });

  test('notes without a session list normally and no filter is offered', async ({ page }) => {
    const net = mockApi(page);
    await page.goto('/capture');
    await noteField(page).fill('no session here');
    await saveButton(page).click();
    await expect(page.getByText(/Synced|Sincronizada/)).toBeVisible();
    expect(net.posts[0]?.session_id).toBeUndefined();
    await expect(
      page.getByRole('checkbox', { name: /From this session|De esta sesión/ }),
    ).toHaveCount(0);
  });

  test('50 saves: p95 of kc.capture.save is under 500 ms', async ({ page }) => {
    const net = mockApi(page);
    net.online = false; // measure the local durable write only
    await page.goto('/capture');
    for (let i = 0; i < 50; i++) {
      await noteField(page).fill(`note ${i}`);
      await saveButton(page).click();
      await expect(noteField(page)).toHaveValue('');
    }
    const durations = await page.evaluate(() =>
      performance.getEntriesByName('kc.capture.save').map((e) => e.duration),
    );
    expect(durations.length).toBeGreaterThanOrEqual(50);
    const sorted = [...durations].sort((a, b) => a - b);
    expect(sorted[Math.ceil(sorted.length * 0.95) - 1]).toBeLessThan(500);
  });

  test('capture screen is axe clean', async ({ page }) => {
    mockApi(page);
    await page.goto('/capture?session=keynote-1');
    await noteField(page).fill('axe check');
    await saveButton(page).click();
    await expect(status(page)).toHaveText(/Saved|Guardada/);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('controls meet the 24 px target minimum', async ({ page }) => {
    mockApi(page);
    await page.goto('/capture?session=keynote-1');
    for (const el of await page.locator('button, a[href], input, textarea').all()) {
      if (!(await el.isVisible())) continue;
      const box = await el.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(24);
      expect(box!.height).toBeGreaterThanOrEqual(24);
    }
  });
});
