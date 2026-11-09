import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// The API is stubbed so these specs do not depend on a database or on PR2's routes.
test.use({ serviceWorkers: 'block', timezoneId: 'Asia/Tokyo' });

const base = {
  description: null,
  venueTz: 'America/Denver',
  level: null,
  audienceLevel: null,
  accessTags: ['novice-friendly', 'captions-unknown'],
};
const SESSIONS = [
  {
    ...base,
    id: 's1',
    title: 'Intro to Tracing',
    startsAt: '2026-11-10T09:00:00-07:00',
    endsAt: '2026-11-10T09:35:00-07:00',
    building: 'Salt Palace',
    room: 'Hall A',
    track: 'Observability',
  },
  {
    ...base,
    id: 's2',
    title: 'Securing Workloads',
    startsAt: '2026-11-10T09:40:00-07:00',
    endsAt: '2026-11-10T10:15:00-07:00',
    building: 'Hyatt Regency',
    room: 'Mesa Ballroom',
    track: 'Security',
  },
  {
    ...base,
    id: 's3',
    title: 'Scaling Prometheus',
    startsAt: '2026-11-10T11:00:00-07:00',
    endsAt: '2026-11-10T11:35:00-07:00',
    building: 'Hyatt Regency',
    room: 'Grand Ballroom',
    track: 'Observability',
  },
  {
    ...base,
    id: 's4',
    title: 'Day Two Keynote',
    startsAt: '2026-11-11T09:00:00-07:00',
    endsAt: '2026-11-11T09:35:00-07:00',
    building: 'Salt Palace',
    room: 'Hall A',
    track: 'Platform',
  },
];

async function stubApi(page: Page, initialAgenda: string[] = []) {
  const agenda = new Set(initialAgenda);
  await page.route('**/api/sessions', (route) =>
    route.fulfill({
      json: {
        sessions: SESSIONS,
        filters: {
          days: ['2026-11-10', '2026-11-11'],
          rooms: ['Grand Ballroom', 'Hall A', 'Mesa Ballroom'],
          tracks: ['Observability', 'Platform', 'Security'],
        },
      },
    }),
  );
  await page.route('**/api/agenda', async (route) => {
    const req = route.request();
    if (req.method() === 'POST') {
      agenda.add((req.postDataJSON() as { session_id: string }).session_id);
      return route.fulfill({ status: 201, json: {} });
    }
    const items = SESSIONS.filter((s) => agenda.has(s.id));
    const warnings =
      agenda.has('s1') && agenda.has('s2')
        ? [
            {
              level: 'tight',
              fromSessionId: 's1',
              toSessionId: 's2',
              gapMinutes: 5,
              walkMinutes: 10,
              fromBuilding: 'Salt Palace',
              toBuilding: 'Hyatt Regency',
            },
          ]
        : [];
    return route.fulfill({ json: { items, warnings } });
  });
  await page.route('**/api/agenda/*', (route) => {
    agenda.delete(route.request().url().split('/').pop()!);
    return route.fulfill({ status: 204 });
  });
}

const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();

async function targetsOk(page: Page) {
  for (const el of await page.locator('button, a[href], select').all()) {
    if (!(await el.isVisible())) continue;
    const box = await el.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(24);
    expect(box!.height).toBeGreaterThanOrEqual(24);
  }
}

test.describe('schedule', () => {
  test('filters by day and track and shows venue time with the zone', async ({ page }) => {
    await stubApi(page);
    await page.goto('/schedule');
    await expect(page.getByRole('heading', { level: 3 })).toHaveCount(3); // first day by default
    await expect(page.getByText(/9:00\sAM – 9:35\sAM MST/)).toBeVisible();
    await page.getByLabel('Track').selectOption('Security');
    await expect(page.getByRole('heading', { level: 3 })).toHaveText(['Securing Workloads']);
    await page.getByLabel('Track').selectOption('');
    await page.getByRole('button', { name: /Wed, Nov 11/ }).click();
    await expect(page.getByRole('heading', { level: 3 })).toHaveText(['Day Two Keynote']);
    await expect(page.getByText('Estimated:').first()).toBeVisible();
  });

  test('add announces in a live region and the item shows on My agenda with a building warning', async ({
    page,
  }) => {
    await stubApi(page);
    await page.goto('/schedule');
    await page.getByRole('button', { name: 'Add to my agenda: Intro to Tracing' }).click();
    await expect(page.getByRole('button', { name: 'Added: Intro to Tracing' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(
      page.getByRole('status').filter({ hasText: 'Added to your agenda: Intro to Tracing' }),
    ).toBeAttached();
    await page.getByRole('button', { name: 'Add to my agenda: Securing Workloads' }).click();
    await page.goto('/agenda');
    const second = page.locator('li', { hasText: 'Securing Workloads' });
    await expect(
      second.getByText('Building change: about 10 min walk, you have 5 min'),
    ).toBeVisible();
    await expect(
      page.locator('li', { hasText: 'Intro to Tracing' }).getByText(/Building change/),
    ).toHaveCount(0);
  });

  test('Jump to now focuses the session in progress and shows the Now marker', async ({ page }) => {
    await stubApi(page, ['s1', 's2']);
    await page.clock.setFixedTime(new Date('2026-11-10T16:10:00Z')); // 09:10 MST, during s1
    await page.goto('/schedule');
    await page.getByRole('button', { name: 'Jump to now' }).click();
    const card = page.locator('#session-s1');
    await expect(card).toBeFocused();
    await expect(card.getByText('Now', { exact: true })).toBeVisible();
    await page.goto('/agenda');
    await page.getByRole('button', { name: 'Jump to now' }).click();
    await expect(page.locator('#session-s1')).toBeFocused();
    await expect(page.locator('#session-s1').getByText('Now', { exact: true })).toBeVisible();
  });

  test('between talks, Jump to now goes to the next session', async ({ page }) => {
    await stubApi(page);
    await page.clock.setFixedTime(new Date('2026-11-10T17:30:00Z')); // 10:30 MST, between s2 and s3
    await page.goto('/schedule');
    await page.getByRole('button', { name: 'Jump to now' }).click();
    const card = page.locator('#session-s3');
    await expect(card).toBeFocused();
    await expect(card.getByText('Up next')).toBeVisible();
  });

  test('after the last talk, Jump to now says so', async ({ page }) => {
    await stubApi(page);
    await page.clock.setFixedTime(new Date('2026-11-10T23:30:00Z')); // 16:30 MST, day one is over
    await page.goto('/schedule');
    await page.getByRole('button', { name: /Wed, Nov 11/ }).click();
    await page.getByRole('button', { name: 'Jump to now' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'No more sessions to jump to.' }),
    ).toBeAttached();
  });

  test('each agenda item links to the note screen with the session id', async ({ page }) => {
    await stubApi(page, ['s1']);
    await page.goto('/agenda');
    await expect(page.getByRole('link', { name: 'Take a note: Intro to Tracing' })).toHaveAttribute(
      'href',
      '/capture?session=s1',
    );
  });

  test('strings switch to Spanish', async ({ page }) => {
    await stubApi(page);
    await page.addInitScript(() => localStorage.setItem('kc.lang', 'es'));
    await page.goto('/schedule');
    await expect(page.getByRole('heading', { level: 2, name: 'Programa' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ir a ahora' })).toBeVisible();
    await expect(page.getByLabel('Sala')).toBeVisible();
  });

  test('both screens are axe clean with 24 px targets and no horizontal scroll', async ({
    page,
  }) => {
    await stubApi(page, ['s1', 's2']);
    for (const path of ['/schedule', '/agenda']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 3 }).first()).toBeVisible();
      expect((await axe(page)).violations).toEqual([]);
      await targetsOk(page);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
    }
  });
});
