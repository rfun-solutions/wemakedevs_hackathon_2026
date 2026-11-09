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

const say = (page: Page, text: string) =>
  page.evaluate(
    (t) => (window as never as { __say(t: string, s: number): void }).__say(t, 0),
    text,
  );

// The service worker is not under test; Chrome's on-device Translator is removed so the server path runs.
test.use({ serviceWorkers: 'block' });

async function open(page: Page, lang: 'en' | 'es') {
  await installFakeSpeech(page);
  await page.addInitScript((l) => {
    const w = window as unknown as Record<string, unknown>;
    delete w.Translator;
    delete w.LanguageDetector;
    try {
      localStorage.setItem('kc.lang', l);
    } catch {
      /* ignore */
    }
  }, lang);
  await page.goto('/captions');
  await page.getByRole('button', { name: /turn on captions|activar subtítulos/i }).click();
  await expect(
    page.getByRole('button', { name: /turn off captions|desactivar subtítulos/i }),
  ).toBeVisible();
}

test.describe('translate (server path, stubbed)', () => {
  test('EN: translates a finished line once, keeps the original; axe clean', async ({ page }) => {
    const calls: Record<string, unknown>[] = [];
    await page.route('**/api/translate', (route) => {
      calls.push(route.request().postDataJSON());
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ text: 'Bienvenidos a la charla', source: 'auto', target: 'en' }),
      });
    });
    await open(page, 'en');
    await page.getByRole('button', { name: 'Translate captions' }).click();
    await say(page, 'Welcome to the talk');
    await expect(page.getByRole('log')).toContainText('Welcome to the talk');
    await expect(page.getByRole('region', { name: 'Translated captions' })).toContainText(
      'Bienvenidos a la charla',
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ text: 'Welcome to the talk', target: 'en' });
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('ES: a 503 keeps the original and shows the unavailable message; axe clean', async ({
    page,
  }) => {
    await page.route('**/api/translate', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'unavailable', reason: 'daily_cap' }),
      }),
    );
    await open(page, 'es');
    await page.getByRole('button', { name: 'Traducir subtítulos' }).click();
    await say(page, 'Welcome to the talk');
    await expect(page.getByRole('log')).toContainText('Welcome to the talk');
    await expect(page.getByRole('region', { name: 'Subtítulos traducidos' })).toContainText(
      'La traducción no está disponible ahora',
    );
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
