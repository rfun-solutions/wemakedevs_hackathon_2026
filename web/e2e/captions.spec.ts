import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Fake audio source: a scripted SpeechRecognition and a getUserMedia stub, installed before the app loads, so the
 * real speech module, platform detection and Captions screen run unchanged. `Date.now` can jump so a "slow" engine
 * does not need real seconds.
 */
async function installFakeSpeech(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    let offset = 0;
    const realNow = Date.now.bind(Date);
    Date.now = () => realNow() + offset;
    let rec: Record<string, ((e?: unknown) => void) | undefined> | null = null;
    class FakeRecognition {
      continuous = false;
      interimResults = false;
      lang = '';
      onstart: (() => void) | undefined;
      onaudiostart: (() => void) | undefined;
      onresult: ((e: unknown) => void) | undefined;
      onerror: ((e: unknown) => void) | undefined;
      onend: (() => void) | undefined;
      start() {
        rec = this as never;
        setTimeout(() => {
          this.onstart?.();
          this.onaudiostart?.();
        }, 5);
      }
      stop() {
        setTimeout(() => this.onend?.(), 0);
      }
      abort() {}
    }
    w.SpeechRecognition = FakeRecognition;
    w.webkitSpeechRecognition = FakeRecognition;
    const media = {
      getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }),
    };
    Object.defineProperty(navigator, 'mediaDevices', { value: media, configurable: true });
    const emit = (text: string, isFinal: boolean) => {
      const r = Object.assign([{ transcript: text }], { isFinal });
      rec?.onresult?.({ resultIndex: 0, results: [r] });
    };
    w.__say = (text: string, slowMs = 0) => {
      emit(text, false);
      offset += slowMs;
      emit(text, true);
    };
  });
}

const say = (page: Page, text: string, slowMs = 0) =>
  page.evaluate(
    ([t, s]) =>
      (window as never as { __say(t: string, s: number): void }).__say(t as string, s as number),
    [text, slowMs],
  );

async function open(page: Page) {
  await installFakeSpeech(page);
  await page.goto('/captions');
  await page.getByRole('button', { name: /turn on captions|activar subtítulos/i }).click();
  await expect(
    page.getByRole('button', { name: /turn off captions|desactivar subtítulos/i }),
  ).toBeVisible();
}

// The service worker is not under test here; in WebKit a cold worker delays page.route-stubbed requests past the
// 1.5 s health timeout.
test.use({ serviceWorkers: 'block' });

test.describe('captions', () => {
  test('shows fake-engine captions in a polite log; axe clean; targets >= 24 px; no horizontal scroll', async ({
    page,
  }) => {
    await open(page);
    await say(page, 'Welcome to the keynote');
    const log = page.getByRole('log');
    await expect(log).toContainText('Welcome to the keynote');
    await expect(log).toHaveAttribute('aria-live', 'polite');
    await expect(page.getByText(/Captions by: Browser speech/)).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
    for (const el of await page.locator('button, a[href], input').all()) {
      if (!(await el.isVisible())) continue;
      const box = await el.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(24);
      expect(box!.height).toBeGreaterThanOrEqual(24);
    }
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('Save as note posts the line to /api/notes with the device id', async ({ page }) => {
    const posts: { body: Record<string, unknown>; device: string | undefined }[] = [];
    await page.route('**/api/notes', async (route) => {
      if (route.request().method() === 'POST') {
        posts.push({
          body: route.request().postDataJSON(),
          device: route.request().headers()['x-device-id'],
        });
        return route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
      }
      return route.continue();
    });
    await open(page);
    await say(page, 'Save this sentence');
    await page.getByRole('button', { name: /Save as note: Save this sentence/ }).click();
    await expect.poll(() => posts.length).toBeGreaterThan(0);
    expect(posts[0]!.body).toMatchObject({ body: 'Save this sentence', source: 'caption' });
    expect(posts[0]!.device).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('Insert time mark adds a venue-time line and saves [mark HH:MM:SS] <last line>', async ({
    page,
  }) => {
    const posts: Record<string, unknown>[] = [];
    await page.route('**/api/notes', async (route) => {
      if (route.request().method() === 'POST') {
        posts.push(route.request().postDataJSON());
        return route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
      }
      return route.continue();
    });
    await open(page);
    await say(page, 'Last words before the mark');
    await page.getByRole('button', { name: 'Insert time mark' }).click();
    await expect(page.getByRole('log')).toContainText(/Mark \d{2}:\d{2}:\d{2}/);
    await expect.poll(() => posts.length).toBeGreaterThan(0);
    expect(posts[0]!.body).toMatch(/^\[mark \d{2}:\d{2}:\d{2}\] Last words before the mark$/);
    expect(posts[0]!.source).toBe('caption');
  });

  test('a slow engine with no alternative says captions are falling behind on this phone', async ({
    page,
  }) => {
    await open(page);
    for (const w of ['one', 'two', 'three']) await say(page, w, 4500);
    await expect(page.locator('.captions-message')).toContainText(
      'Captions are falling behind on this phone.',
    );
  });

  test('stubbed health shows "slow for everyone"', async ({ page }) => {
    await page.route('**/api/status/health*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ source: 'live', captions: { fasterEngine: null, lagging: true } }),
      }),
    );
    await open(page);
    await expect(page.locator('.captions-message')).toContainText(
      'Captions are slow for everyone right now, not your phone.',
    );
  });

  test('without any engine the typed-caption field feeds the log', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as Record<string, unknown>;
      w.SpeechRecognition = undefined;
      w.webkitSpeechRecognition = undefined;
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: async () => ({ getTracks: () => [] }) },
        configurable: true,
      });
    });
    await page.goto('/captions');
    await page.getByRole('button', { name: /turn on captions/i }).click();
    await page.getByLabel('Type a caption line').fill('typed hello');
    await page.getByRole('button', { name: 'Add line' }).click();
    await expect(page.getByRole('log')).toContainText('typed hello');
  });

  test('iOS-style and Android-style sessions never request the Whisper model', async ({ page }) => {
    const modelRequests: string[] = [];
    page.on('request', (r) => {
      if (/huggingface|\.onnx|whisper/i.test(r.url())) modelRequests.push(r.url());
    });
    await open(page);
    await say(page, 'hello');
    expect(modelRequests).toEqual([]);
  });
});

test.describe('consent dialog on desktop Chromium', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36',
  });

  test('asks before any model request; declining uses browser speech; axe clean', async ({
    page,
  }) => {
    const modelRequests: string[] = [];
    page.on('request', (r) => {
      if (/huggingface|\.onnx/i.test(r.url())) modelRequests.push(r.url());
    });
    await installFakeSpeech(page);
    await page.addInitScript(() => {
      const w = window as unknown as Record<string, unknown>;
      w.AudioContext ??= class {};
      w.Worker ??= class {};
    });
    await page.goto('/captions');
    await page.getByRole('button', { name: 'Turn on captions' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('117 MB');
    await expect(dialog).toContainText('Wi-Fi');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
    for (const b of await dialog.getByRole('button').all()) {
      const box = await b.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(24);
    }
    expect(modelRequests).toEqual([]);
    await dialog.getByRole('button', { name: 'Use browser speech instead' }).click();
    await expect(page.getByText(/Captions by: Browser speech/)).toBeVisible();
    await expect(page.locator('.captions-message')).toContainText('Using Browser speech instead.');
    expect(modelRequests).toEqual([]);
  });
});
