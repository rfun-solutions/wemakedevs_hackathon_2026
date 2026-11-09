import { defineConfig, devices } from '@playwright/test';

// PORT keeps parallel agents on separate ports. The web server here is `vite preview` of web/dist
// (shell only). In CI (and F's probe) KC_BASE_URL points at a real server instead.
const port = Number(process.env.PORT ?? 3000);
const localUrl = `http://localhost:${port}`;
const baseURL = process.env.KC_BASE_URL ?? localUrl;

export default defineConfig({
  testDir: 'web/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'iphone-15', testIgnore: /e2e\/kay\//, use: { ...devices['iPhone 15'] } },
    { name: 'pixel-7', testIgnore: /e2e\/kay\//, use: { ...devices['Pixel 7'] } },
    {
      name: 'kay',
      testDir: 'web/e2e/kay',
      use: { ...devices['iPhone 15'], locale: 'es-ES', reducedMotion: 'reduce' },
    },
  ],
  webServer: process.env.KC_BASE_URL
    ? undefined
    : {
        command: `npm run build -w web && npx vite preview --config web/vite.config.ts --port ${port} --strictPort`,
        url: localUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
