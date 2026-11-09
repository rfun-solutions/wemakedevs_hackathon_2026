import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

// Two projects: `api` (node) and `web` (happy-dom + @testing-library/preact).
// Playwright specs (`*.spec.ts` under web/e2e) are not Vitest tests.
export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: 'api',
          environment: 'node',
          include: ['api/**/*.test.ts'],
          exclude: ['**/node_modules/**'],
        },
      },
      {
        plugins: [preact()],
        test: {
          name: 'web',
          environment: 'happy-dom',
          include: ['web/src/**/*.test.{ts,tsx}'],
          exclude: ['**/node_modules/**', 'web/e2e/**'],
        },
      },
    ],
  },
});
