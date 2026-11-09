import { defineConfig, devices } from '@playwright/test';

// H's own config for the built How it works page (task 2.3). Build first:
//   node --experimental-strip-types scripts/build-how-it-works.mjs .pages-build
// C0's playwright.config.ts is never edited. PORT keeps parallel agents apart.
const port = Number(process.env.PORT ?? 3112) + 1000;
export default defineConfig({
  testDir: 'scripts/pages-e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: `http://localhost:${port}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx --no-install vite preview --outDir .pages-build --port ${port} --strictPort`,
    url: `http://localhost:${port}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
